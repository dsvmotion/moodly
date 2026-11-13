import { ChannelSendError, type ChannelAdapter, type NormalizedOutbound } from "@repo/channels";
import type { TenantDb } from "@repo/db/service";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { DomainEvent, EventContext } from "../events/handlers.ts";
import { CHANNEL_SEND_HANDLER_KEY, SEND_ATTEMPTS, claimAndSend, createChannelSendHandler } from "./send.ts";

// El envío por un canal (O-01), sin base de datos ni Meta: una base de datos de
// mentira con el estado del mensaje y un adaptador que contesta lo que se le diga.
// Lo que importa: con un resultado desconocido (5xx, timeout, red) nunca hay un
// segundo envío, ni reintentando ni si DBOS repite el paso.

const ORG = "0a000000-0000-4000-8000-000000000001";
const CONV = "0c000000-0000-4000-8000-000000000001";
const MSG = "0d000000-0000-4000-8000-000000000001";
const logger = pino({ level: "silent" });

function fakeDb(options: { status?: string; phone?: string | null; channel?: string; found?: boolean } = {}) {
  const state = { status: options.status ?? "pending", externalId: null as string | null, deliveryError: null as string | null };
  const queries: string[] = [];
  const query = async (text: string, values: readonly unknown[] = []) => {
    queries.push(text);
    if (/^\s*select m\.id/.test(text)) {
      if (options.found === false) return [];
      return [
        {
          id: MSG,
          conversation_id: CONV,
          status: state.status,
          content: "Te esperamos el sábado a las 10:00.",
          idempotency_key: "turn-1:reply",
          channel: options.channel ?? "whatsapp",
          account_external_id: "106540352242922",
          phone: options.phone === undefined ? "+34600111222" : options.phone,
        },
      ];
    }
    if (/set status = 'unknown'/.test(text)) {
      if (state.status !== "pending") return [];
      state.status = "unknown";
      return [{ id: MSG }];
    }
    if (/set status = 'sent'/.test(text)) {
      state.status = "sent";
      state.externalId ??= values[2] as string;
      return [];
    }
    if (/set status = 'failed'/.test(text)) {
      state.status = "failed";
      state.deliveryError = values[2] as string;
      return [];
    }
    throw new Error(`consulta inesperada: ${text}`);
  };
  const db = {
    organizationId: ORG,
    transaction: async <T>(fn: (sql: { query: typeof query }) => Promise<T>) => fn({ query }),
  } as unknown as TenantDb;
  return { db, state, queries };
}

function adapterThat(...results: (string | ChannelSendError)[]) {
  const send = vi.fn<(message: NormalizedOutbound) => Promise<{ providerMessageId: string }>>();
  for (const result of results) {
    if (typeof result === "string") send.mockResolvedValueOnce({ providerMessageId: result });
    else send.mockRejectedValueOnce(result);
  }
  const adapter = {
    channel: "whatsapp",
    capabilities: { maxTextLength: 4096, maxButtons: 3, templates: true, serviceWindowHours: 24, deliveryReceipts: true },
    verify: () => Promise.resolve(null),
    parse: () => ({ messages: [], statuses: [] }),
    send,
  } satisfies ChannelAdapter;
  return { adapter, send };
}

const event: DomainEvent = {
  id: "0e000000-0000-4000-8000-000000000001",
  type: "message.outbound",
  organizationId: ORG,
  locationId: null,
  payload: { conversation_id: CONV, message_id: MSG },
  sourceRunId: null,
  chainDepth: 0,
  createdAt: "2026-11-13T10:00:00Z",
};

function ctx(db: TenantDb): EventContext {
  return { db, logger, step: (_name, fn) => fn() };
}

async function deliver(db: TenantDb, adapter: ChannelAdapter | null) {
  const handler = createChannelSendHandler({ adapters: new Map(adapter ? [["whatsapp", adapter]] : []), retryDelaysMs: [0, 0] });
  await handler.handle(event, ctx(db));
}

const unknown502 = () => new ChannelSendError("HTTP 502", true, "http_502", { outcomeUnknown: true });
const timeout = () => new ChannelSendError("timeout", true, "timeout", { outcomeUnknown: true });
const network = () => new ChannelSendError("red", true, "network", { outcomeUnknown: true });
const rateLimited = () => new ChannelSendError("HTTP 429", true, "whatsapp:130429");
const outsideWindow = () => new ChannelSendError("HTTP 400", false, "whatsapp:131047");

describe("channels.send (O-01)", () => {
  it("se suscribe a message.outbound con su clave", () => {
    const handler = createChannelSendHandler({ adapters: new Map() });
    expect(handler.key).toBe(CHANNEL_SEND_HANDLER_KEY);
    expect(handler.eventTypes).toEqual(["message.outbound"]);
  });

  it("reclama el mensaje, lo envía una vez al teléfono del contacto con nuestra referencia, y lo guarda sent con el wamid", async () => {
    const { db, state } = fakeDb();
    const { adapter, send } = adapterThat("wamid.sent1");
    await deliver(db, adapter);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      channel: "whatsapp",
      accountExternalId: "106540352242922",
      to: { kind: "phone", value: "+34600111222" },
      text: "Te esperamos el sábado a las 10:00.",
      reference: MSG,
    });
    expect(state).toEqual({ status: "sent", externalId: "wamid.sent1", deliveryError: null });
  });

  it.each([
    ["un 502", unknown502],
    ["un timeout", timeout],
    ["un corte de red", network],
  ])("con %s (resultado desconocido) envía una sola vez y lo deja «unknown», aunque sea retryable", async (_what, error) => {
    const { db, state } = fakeDb();
    const { adapter, send } = adapterThat(error(), "wamid.never");
    await deliver(db, adapter);
    expect(send).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ status: "unknown", externalId: null, deliveryError: null });
  });

  it("si DBOS repite el paso de envío después de un 502, no hay un segundo envío: ya no está pending", async () => {
    const { db } = fakeDb();
    const { adapter, send } = adapterThat(unknown502(), "wamid.never");
    const message = {
      channel: "whatsapp" as const,
      accountExternalId: "106540352242922",
      to: { kind: "phone" as const, value: "+34600111222" },
      text: "Hola",
      buttons: [],
      attachments: [],
      idempotencyKey: "k",
      reference: MSG,
    };
    await expect(claimAndSend(db, adapter, message, [0])).resolves.toEqual({ outcome: "unknown", code: "http_502" });
    // El mismo paso, otra vez (el proceso cayó antes de que DBOS guardara su resultado).
    await expect(claimAndSend(db, adapter, message, [0])).resolves.toEqual({ outcome: "not_pending" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("y si el proceso cayó después de enviar bien, repetir el paso tampoco envía otra vez", async () => {
    const { db } = fakeDb();
    const { adapter, send } = adapterThat("wamid.ok", "wamid.dup");
    const message = {
      channel: "whatsapp" as const,
      accountExternalId: "106540352242922",
      to: { kind: "phone" as const, value: "+34600111222" },
      text: "Hola",
      buttons: [],
      attachments: [],
      idempotencyKey: "k",
      reference: MSG,
    };
    await claimAndSend(db, adapter, message, [0]);
    await expect(claimAndSend(db, adapter, message, [0])).resolves.toEqual({ outcome: "not_pending" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("un rechazo seguro y pasajero (429) se reintenta: a la segunda, sent", async () => {
    const { db, state } = fakeDb();
    const { adapter, send } = adapterThat(rateLimited(), "wamid.second");
    await deliver(db, adapter);
    expect(send).toHaveBeenCalledTimes(2);
    expect(state.status).toBe("sent");
    expect(state.externalId).toBe("wamid.second");
  });

  it(`si el 429 sigue, como mucho ${String(SEND_ATTEMPTS)} intentos y después failed con el código`, async () => {
    const { db, state } = fakeDb();
    const { adapter, send } = adapterThat(rateLimited(), rateLimited(), rateLimited(), "wamid.never");
    await deliver(db, adapter);
    expect(send).toHaveBeenCalledTimes(SEND_ATTEMPTS);
    expect(state).toEqual({ status: "failed", externalId: null, deliveryError: "whatsapp:130429" });
  });

  it("un rechazo definitivo (fuera de la ventana de 24 h) no se reintenta: failed con el código", async () => {
    const { db, state } = fakeDb();
    const { adapter, send } = adapterThat(outsideWindow(), "wamid.never");
    await deliver(db, adapter);
    expect(send).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ status: "failed", externalId: null, deliveryError: "whatsapp:131047" });
  });

  it("si ya no está pending (otro intento lo reclamó, o ya salió), no envía nada", async () => {
    for (const status of ["unknown", "sent", "failed"]) {
      const { db, state } = fakeDb({ status });
      const { adapter, send } = adapterThat("wamid.never");
      await deliver(db, adapter);
      expect(send).not.toHaveBeenCalled();
      expect(state.status).toBe(status);
    }
  });

  it("sin el adaptador del canal (sin credenciales), no reclama ni envía: se queda pending", async () => {
    const { db, state, queries } = fakeDb();
    await deliver(db, null);
    expect(state.status).toBe("pending");
    expect(queries.some((text) => /set status/.test(text))).toBe(false);
  });

  it("sin teléfono del contacto, failed sin enviar; sin el mensaje, nada", async () => {
    const noPhone = fakeDb({ phone: null });
    const { adapter, send } = adapterThat("wamid.never");
    await deliver(noPhone.db, adapter);
    expect(send).not.toHaveBeenCalled();
    expect(noPhone.state).toEqual({ status: "failed", externalId: null, deliveryError: "no_recipient" });
    const missing = fakeDb({ found: false });
    await deliver(missing.db, adapter);
    expect(send).not.toHaveBeenCalled();
  });

  it("un payload que no es el de message.outbound lanza (no adivina el mensaje)", async () => {
    const { db } = fakeDb();
    const handler = createChannelSendHandler({ adapters: new Map() });
    await expect(handler.handle({ ...event, payload: { message_id: "x" } }, ctx(db))).rejects.toThrow();
  });
});
