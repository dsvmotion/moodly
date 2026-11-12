import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { PLATFORM_MODEL_POLICY, createModelRouter } from "../router.js";
import type { ModelMessage, TransportRequest } from "../router.js";
import { CACHE_BREAKPOINT, ModelOutputTruncatedError, ModelRefusalError, createGatewayTransport, priceEur, pricesFor, toSdkMessages } from "./gateway.js";

// El transporte de Vercel AI Gateway con el modelo de prueba oficial del AI SDK:
// sin red ni clave. Se comprueba lo que llega al modelo y lo que vuelve al
// enrutador, no una imitación del SDK.
const models = {
  fast: { id: "test/fast", inputUsdPerMTok: 1, outputUsdPerMTok: 2 },
  smart: { id: "test/smart", inputUsdPerMTok: 4, outputUsdPerMTok: 20 },
};
// Con precios de caché como los de Anthropic: leer el 10 %, escribir el 125 %.
const cachedModels = {
  smart: { id: "test/smart", inputUsdPerMTok: 4, outputUsdPerMTok: 20, cacheReadUsdPerMTok: 0.4, cacheWriteUsdPerMTok: 5 },
};

type Generate = ConstructorParameters<typeof MockLanguageModelV4>[0] extends infer O ? NonNullable<O> extends { doGenerate?: infer G } ? G : never : never;

function transportWith(doGenerate: Generate, table: Parameters<typeof createGatewayTransport>[0]["models"] = models) {
  const used: string[] = [];
  const mocks: MockLanguageModelV4[] = [];
  const transport = createGatewayTransport({
    apiKey: "test-key",
    models: table,
    languageModel: (id) => {
      used.push(id);
      const mock = new MockLanguageModelV4({ modelId: id, doGenerate });
      mocks.push(mock);
      return mock;
    },
  });
  return { transport, used, mocks };
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

const request = (over: Partial<TransportRequest> = {}): TransportRequest => ({
  modelKey: "smart",
  messages: [
    { role: "system", content: "Eres la recepción." },
    { role: "user", content: "¿Hay hueco el lunes?" },
  ],
  maxOutputTokens: 4000,
  ...over,
});

describe("transporte de Vercel AI Gateway", () => {
  it("pide el modelo de la clave y devuelve el texto, los tokens y el coste que da el gateway", async () => {
    const { transport, used } = transportWith({
      content: [{ type: "text", text: "Sí, a las 9:00." }],
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: usage(1200, 80),
      // Por la tabla serían 0,0064: el gateway manda (descuentos, caché, otro precio).
      providerMetadata: { gateway: { cost: "0.0123" } },
      response: { modelId: "anthropic/test-smart-2030" },
      warnings: [],
    });
    const response = await transport.generate(request());
    expect(used).toEqual(["test/smart"]);
    expect(response).toMatchObject({ text: "Sí, a las 9:00.", tokensIn: 1200, tokensOut: 80, model: "anthropic/test-smart-2030" });
    expect(response.costEur).toBeCloseTo(0.0123, 8);
    expect(response.toolCalls).toBeUndefined();
  });

  it("sin coste del gateway, lo calcula con la tabla de precios", async () => {
    const { transport } = transportWith({
      content: [{ type: "text", text: "Hola" }],
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: usage(1_000_000, 100_000),
      warnings: [],
    });
    expect((await transport.generate(request())).costEur).toBeCloseTo(4 + 2, 8);
  });

  it("las herramientas llegan al modelo con su esquema y sin ejecutarse; las que pide vuelven como ToolCall", async () => {
    const { transport, mocks } = transportWith({
      content: [{ type: "tool-call", toolCallId: "call-1", toolName: "find_slots", input: JSON.stringify({ service_id: "laser" }) }],
      finishReason: { unified: "tool-calls", raw: "tool_use" },
      usage: usage(900, 40),
      warnings: [],
    });
    const response = await transport.generate(
      request({ tools: [{ name: "find_slots", description: "Busca huecos.", inputSchema: { type: "object", properties: { service_id: { type: "string" } } } }] }),
    );
    expect(response.toolCalls).toEqual([{ id: "call-1", name: "find_slots", args: { service_id: "laser" } }]);
    const sent = mocks[0]?.doGenerateCalls[0];
    expect(sent?.tools).toEqual([
      expect.objectContaining({
        type: "function",
        name: "find_slots",
        description: "Busca huecos.",
        inputSchema: expect.objectContaining({ properties: { service_id: { type: "string" } } }),
      }),
    ]);
    expect(sent?.maxOutputTokens).toBe(4000);
  });

  it("devuelve lo que dijo el modelo tal cual, razonamiento incluido, para reenviarlo en el paso siguiente", async () => {
    const { transport } = transportWith({
      content: [
        { type: "reasoning", text: "", providerMetadata: { anthropic: { signature: "firma-del-proveedor" } } },
        { type: "tool-call", toolCallId: "call-1", toolName: "find_slots", input: "{}" },
      ],
      finishReason: { unified: "tool-calls", raw: "tool_use" },
      usage: usage(900, 40),
      warnings: [],
    });
    const response = await transport.generate(request({ tools: [{ name: "find_slots", description: "x", inputSchema: { type: "object" } }] }));
    expect(JSON.stringify(response.providerMessages)).toContain("firma-del-proveedor");
    expect(response.providerMessages?.every((message) => (message as { role: string }).role === "assistant")).toBe(true);
  });

  it("una herramienta que no existe o con argumentos rotos llega al turno para que la rechace; el error del SDK no se reenvía", async () => {
    const { transport } = transportWith({
      content: [
        { type: "tool-call", toolCallId: "c1", toolName: "no_such_tool", input: "{}" },
        { type: "tool-call", toolCallId: "c2", toolName: "find_slots", input: "no es json" },
      ],
      finishReason: { unified: "tool-calls", raw: "tool_use" },
      usage: usage(900, 40),
      warnings: [],
    });
    const response = await transport.generate(request({ tools: [{ name: "find_slots", description: "x", inputSchema: { type: "object" } }] }));
    // El motor de políticas las rechaza (skill desconocida, entrada no válida) y se lo dice al modelo.
    expect(response.toolCalls?.map((call) => [call.id, call.name])).toEqual([
      ["c1", "no_such_tool"],
      ["c2", "find_slots"],
    ]);
    // El SDK añade su propio resultado de error; si se reenviara, cada llamada tendría dos resultados.
    expect(response.providerMessages?.map((message) => (message as { role: string }).role)).toEqual(["assistant"]);
    const next = toSdkMessages([
      { role: "user", content: "hola" },
      { role: "assistant", content: "", ...(response.toolCalls ? { toolCalls: response.toolCalls } : {}), ...(response.providerMessages ? { providerMessages: response.providerMessages } : {}) },
      { role: "tool", toolCallId: "c1", toolName: "no_such_tool", content: '{"status":"rejected"}' },
      { role: "tool", toolCallId: "c2", toolName: "find_slots", content: '{"status":"rejected"}' },
    ]).messages;
    const results = next.flatMap((message) => (message.role === "tool" ? message.content : []));
    expect(results.map((part) => (part as { toolCallId: string }).toolCallId)).toEqual(["c1", "c2"]);
  });

  it("si el modelo se niega o la respuesta se corta, falla en vez de devolver media respuesta", async () => {
    const refused = transportWith({ content: [], finishReason: { unified: "content-filter", raw: "refusal" }, usage: usage(10, 0), warnings: [] });
    await expect(refused.transport.generate(request())).rejects.toThrow(ModelRefusalError);
    const cut = transportWith({ content: [{ type: "text", text: "Tengo hue" }], finishReason: { unified: "length", raw: "max_tokens" }, usage: usage(10, 4000), warnings: [] });
    await expect(cut.transport.generate(request())).rejects.toThrow(ModelOutputTruncatedError);
  });

  it("estima por lo alto antes de llamar: entrada por caracteres y la salida máxima entera", () => {
    const { transport } = transportWith({ content: [], finishReason: { unified: "stop", raw: "end_turn" }, usage: usage(0, 0), warnings: [] });
    const estimate = transport.estimateEur(request({ maxOutputTokens: 4000 }));
    // 4.000 tokens de salida a 20 $/M ya son 0,08; la entrada suma algo más.
    expect(estimate).toBeGreaterThan(0.08);
    expect(estimate).toBeLessThan(0.081);
  });

  const twoTools = [
    { name: "find_slots", description: "Busca huecos.", inputSchema: { type: "object" } },
    { name: "book_appointment", description: "Reserva.", inputSchema: { type: "object" } },
  ];
  const marks = (sent: MockLanguageModelV4["doGenerateCalls"][number] | undefined) => ({
    prompt: sent?.prompt.map((message) => [message.role, message.providerOptions === undefined ? null : "cache"]),
    tools: sent?.tools?.map((tool) => [tool.name, "providerOptions" in tool && tool.providerOptions !== undefined ? "cache" : null]),
  });
  const answered = { content: [{ type: "text" as const, text: "Sí." }], finishReason: { unified: "stop" as const, raw: "end_turn" }, usage: usage(10, 2), warnings: [] };

  it("caché de prompt, primer paso: solo el sistema estable lleva la marca; la hora y la historia van después y sin ella", async () => {
    const { transport, mocks } = transportWith(answered);
    await transport.generate(
      request({
        messages: [
          { role: "system", content: "Reglas y negocio (estable).", cacheable: true },
          { role: "system", content: "Hora: lunes 09:30." },
          { role: "user", content: "Hola" },
          { role: "assistant", content: "¿En qué te ayudo?" },
          { role: "user", content: "¿Hay hueco?" },
        ],
        tools: twoTools,
      }),
    );
    const sent = mocks[0]?.doGenerateCalls[0];
    expect(sent?.prompt.slice(0, 2)).toEqual([
      { role: "system", content: "Reglas y negocio (estable).", providerOptions: CACHE_BREAKPOINT },
      { role: "system", content: "Hora: lunes 09:30." },
    ]);
    // En un turno de un solo paso nadie leería lo escrito tras la hora: no se marca (escribir cuesta un 25 % más).
    // Las herramientas van antes del sistema: la marca del sistema ya las guarda.
    expect(marks(sent)).toEqual({
      prompt: [["system", "cache"], ["system", null], ["user", null], ["assistant", null], ["user", null]],
      tools: [["find_slots", null], ["book_appointment", null]],
    });
  });

  it("caché de prompt, pasos siguientes: también el último resultado, que el paso siguiente leerá", async () => {
    const { transport, mocks } = transportWith(answered);
    await transport.generate(
      request({
        messages: [
          { role: "system", content: "Reglas y negocio (estable).", cacheable: true },
          { role: "system", content: "Hora: lunes 09:30." },
          { role: "user", content: "¿Hay hueco?" },
          { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "find_slots", args: {} }] },
          { role: "tool", toolCallId: "c1", toolName: "find_slots", content: '{"status":"executed"}' },
        ],
        tools: twoTools,
      }),
    );
    expect(marks(mocks[0]?.doGenerateCalls[0])).toEqual({
      prompt: [["system", "cache"], ["system", null], ["user", null], ["assistant", null], ["tool", "cache"]],
      tools: [["find_slots", null], ["book_appointment", null]],
    });
  });

  it("caché de prompt sin sistema estable: la marca va en la última herramienta", async () => {
    const { transport, mocks } = transportWith(answered);
    await transport.generate(request({ messages: [{ role: "system", content: "Reglas." }, { role: "user", content: "¿Hay hueco?" }], tools: twoTools }));
    expect(marks(mocks[0]?.doGenerateCalls[0])).toEqual({
      prompt: [["system", null], ["user", null]],
      tools: [["find_slots", null], ["book_appointment", "cache"]],
    });
  });

  it("caché de prompt: sin coste del gateway, lo leído de la caché se cobra al 10 % y lo escrito al 125 %", async () => {
    const { transport } = transportWith(
      {
        content: [{ type: "text", text: "Hola" }],
        finishReason: { unified: "stop", raw: "end_turn" },
        usage: {
          inputTokens: { total: 1_000_000, noCache: 100_000, cacheRead: 800_000, cacheWrite: 100_000 },
          outputTokens: { total: 10_000, text: 10_000, reasoning: 0 },
        },
        warnings: [],
      },
      cachedModels,
    );
    const response = await transport.generate(request());
    // 0,1 M × 4 + 0,8 M × 0,4 + 0,1 M × 5 + 0,01 M × 20 = 0,4 + 0,32 + 0,5 + 0,2.
    expect(response.costEur).toBeCloseTo(1.42, 8);
    expect(response).toMatchObject({ tokensIn: 1_000_000, cacheReadTokens: 800_000, cacheWriteTokens: 100_000 });
    // Sin caché, la misma entrada costaría 4 + 0,2: la caché abarata.
    expect(response.costEur).toBeLessThan(4.2);
  });

  it("caché de prompt: la estimación sigue por lo alto, con la entrada a precio de escribir en la caché", () => {
    const empty = { content: [], finishReason: { unified: "stop" as const, raw: "end_turn" }, usage: usage(0, 0), warnings: [] };
    const plain = transportWith(empty).transport.estimateEur(request({ maxOutputTokens: 0 }));
    const cached = transportWith(empty, cachedModels).transport.estimateEur(request({ maxOutputTokens: 0 }));
    expect(cached).toBeCloseTo((plain * 5) / 4, 10);
  });

  it("es gestionado, por el gateway y sin garantía de UE: con «Solo UE» el enrutador no lo usa", async () => {
    const { transport } = transportWith({ content: [{ type: "text", text: "x" }], finishReason: { unified: "stop", raw: "end_turn" }, usage: usage(1, 1), warnings: [] });
    expect(transport).toMatchObject({ via: "gateway", connection: "managed", region: "other", serves: ["fast", "smart"] });
    const router = createModelRouter([transport]);
    await expect(
      router.generate(
        { organizationId: "org-1", runId: "run-1", task: "converse", messages: [{ role: "user", content: "hola" }], maxOutputTokens: 100 },
        { ...PLATFORM_MODEL_POLICY, residency: "eu" },
        { runEur: 0, dayEur: 0 },
      ),
    ).rejects.toThrow(/residencia eu/);
  });
});

describe("priceEur: región y contexto largo", () => {
  const regional = {
    id: "test/regional",
    inputUsdPerMTok: 2,
    outputUsdPerMTok: 10,
    cacheReadUsdPerMTok: 0.1,
    cacheWriteUsdPerMTok: 2.5,
    regional: { eu: { inputUsdPerMTok: 2.2, outputUsdPerMTok: 11, cacheReadUsdPerMTok: 0.11, cacheWriteUsdPerMTok: 2.75 } },
  };
  const tokens = { input: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000, output: 1_000_000 };

  it("sin región, el precio global; con la UE, el de la UE en cada línea (un 10 % más)", () => {
    expect(priceEur(regional, tokens)).toBeCloseTo(2 + 0.1 + 2.5 + 10, 10);
    expect(priceEur(regional, tokens, "eu")).toBeCloseTo(2.2 + 0.11 + 2.75 + 11, 10);
  });

  it("una región sin precio falla en vez de cobrar a precio global", () => {
    expect(() => pricesFor(regional, "us")).toThrow(/no tiene precio en la región «us»/);
    expect(() => priceEur({ id: "test/plain", inputUsdPerMTok: 1, outputUsdPerMTok: 1 }, tokens, "eu")).toThrow(/región «eu»/);
  });

  it("contexto largo: desde el umbral (con la caché), cada línea por el multiplicador; por debajo, normal", () => {
    const haiku = { id: "test/haiku", inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5, longContext: { aboveInputTokens: 100_001, multiplier: 5 } };
    const below = { input: 50_000, cacheRead: 50_000, cacheWrite: 0, output: 1_000 };
    const at = { ...below, cacheWrite: 1 };
    expect(priceEur(haiku, below)).toBeCloseTo((100_000 * 0.1 + 1_000 * 0.5) / 1e6, 12);
    expect(priceEur(haiku, at)).toBeCloseTo((5 * (100_001 * 0.1 + 1_000 * 0.5)) / 1e6, 12);
  });

  it("el transporte del gateway no fija región: estima y cobra a precio global", async () => {
    const { transport } = transportWith(
      { content: [{ type: "text", text: "x" }], finishReason: { unified: "stop", raw: "end_turn" }, usage: usage(1_000_000, 0), warnings: [] },
      { smart: regional },
    );
    expect((await transport.generate(request())).costEur).toBeCloseTo(2, 8);
  });
});

describe("toSdkMessages", () => {
  it("el sistema va aparte; lo del cliente, como usuario; los resultados seguidos, en un solo mensaje", () => {
    const messages: ModelMessage[] = [
      { role: "system", content: "Reglas" },
      { role: "user", content: "¿Hueco?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "a", name: "find_slots", args: { x: 1 } },
          { id: "b", name: "list_my_appointments", args: {} },
        ],
      },
      { role: "tool", toolCallId: "a", toolName: "find_slots", content: '{"status":"executed"}' },
      { role: "tool", toolCallId: "b", toolName: "list_my_appointments", content: '{"status":"executed"}' },
    ];
    const { system, messages: sdk } = toSdkMessages(messages);
    // Sin prefijo estable, el sistema va sin marca de caché.
    expect(system).toEqual([{ role: "system", content: "Reglas" }]);
    expect(sdk.map((message) => message.role)).toEqual(["user", "assistant", "tool"]);
    expect(sdk[2]?.content).toHaveLength(2);
    expect(sdk[1]?.content).toEqual([
      { type: "tool-call", toolCallId: "a", toolName: "find_slots", input: { x: 1 } },
      { type: "tool-call", toolCallId: "b", toolName: "list_my_appointments", input: {} },
    ]);
  });

  it("si el paso anterior trae lo que dijo el proveedor, lo reenvía sin rehacerlo", () => {
    const original = { role: "assistant", content: [{ type: "reasoning", text: "", providerOptions: { anthropic: { signature: "s" } } }] };
    const { messages } = toSdkMessages([
      { role: "user", content: "hola" },
      { role: "assistant", content: "texto rehecho", toolCalls: [], providerMessages: [original] },
    ]);
    expect(messages[1]).toEqual(original);
  });
});
