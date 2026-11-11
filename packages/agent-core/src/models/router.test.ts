import { describe, expect, it } from "vitest";
import {
  AllTransportsFailedError,
  BudgetExceededError,
  NoEligibleTransportError,
  PLATFORM_MODEL_POLICY,
  createModelRouter,
  policyAllows,
  resolveModelKey,
} from "./router.js";
import type { ModelCall, ModelPolicy, Spend } from "./router.js";
import { createFakeTransport } from "./transports/fake.js";

const call: ModelCall = {
  organizationId: "org-1",
  runId: "run-1",
  task: "converse",
  messages: [{ role: "user", content: "¿Tenéis hueco mañana?" }],
  maxOutputTokens: 300,
};
const noSpend: Spend = { runEur: 0, dayEur: 0 };
const policy = (overrides: Partial<ModelPolicy> = {}): ModelPolicy => ({ ...PLATFORM_MODEL_POLICY, ...overrides });
const failing = () => {
  throw new Error("503 del proveedor");
};

describe("modelo por tarea", () => {
  it("pide la clave lógica de la tarea, no un modelo", async () => {
    const transport = createFakeTransport({ provider: "a" });
    const router = createModelRouter([transport]);
    await router.generate({ ...call, task: "reason" }, policy(), noSpend);
    await router.generate({ ...call, task: "classify" }, policy(), noSpend);
    expect(transport.calls.map((request) => request.modelKey)).toEqual(["smart", "fast"]);
  });

  it("sin agente conocido, conversar usa el por defecto de la tarea: el capaz, no el rápido (producto, 2026-11-03)", async () => {
    const transport = createFakeTransport({ provider: "a" });
    await createModelRouter([transport]).generate(call, policy(), noSpend);
    expect(transport.calls[0]?.modelKey).toBe("smart");
  });

  it("usa el modelo que la política de la organización asigna a la tarea", async () => {
    const transport = createFakeTransport({ provider: "a" });
    const router = createModelRouter([transport]);
    await router.generate(call, policy({ modelByTask: { ...PLATFORM_MODEL_POLICY.modelByTask, converse: "fast" } }), noSpend);
    expect(transport.calls[0]?.modelKey).toBe("fast");
  });

  it("salta los transportes que no sirven esa clave", async () => {
    const onlyEmbeddings = createFakeTransport({ provider: "e", serves: ["embedding"] });
    const chat = createFakeTransport({ provider: "c", serves: ["fast"] });
    const result = await createModelRouter([onlyEmbeddings, chat]).generate({ ...call, task: "classify" }, policy(), noSpend);
    expect(result.provider).toBe("c");
  });
});

describe("modelo por agente para conversar (producto, 2026-11-11: la clave más barata que pasa sus evals)", () => {
  const converseWith = async (agentPolicy: ModelPolicy, agentType?: string) => {
    const transport = createFakeTransport({ provider: "a" });
    const result = await createModelRouter([transport]).generate({ ...call, ...(agentType ? { agentType } : {}) }, agentPolicy, noSpend);
    return { sent: transport.calls[0]?.modelKey, result };
  };

  it("Atención al cliente conversa con fast y Recepción con smart", async () => {
    expect((await converseWith(policy(), "customer")).sent).toBe("fast");
    expect((await converseWith(policy(), "reception")).sent).toBe("smart");
  });

  it("el resultado dice con qué clave contestó (lo que se registra por llamada)", async () => {
    expect((await converseWith(policy(), "customer")).result.modelKey).toBe("fast");
  });

  it("lo que elige la organización para conversar manda sobre el agente, en los dos sentidos", async () => {
    const chosen = (converse: "fast" | "smart") =>
      policy({ modelByTask: { ...PLATFORM_MODEL_POLICY.modelByTask, converse }, modelOverrides: { converse } });
    expect((await converseWith(chosen("smart"), "customer")).sent).toBe("smart");
    expect((await converseWith(chosen("fast"), "reception")).sent).toBe("fast");
  });

  it("una elección de la organización para otra tarea no cambia el modelo del agente", async () => {
    const reasonOnly = policy({ modelByTask: { ...PLATFORM_MODEL_POLICY.modelByTask, reason: "fast" }, modelOverrides: { reason: "fast" } });
    expect((await converseWith(reasonOnly, "customer")).sent).toBe("fast");
    expect((await converseWith(reasonOnly, "reception")).sent).toBe("smart");
  });

  it("sin agente, o con un tipo de agente sin clave propia (plantilla o propio, ADR 0030), la clave de la tarea en la política", async () => {
    expect((await converseWith(policy())).sent).toBe("smart");
    expect((await converseWith(policy(), "mi_agente_propio")).sent).toBe("smart");
    const fastByTask = policy({ modelByTask: { ...PLATFORM_MODEL_POLICY.modelByTask, converse: "fast" } });
    expect((await converseWith(fastByTask, "mi_agente_propio")).sent).toBe("fast");
  });

  it("el agente solo cuenta para conversar: razonar o clasificar no cambian", () => {
    expect(resolveModelKey(policy(), "reason", "customer")).toBe("smart");
    expect(resolveModelKey(policy(), "classify", "reception")).toBe("fast");
    expect(resolveModelKey(policy(), "embed", "customer")).toBe("embedding");
  });
});

describe("residencia (Solo UE)", () => {
  it("con «Solo UE» no usa un transporte que procesa fuera, aunque sea el primero", async () => {
    const us = createFakeTransport({ provider: "us", region: "other" });
    const eu = createFakeTransport({ provider: "eu", region: "eu" });
    const result = await createModelRouter([us, eu]).generate(call, policy({ residency: "eu" }), noSpend);
    expect(result).toMatchObject({ provider: "eu", region: "eu" });
    expect(us.calls).toHaveLength(0);
  });

  it("con «Solo UE», si falla el principal, el respaldo tampoco sale de la región", async () => {
    const euDown = createFakeTransport({ provider: "eu-1", region: "eu", respond: failing });
    const us = createFakeTransport({ provider: "us", region: "other" });
    const router = createModelRouter([euDown, us]);
    await expect(router.generate(call, policy({ residency: "eu" }), noSpend)).rejects.toThrow(AllTransportsFailedError);
    expect(us.calls).toHaveLength(0);
  });

  it("si nada procesa en la UE, falla antes de llamar en vez de salir de la región", async () => {
    const us = createFakeTransport({ provider: "us", region: "other" });
    await expect(createModelRouter([us]).generate(call, policy({ residency: "eu" }), noSpend)).rejects.toThrow(NoEligibleTransportError);
    expect(us.calls).toHaveLength(0);
  });

  it("por defecto (any) usa el primero, procese donde procese", async () => {
    const us = createFakeTransport({ provider: "us", region: "other" });
    expect((await createModelRouter([us]).generate(call, policy(), noSpend)).provider).toBe("us");
  });
});

describe("proveedores permitidos", () => {
  it("solo usa los proveedores que permite la organización", async () => {
    const a = createFakeTransport({ provider: "a" });
    const b = createFakeTransport({ provider: "b" });
    const result = await createModelRouter([a, b]).generate(call, policy({ allowedProviders: ["b"] }), noSpend);
    expect(result.provider).toBe("b");
    expect(a.calls).toHaveLength(0);
  });
});

describe("modo de conexión", () => {
  it("BYOK nunca cae a credenciales de Moodly, ni cuando falla su transporte", async () => {
    const byokDown = createFakeTransport({ provider: "a", connection: "byok", respond: failing });
    const managed = createFakeTransport({ provider: "a", connection: "managed" });
    const router = createModelRouter([byokDown, managed]);
    await expect(router.generate(call, policy({ connection: "byok" }), noSpend)).rejects.toThrow(AllTransportsFailedError);
    expect(managed.calls).toHaveLength(0);
  });

  it("lo gestionado tampoco usa las claves de un cliente", async () => {
    const byok = createFakeTransport({ provider: "a", connection: "byok" });
    await expect(createModelRouter([byok]).generate(call, policy(), noSpend)).rejects.toThrow(NoEligibleTransportError);
  });
});

describe("presupuesto", () => {
  it("corta antes de llamar si la llamada supera el tope del run", async () => {
    const transport = createFakeTransport({ provider: "a", estimateEur: 0.2 });
    const router = createModelRouter([transport]);
    await expect(router.generate(call, policy({ budget: { perRunEur: 0.5, perDayEur: 20 } }), { runEur: 0.4, dayEur: 1 })).rejects.toThrow(
      BudgetExceededError,
    );
    expect(transport.calls).toHaveLength(0);
  });

  it("corta antes de llamar si supera el tope del día", async () => {
    const transport = createFakeTransport({ provider: "a", estimateEur: 0.2 });
    await expect(
      createModelRouter([transport]).generate(call, policy({ budget: { perRunEur: 5, perDayEur: 20 } }), { runEur: 0, dayEur: 19.9 }),
    ).rejects.toThrow(BudgetExceededError);
    expect(transport.calls).toHaveLength(0);
  });

  it("llama si cabe justo en el tope", async () => {
    const transport = createFakeTransport({ provider: "a", estimateEur: 0.1 });
    await createModelRouter([transport]).generate(call, policy({ budget: { perRunEur: 0.5, perDayEur: 20 } }), { runEur: 0.4, dayEur: 0 });
    expect(transport.calls).toHaveLength(1);
  });
});

describe("respaldo", () => {
  it("usa el respaldo solo si falla el principal, y lo marca", async () => {
    const primary = createFakeTransport({ provider: "a", respond: failing });
    const backup = createFakeTransport({ provider: "b" });
    const result = await createModelRouter([primary, backup]).generate(call, policy(), noSpend);
    expect(result).toMatchObject({ provider: "b", fallback: true });
  });

  it("si responde el principal no toca el respaldo", async () => {
    const primary = createFakeTransport({ provider: "a" });
    const backup = createFakeTransport({ provider: "b" });
    const result = await createModelRouter([primary, backup]).generate(call, policy(), noSpend);
    expect(result).toMatchObject({ provider: "a", fallback: false });
    expect(backup.calls).toHaveLength(0);
  });

  it("no pasa del respaldo: un tercer transporte no se prueba", async () => {
    const third = createFakeTransport({ provider: "c" });
    const router = createModelRouter([
      createFakeTransport({ provider: "a", respond: failing }),
      createFakeTransport({ provider: "b", respond: failing }),
      third,
    ]);
    await expect(router.generate(call, policy(), noSpend)).rejects.toThrow(AllTransportsFailedError);
    expect(third.calls).toHaveLength(0);
  });
});

describe("lo que devuelve cada llamada (ADR 0019)", () => {
  it("dice proveedor, modelo, región, vía, conexión, tokens, coste y latencia", async () => {
    let clock = 1_000;
    const transport = createFakeTransport({ provider: "a", region: "eu", via: "gateway" });
    const router = createModelRouter([transport], () => (clock += 250));
    const result = await router.generate({ ...call, task: "classify" }, policy(), noSpend);
    expect(result).toEqual({
      text: "respuesta de a",
      model: "a/fast",
      tokensIn: 10,
      tokensOut: 5,
      costEur: 0.0005,
      provider: "a",
      region: "eu",
      via: "gateway",
      connection: "managed",
      modelKey: "fast",
      latencyMs: 250,
      fallback: false,
    });
  });
});

describe("herramientas (paso 4d)", () => {
  it("pasa las herramientas al transporte y devuelve las que pide el modelo", async () => {
    const toolCalls = [{ id: "c1", name: "find_slots", args: { service_id: "laser" } }];
    const transport = createFakeTransport({
      provider: "a",
      respond: () => ({ text: "", toolCalls, model: "a/fast", tokensIn: 10, tokensOut: 5, costEur: 0.0005 }),
    });
    const tools = [{ name: "find_slots", description: "Busca huecos.", inputSchema: { type: "object" } }];
    const result = await createModelRouter([transport]).generate({ ...call, tools }, policy(), noSpend);
    expect(transport.calls[0]?.tools).toEqual(tools);
    expect(result.toolCalls).toEqual(toolCalls);
  });

  it("sin herramientas, el transporte no recibe el campo", async () => {
    const transport = createFakeTransport({ provider: "a" });
    await createModelRouter([transport]).generate(call, policy(), noSpend);
    expect(transport.calls[0]).not.toHaveProperty("tools");
  });
});

describe("policyAllows: la misma regla para los embeddings (ADR 0048)", () => {
  const gateway = { provider: "vercel-ai-gateway", region: "other", connection: "managed" } as const;
  it("por defecto, la vía del gateway vale", () => {
    expect(policyAllows(policy(), gateway)).toBe(true);
  });
  it("con «Solo UE», solo una vía con región UE garantizada", () => {
    expect(policyAllows(policy({ residency: "eu" }), gateway)).toBe(false);
    expect(policyAllows(policy({ residency: "eu" }), { ...gateway, region: "eu" })).toBe(true);
  });
  it("con proveedores permitidos, solo esos; y nunca otro modo de conexión", () => {
    expect(policyAllows(policy({ allowedProviders: ["mistral"] }), gateway)).toBe(false);
    expect(policyAllows(policy({ allowedProviders: ["vercel-ai-gateway"] }), gateway)).toBe(true);
    expect(policyAllows(policy({ connection: "byok" }), gateway)).toBe(false);
  });
});
