import { describe, expect, it, vi } from "vitest";
import { ChannelSendError } from "./adapter.js";
import type { NormalizedOutbound } from "./message.js";
import { hmacSha256Hex } from "./signature.js";
import { WHATSAPP_CAPABILITIES, WHATSAPP_SIGNATURE_HEADER, createWhatsAppAdapter, parseWhatsAppWebhook } from "./whatsapp.js";

const APP_SECRET = "app-secret-de-prueba";
const VERIFY_TOKEN = "token-de-alta";
const ACCESS_TOKEN = "EAAG-token-de-prueba";
const PHONE_NUMBER_ID = "106540352242922";

/** Un webhook como los de la documentación de Meta (forma de la Cloud API). */
function metaWebhook(value: Record<string, unknown>, field = "messages") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field,
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: PHONE_NUMBER_ID },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

const TEXT_WAMID = "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQUFERjg0NDEzNDdFODU3MUMxMAA=";
const TEXT_MESSAGE = {
  contacts: [{ profile: { name: "Sheena Nelson" }, wa_id: "16505551234" }],
  messages: [{ from: "16505551234", id: TEXT_WAMID, timestamp: "1749416383", type: "text", text: { body: "Hola, ¿tenéis hueco el sábado?" } }],
};

function adapterWith(fetchImpl?: typeof fetch) {
  return createWhatsAppAdapter({
    appSecret: APP_SECRET,
    verifyToken: VERIFY_TOKEN,
    accessToken: ACCESS_TOKEN,
    graphApiVersion: "v23.0",
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
}

function signed(body: unknown) {
  const rawBody = JSON.stringify(body);
  return { rawBody, headers: { [WHATSAPP_SIGNATURE_HEADER]: `sha256=${hmacSha256Hex(APP_SECRET, rawBody)}` } };
}

describe("createWhatsAppAdapter: firma", () => {
  it("una firma buena del secreto de la app cubre a toda la plataforma", async () => {
    await expect(adapterWith().verify(signed(metaWebhook(TEXT_MESSAGE)))).resolves.toEqual({ scope: "platform" });
  });

  it("sin firma, con otro secreto, sin el prefijo o con el cuerpo cambiado: null", async () => {
    const adapter = adapterWith();
    const good = signed(metaWebhook(TEXT_MESSAGE));
    await expect(adapter.verify({ rawBody: good.rawBody, headers: {} })).resolves.toBeNull();
    const otherSecret = `sha256=${hmacSha256Hex("otro-secreto", good.rawBody)}`;
    await expect(adapter.verify({ rawBody: good.rawBody, headers: { [WHATSAPP_SIGNATURE_HEADER]: otherSecret } })).resolves.toBeNull();
    const noPrefix = hmacSha256Hex(APP_SECRET, good.rawBody);
    await expect(adapter.verify({ rawBody: good.rawBody, headers: { [WHATSAPP_SIGNATURE_HEADER]: noPrefix } })).resolves.toBeNull();
    // Un solo byte distinto del cuerpo firmado (un espacio al final).
    await expect(adapter.verify({ rawBody: `${good.rawBody} `, headers: good.headers })).resolves.toBeNull();
  });
});

describe("createWhatsAppAdapter: alta del webhook", () => {
  const query = (token: string | null, mode = "subscribe", challenge = "1158201444") => {
    const params = new URLSearchParams({ "hub.mode": mode, "hub.challenge": challenge });
    if (token !== null) params.set("hub.verify_token", token);
    return params;
  };

  it("con el token exacto, devuelve el challenge tal cual", () => {
    expect(adapterWith().handshake?.(query(VERIFY_TOKEN))).toBe("1158201444");
  });

  it("con otro token, un prefijo o un sufijo, sin token o con otro modo: null (el servidor contesta 403 a secas)", () => {
    const adapter = adapterWith();
    expect(adapter.handshake?.(query("otro"))).toBeNull();
    expect(adapter.handshake?.(query(VERIFY_TOKEN.slice(0, -1)))).toBeNull();
    expect(adapter.handshake?.(query(`${VERIFY_TOKEN}x`))).toBeNull();
    expect(adapter.handshake?.(query(` ${VERIFY_TOKEN}`))).toBeNull();
    expect(adapter.handshake?.(query(null))).toBeNull();
    expect(adapter.handshake?.(query(VERIFY_TOKEN, "unsubscribe"))).toBeNull();
    // Un challenge con caracteres raros no se devuelve (no se refleja nada que no sea un id).
    expect(adapter.handshake?.(query(VERIFY_TOKEN, "subscribe", "<script>"))).toBeNull();
  });
});

describe("parseWhatsAppWebhook: mensajes", () => {
  it("un texto: la cuenta es el phone_number_id, el wamid es la clave del evento y del mensaje", () => {
    const { messages, statuses } = parseWhatsAppWebhook(JSON.stringify(metaWebhook(TEXT_MESSAGE)));
    expect(statuses).toEqual([]);
    expect(messages).toEqual([
      {
        channel: "whatsapp",
        accountExternalId: PHONE_NUMBER_ID,
        providerEventId: TEXT_WAMID,
        providerMessageId: TEXT_WAMID,
        from: { kind: "phone", value: "+16505551234" },
        displayName: "Sheena Nelson",
        receivedAt: "2025-06-08T20:59:43.000Z",
        text: "Hola, ¿tenéis hueco el sábado?",
        attachments: [],
      },
    ]);
  });

  it("imagen, audio, documento, sticker y ubicación: adjuntos por referencia, sin descargar nada", () => {
    const base = { from: "34600111222", timestamp: "1749416383" };
    const { messages } = parseWhatsAppWebhook(
      JSON.stringify(
        metaWebhook({
          messages: [
            { ...base, id: "wamid.img", type: "image", image: { id: "media-1", mime_type: "image/jpeg", caption: "mi pelo" } },
            { ...base, id: "wamid.aud", type: "audio", audio: { id: "media-2", mime_type: "audio/ogg; codecs=opus" } },
            { ...base, id: "wamid.doc", type: "document", document: { id: "media-3", mime_type: "application/pdf", filename: "presupuesto.pdf" } },
            { ...base, id: "wamid.stk", type: "sticker", sticker: { id: "media-4", mime_type: "image/webp" } },
            { ...base, id: "wamid.loc", type: "location", location: { latitude: 40.4168, longitude: -3.7038, name: "Sol", address: "Madrid" } },
          ],
        }),
      ),
    );
    expect(messages.map((message) => [message.providerEventId, message.text, message.attachments])).toEqual([
      ["wamid.img", "", [{ kind: "image", providerRef: "media-1", mimeType: "image/jpeg", caption: "mi pelo" }]],
      ["wamid.aud", "", [{ kind: "audio", providerRef: "media-2", mimeType: "audio/ogg; codecs=opus" }]],
      ["wamid.doc", "", [{ kind: "document", providerRef: "media-3", mimeType: "application/pdf" }]],
      ["wamid.stk", "", [{ kind: "image", providerRef: "media-4", mimeType: "image/webp" }]],
      ["wamid.loc", "", [{ kind: "location", providerRef: "40.4168,-3.7038", caption: "Sol, Madrid" }]],
    ]);
    // Sin contacts en el webhook, sin nombre.
    expect(messages[0]?.displayName).toBeUndefined();
  });

  it("botones e interactivos: el texto de lo que pulsó; la respuesta a otro mensaje, con su wamid", () => {
    const base = { from: "34600111222", timestamp: "1749416383" };
    const { messages } = parseWhatsAppWebhook(
      JSON.stringify(
        metaWebhook({
          messages: [
            { ...base, id: "wamid.btn", type: "button", button: { text: "Confirmar cita", payload: "x" }, context: { id: "wamid.plantilla" } },
            { ...base, id: "wamid.int", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "si", title: "Sí" } } },
            { ...base, id: "wamid.lst", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "s1", title: "Corte" } } },
          ],
        }),
      ),
    );
    expect(messages.map((message) => [message.text, message.replyToProviderMessageId])).toEqual([
      ["Confirmar cita", "wamid.plantilla"],
      ["Sí", undefined],
      ["Corte", undefined],
    ]);
  });

  it("lo que no entiende lo ignora: reacciones, tipos desconocidos, otro object, otro field, sin cuenta o con datos raros", () => {
    const base = { from: "34600111222", timestamp: "1749416383" };
    const ignored = [
      metaWebhook({ messages: [{ ...base, id: "wamid.r", type: "reaction", reaction: { message_id: "wamid.x", emoji: "👍" } }] }),
      metaWebhook({ messages: [{ ...base, id: "wamid.u", type: "unsupported" }] }),
      metaWebhook({ messages: [{ ...base, id: "wamid.t", type: "text" }] }),
      metaWebhook({ messages: [{ ...base, id: "wamid.v", type: "text", text: { body: "   " } }] }),
      metaWebhook({ messages: [{ ...base, from: "no-es-un-numero", id: "wamid.f", type: "text", text: { body: "hola" } }] }),
      metaWebhook({ messages: [{ ...base, timestamp: "ayer", id: "wamid.ts", type: "text", text: { body: "hola" } }] }),
      metaWebhook(TEXT_MESSAGE, "message_template_status_update"),
      { ...metaWebhook(TEXT_MESSAGE), object: "page" },
      { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: TEXT_MESSAGE.messages } }] }] },
      { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "../../me" }, messages: TEXT_MESSAGE.messages } }] }] },
      { object: "whatsapp_business_account" },
    ];
    for (const body of ignored) expect(parseWhatsAppWebhook(JSON.stringify(body))).toEqual({ messages: [], statuses: [] });
  });

  it("dos números en el mismo webhook: cada mensaje con su propia cuenta, nunca la de otro", () => {
    const other = "200000000000001";
    const body = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "102290129340398",
          changes: [
            ...metaWebhook(TEXT_MESSAGE).entry.flatMap((entry) => entry.changes),
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "34910000000", phone_number_id: other },
                messages: [{ from: "34600111222", id: "wamid.otro", timestamp: "1749416383", type: "text", text: { body: "para el otro número" } }],
              },
            },
          ],
        },
      ],
    };
    const { messages } = parseWhatsAppWebhook(JSON.stringify(body));
    expect(messages.map((message) => [message.providerEventId, message.accountExternalId])).toEqual([
      [TEXT_WAMID, PHONE_NUMBER_ID],
      ["wamid.otro", other],
    ]);
  });

  it("un cuerpo que no es JSON lanza (receive contesta 400)", () => {
    expect(() => parseWhatsAppWebhook("no es json")).toThrow();
  });
});

describe("parseWhatsAppWebhook: estados", () => {
  it("sent, delivered, read y failed con su código; los demás se ignoran", () => {
    const at = "1749416390";
    const { messages, statuses } = parseWhatsAppWebhook(
      JSON.stringify(
        metaWebhook({
          statuses: [
            { id: "wamid.out1", status: "sent", timestamp: at, recipient_id: "34600111222" },
            { id: "wamid.out1", status: "delivered", timestamp: at, recipient_id: "34600111222" },
            { id: "wamid.out1", status: "read", timestamp: at, recipient_id: "34600111222" },
            { id: "wamid.out2", status: "failed", timestamp: at, recipient_id: "34600111222", errors: [{ code: 131047, title: "Re-engagement message" }] },
            { id: "wamid.out3", status: "deleted", timestamp: at, recipient_id: "34600111222" },
            { id: "wamid.out4", status: "sent", timestamp: "mañana", recipient_id: "34600111222" },
          ],
        }),
      ),
    );
    expect(messages).toEqual([]);
    // Con la cuenta que lo envió (el phone_number_id): de ella sale la organización.
    const from = { channel: "whatsapp", accountExternalId: PHONE_NUMBER_ID };
    expect(statuses).toEqual([
      { ...from, providerMessageId: "wamid.out1", status: "sent", at: "2025-06-08T20:59:50.000Z" },
      { ...from, providerMessageId: "wamid.out1", status: "delivered", at: "2025-06-08T20:59:50.000Z" },
      { ...from, providerMessageId: "wamid.out1", status: "read", at: "2025-06-08T20:59:50.000Z" },
      // Solo el código, nunca el título (texto de Meta).
      { ...from, providerMessageId: "wamid.out2", status: "failed", at: "2025-06-08T20:59:50.000Z", errorCode: "whatsapp:131047" },
    ]);
  });

  it("cada aviso va con la cuenta de su número, aunque lleguen dos en el mismo webhook", () => {
    const status = (id: string) => ({ id, status: "delivered", timestamp: "1749416390", recipient_id: "34600111222" });
    const body = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID",
          changes: [
            { field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "111111111111111" }, statuses: [status("wamid.a")] } },
            { field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "222222222222222" }, statuses: [status("wamid.b")] } },
            // Sin la cuenta que lo envió no hay a quién atribuirlo.
            { field: "messages", value: { messaging_product: "whatsapp", statuses: [status("wamid.c")] } },
          ],
        },
      ],
    };
    const { statuses } = parseWhatsAppWebhook(JSON.stringify(body));
    expect(statuses.map(({ accountExternalId, providerMessageId }) => [accountExternalId, providerMessageId])).toEqual([
      ["111111111111111", "wamid.a"],
      ["222222222222222", "wamid.b"],
    ]);
  });
});

describe("createWhatsAppAdapter: envíos", () => {
  const outbound = (overrides: Partial<NormalizedOutbound> = {}): NormalizedOutbound => ({
    channel: "whatsapp",
    accountExternalId: PHONE_NUMBER_ID,
    to: { kind: "phone", value: "+34600111222" },
    text: "Te esperamos el sábado a las 10:00.",
    buttons: [],
    attachments: [],
    idempotencyKey: "msg-1",
    ...overrides,
  });
  const okResponse = () =>
    new Response(JSON.stringify({ messaging_product: "whatsapp", contacts: [{ input: "34600111222", wa_id: "34600111222" }], messages: [{ id: "wamid.sent1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("un texto: POST a /v23.0/<phone_number_id>/messages con el token, y devuelve el wamid", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    await expect(adapterWith(fetchMock).send(outbound())).resolves.toEqual({ providerMessageId: "wamid.sent1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(JSON.parse(init?.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "34600111222",
      type: "text",
      text: { body: "Te esperamos el sábado a las 10:00.", preview_url: false },
    });
  });

  it("una plantilla con sus variables en orden, y un texto con botones de respuesta", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(okResponse()));
    const adapter = adapterWith(fetchMock);
    const withoutText: NormalizedOutbound = { ...outbound() };
    delete withoutText.text;
    await adapter.send({ ...withoutText, template: { name: "recordatorio_cita", language: "es", variables: ["Ana", "sábado 10:00"] } });
    await adapter.send(outbound({ buttons: [{ id: "si", title: "Sí" }, { id: "no", title: "No" }] }));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      type: "template",
      template: {
        name: "recordatorio_cita",
        language: { code: "es" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "sábado 10:00" }] }],
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Te esperamos el sábado a las 10:00." },
        action: { buttons: [{ type: "reply", reply: { id: "si", title: "Sí" } }, { type: "reply", reply: { id: "no", title: "No" } }] },
      },
    });
  });

  it("no envía nada con un destino, una cuenta o un canal que no valen, ni con adjuntos (aún)", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const adapter = adapterWith(fetchMock);
    const cases: [Partial<NormalizedOutbound>, string][] = [
      [{ to: { kind: "email", value: "ana@example.com" } }, "invalid_recipient"],
      [{ to: { kind: "phone", value: "+34 600" } }, "invalid_recipient"],
      // Fuera de E.164 (como contact_identities): empieza por 0 o tiene más de 15 cifras.
      [{ to: { kind: "phone", value: "+0346001112" } }, "invalid_recipient"],
      [{ to: { kind: "phone", value: "+3460011122233344" } }, "invalid_recipient"],
      [{ accountExternalId: "../../me/accounts" }, "invalid_account"],
      [{ channel: "webchat" }, "wrong_channel"],
      [{ attachments: [{ kind: "image", providerRef: "media-1" }] }, "attachments_unsupported"],
      // Botones con el cuerpo en blanco: Meta lo rechazaría (el esquema ya lo impide; esto es la red).
      [{ text: "   ", buttons: [{ id: "si", title: "Sí" }] }, "empty_message"],
    ];
    for (const [overrides, code] of cases) {
      const error = await adapter.send(outbound(overrides)).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ChannelSendError);
      expect(error).toMatchObject({ retryable: false, providerCode: code });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("los errores de Meta: pasajeros (red, 5xx, 429, límites de ritmo) o definitivos, solo con el código", async () => {
    const metaError = (status: number, code: number) =>
      new Response(JSON.stringify({ error: { message: "texto de Meta con +34600111222", type: "OAuthException", code } }), { status });
    // [respuesta, retryable, código, outcomeUnknown: Meta pudo recibirlo igualmente]
    const cases: [() => Promise<Response>, boolean, string, boolean][] = [
      [() => Promise.reject(new TypeError("fetch failed")), true, "network", true],
      [() => Promise.resolve(new Response("bad gateway", { status: 502 })), true, "http_502", true],
      [() => Promise.resolve(metaError(429, 130429)), true, "whatsapp:130429", false],
      [() => Promise.resolve(metaError(400, 131056)), true, "whatsapp:131056", false],
      [() => Promise.resolve(metaError(400, 131047)), false, "whatsapp:131047", false],
      [() => Promise.resolve(metaError(401, 190)), false, "whatsapp:190", false],
      [() => Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 })), false, "bad_response", true],
    ];
    for (const [respond, retryable, code, outcomeUnknown] of cases) {
      const error = await adapterWith(vi.fn<typeof fetch>().mockImplementation(respond)).send(outbound()).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ChannelSendError);
      expect(error).toMatchObject({ retryable, providerCode: code, outcomeUnknown });
      // Ni el texto de Meta ni el número del cliente en el mensaje del error.
      expect((error as Error).message).not.toContain("34600111222");
    }
  });

  it("una Graph API que no contesta: se corta al tiempo y queda como pasajero con resultado desconocido", async () => {
    const hang = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const adapter = createWhatsAppAdapter({
      appSecret: APP_SECRET,
      verifyToken: VERIFY_TOKEN,
      accessToken: ACCESS_TOKEN,
      graphApiVersion: "v23.0",
      fetch: hang,
      timeoutMs: 50,
    });
    const error = await adapter.send(outbound()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ChannelSendError);
    expect(error).toMatchObject({ retryable: true, providerCode: "timeout", outcomeUnknown: true });
  });

  it("un timeout que no es un entero positivo no arranca", () => {
    for (const timeoutMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createWhatsAppAdapter({ appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN, accessToken: ACCESS_TOKEN, graphApiVersion: "v23.0", timeoutMs }),
      ).toThrow(/timeoutMs/);
    }
  });

  it("una versión de la Graph API con otra forma no arranca", () => {
    expect(() => createWhatsAppAdapter({ appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN, accessToken: ACCESS_TOKEN, graphApiVersion: "latest" })).toThrow();
  });

  it("las capacidades: 4096 caracteres, 3 botones, plantillas y la ventana de 24 h", () => {
    expect(adapterWith().capabilities).toEqual(WHATSAPP_CAPABILITIES);
    expect(WHATSAPP_CAPABILITIES).toEqual({ maxTextLength: 4096, maxButtons: 3, templates: true, serviceWindowHours: 24, deliveryReceipts: true });
  });
});
