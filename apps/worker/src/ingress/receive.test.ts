import { createFakeAdapter, fakeSignature } from "@repo/channels/testing";
import type { ServiceDb } from "@repo/db/service";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { MAX_INBOUND_PAYLOAD_BYTES, receiveWebhook } from "./receive.ts";

// La entrada de un webhook, sin base de datos: un ServiceDb falso que apunta
// qué se resolvió y qué se insertó, y en qué organización.
const SECRET = "secreto-de-la-plataforma";
const ORG = "0a000000-0000-4000-8000-000000000001";
const OTHER_ORG = "0b000000-0000-4000-8000-000000000002";
const logger = pino({ level: "silent" });

function message(overrides: Record<string, unknown> = {}) {
  return {
    channel: "webchat",
    accountExternalId: "widget-1",
    providerEventId: "evt-1",
    providerMessageId: "m-1",
    from: { kind: "webchat", value: "visitor-1" },
    receivedAt: "2026-11-11T10:00:00Z",
    text: "Hola",
    ...overrides,
  };
}

function webhook(body: object, secret = SECRET) {
  const rawBody = JSON.stringify(body);
  return { headers: fakeSignature(secret, rawBody), rawBody };
}

function fakeDb(
  options: {
    account?: { id: string; organizationId: string; status: "active" | "pending" | "disabled" } | null;
    existingStatus?: string;
    existingErrorCode?: string;
    /** El error con el que falla el insert de un evento, por su providerEventId. */
    insertErrors?: Record<string, string>;
    /** Cuántos mensajes encuentra un aviso de estado (1 por defecto). */
    statusMatches?: number;
    /** El error con el que falla aplicar un aviso de estado. */
    statusError?: string;
  } = {},
) {
  const resolve = vi.fn().mockResolvedValue(options.account === undefined ? { id: "acc-1", organizationId: ORG, status: "active" } : options.account);
  const inserts: { org: string; row: unknown }[] = [];
  const statusUpdates: { org: string; values: readonly unknown[] }[] = [];
  // Como moodly_worker, por SQL en una transacción de la organización (20261112230000).
  const forOrganization = vi.fn((org: string) => ({
    organizationId: org,
    transaction: async <T>(fn: (sql: { query: (text: string, values?: readonly unknown[]) => Promise<unknown[]> }) => Promise<T>) =>
      fn({
        query: (text: string, values: readonly unknown[] = []) => {
          if (/^\s*update public\.messages/.test(text)) {
            statusUpdates.push({ org, values });
            if (options.statusError) return Promise.reject(Object.assign(new Error("pg"), { code: options.statusError }));
            return Promise.resolve(Array.from({ length: options.statusMatches ?? 1 }, (_, i) => ({ id: `msg-${i}` })));
          }
          if (/^\s*insert into public\.inbound_events/.test(text)) {
            const row = {
              organization_id: values[0],
              channel_account_id: values[1],
              provider_event_id: values[2] as string,
              payload: JSON.parse(values[3] as string) as unknown,
            };
            inserts.push({ org, row });
            const failure = options.insertErrors?.[row.provider_event_id];
            if (failure) return Promise.reject(Object.assign(new Error("pg"), { code: failure }));
            // on conflict do nothing: un evento repetido no devuelve fila.
            return Promise.resolve(options.existingStatus ? [] : [{ id: `ie-${inserts.length}` }]);
          }
          return Promise.resolve([{ id: "ie-old", status: options.existingStatus, error_code: options.existingErrorCode ?? null }]);
        },
      }),
  }));
  const db = { channelAccounts: { resolve }, forOrganization, outbox: {} } as unknown as ServiceDb;
  return { db, resolve, forOrganization, inserts, statusUpdates };
}

function deps(db: ServiceDb) {
  const startIngest = vi.fn().mockResolvedValue(undefined);
  return { deps: { db, adapters: new Map([["webchat", createFakeAdapter({ secret: SECRET })]]), startIngest, logger }, startIngest };
}

describe("la entrada de un webhook (ADR 0052 §2)", () => {
  it("un canal sin adaptador es 404, sin mirar nada más", async () => {
    const { db, resolve } = fakeDb();
    const { deps: d } = deps(db);
    await expect(receiveWebhook("whatsapp", webhook({ messages: [message()] }), d)).resolves.toMatchObject({ status: 404 });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("con la firma mal, 401 y no se resuelve ninguna cuenta: nadie sin firma pregunta qué cuentas existen", async () => {
    const { db, resolve, forOrganization } = fakeDb();
    const { deps: d, startIngest } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()] }, "otro-secreto"), d)).resolves.toMatchObject({ status: 401 });
    const body = JSON.stringify({ messages: [message()] });
    await expect(receiveWebhook("webchat", { headers: {}, rawBody: body }, d)).resolves.toMatchObject({ status: 401 });
    expect(resolve).not.toHaveBeenCalled();
    expect(forOrganization).not.toHaveBeenCalled();
    expect(startIngest).not.toHaveBeenCalled();
  });

  it("firmado pero mal formado: 400, sin resolver nada", async () => {
    const { db, resolve } = fakeDb();
    const { deps: d } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message({ text: "" })] }), d)).resolves.toMatchObject({ status: 400 });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("la organización sale de la cuenta resuelta, nunca del payload", async () => {
    const { db, resolve, forOrganization, inserts } = fakeDb();
    const { deps: d, startIngest } = deps(db);
    const result = await receiveWebhook("webchat", webhook({ messages: [message({ organizationId: OTHER_ORG, organization_id: OTHER_ORG })] }), d);
    expect(result).toEqual({ status: 200, accepted: 1, duplicates: 0, ignored: 0 });
    expect(resolve).toHaveBeenCalledWith("webchat", "widget-1");
    expect(forOrganization.mock.calls.map(([org]) => org)).toEqual([ORG]);
    expect(inserts).toEqual([
      { org: ORG, row: expect.objectContaining({ organization_id: ORG, channel_account_id: "acc-1", provider_event_id: "evt-1" }) },
    ]);
    expect(startIngest).toHaveBeenCalledWith({ organizationId: ORG, inboundEventId: "ie-1" });
  });

  it("una cuenta que no existe, pendiente o desactivada no guarda nada (y responde 200: no hay nada que reintentar)", async () => {
    for (const account of [null, { id: "a", organizationId: ORG, status: "pending" as const }, { id: "a", organizationId: ORG, status: "disabled" as const }]) {
      const { db, forOrganization } = fakeDb({ account });
      const { deps: d, startIngest } = deps(db);
      await expect(receiveWebhook("webchat", webhook({ messages: [message()] }), d)).resolves.toEqual({ status: 200, accepted: 0, duplicates: 0, ignored: 1 });
      expect(forOrganization).not.toHaveBeenCalled();
      expect(startIngest).not.toHaveBeenCalled();
    }
  });

  it("una firma de la cuenta A no vale para un mensaje que nombra a la B: no se resuelve ni se guarda nada", async () => {
    const { db, resolve, forOrganization } = fakeDb();
    const startIngest = vi.fn().mockResolvedValue(undefined);
    const adapters = new Map([["webchat", createFakeAdapter({ secret: SECRET, scope: "account" })]]);
    const rawBody = JSON.stringify({ messages: [message({ accountExternalId: "widget-B" })] });
    const result = await receiveWebhook("webchat", { headers: fakeSignature(SECRET, rawBody, "widget-A"), rawBody }, { db, adapters, startIngest, logger });
    expect(result).toEqual({ status: 200, accepted: 0, duplicates: 0, ignored: 1 });
    expect(resolve).not.toHaveBeenCalled();
    expect(forOrganization).not.toHaveBeenCalled();
    expect(startIngest).not.toHaveBeenCalled();

    // Y la misma firma, para un mensaje de su cuenta, sí.
    const ownBody = JSON.stringify({ messages: [message({ accountExternalId: "widget-A" })] });
    const own = await receiveWebhook("webchat", { headers: fakeSignature(SECRET, ownBody, "widget-A"), rawBody: ownBody }, { db, adapters, startIngest, logger });
    expect(own).toMatchObject({ accepted: 1 });
    expect(resolve).toHaveBeenCalledWith("webchat", "widget-A");
  });

  it("un mensaje de otro canal dentro del webhook se ignora", async () => {
    const { db, resolve } = fakeDb();
    const { deps: d } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message({ channel: "whatsapp" })] }), d)).resolves.toMatchObject({ ignored: 1 });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("un evento repetido ya procesado no arranca nada; uno que se quedó sin procesar, sí (con el mismo id de workflow)", async () => {
    const done = fakeDb({ existingStatus: "processed" });
    const first = deps(done.db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()] }), first.deps)).resolves.toEqual({ status: 200, accepted: 0, duplicates: 1, ignored: 0 });
    expect(first.startIngest).not.toHaveBeenCalled();

    const stuck = fakeDb({ existingStatus: "received" });
    const second = deps(stuck.db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()] }), second.deps)).resolves.toMatchObject({ duplicates: 1 });
    expect(second.startIngest).toHaveBeenCalledWith({ organizationId: ORG, inboundEventId: "ie-old" });
  });

  it("un evento repetido que ya acabó en dead_letter no se vuelve a lanzar: lo mira una persona", async () => {
    const dead = fakeDb({ existingStatus: "failed", existingErrorCode: "dead_letter" });
    const { deps: d, startIngest } = deps(dead.db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()] }), d)).resolves.toEqual({ status: 200, accepted: 0, duplicates: 1, ignored: 0 });
    expect(startIngest).not.toHaveBeenCalled();
  });

  it("un mensaje que falla no tira el lote: lo pasajero da 500 al final (el proveedor repite), lo permanente se ignora", async () => {
    const { db, inserts } = fakeDb({ insertErrors: { "evt-a": "08006", "evt-c": "23514" } });
    const { deps: d, startIngest } = deps(db);
    const body = {
      messages: [
        message({ providerEventId: "evt-a", providerMessageId: "m-a" }),
        message({ providerEventId: "evt-b", providerMessageId: "m-b" }),
        message({ providerEventId: "evt-c", providerMessageId: "m-c" }),
      ],
    };
    const result = await receiveWebhook("webchat", webhook(body), d);
    // Los tres se intentaron, uno detrás de otro, aunque el primero fallara.
    expect(inserts.map((insert) => (insert.row as { provider_event_id: string }).provider_event_id)).toEqual(["evt-a", "evt-b", "evt-c"]);
    expect(result).toEqual({ status: 500, accepted: 1, duplicates: 0, ignored: 1 });
    expect(startIngest).toHaveBeenCalledTimes(1);
  });

  it("si solo hay errores permanentes, 200: reintentar no lo arregla", async () => {
    const { db } = fakeDb({ insertErrors: { "evt-1": "23514" } });
    const { deps: d, startIngest } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()] }), d)).resolves.toEqual({ status: 200, accepted: 0, duplicates: 0, ignored: 1 });
    expect(startIngest).not.toHaveBeenCalled();
  });

  it("si no se puede arrancar el workflow de un mensaje, los demás siguen y al final 500 (lo guardado no se duplica)", async () => {
    const { db } = fakeDb();
    const { deps: d, startIngest } = deps(db);
    startIngest.mockRejectedValueOnce(new Error("dbos caído"));
    const body = { messages: [message({ providerEventId: "evt-a" }), message({ providerEventId: "evt-b", providerMessageId: "m-b" })] };
    await expect(receiveWebhook("webchat", webhook(body), d)).resolves.toEqual({ status: 500, accepted: 1, duplicates: 0, ignored: 0 });
    expect(startIngest).toHaveBeenCalledTimes(2);
  });

  it("un mensaje que no cabe en inbound_events (64 KB) se ignora antes de resolver nada; el resto del lote sigue", async () => {
    const { db, resolve, inserts } = fakeDb();
    const { deps: d, startIngest } = deps(db);
    // Válido para el esquema, pero los caracteres de control se escapan (\u0001: 6 bytes) y pasa del límite.
    const control = "\u0001".repeat(1024);
    const huge = message({
      providerEventId: "evt-big",
      text: control.repeat(9),
      attachments: Array.from({ length: 10 }, (_, index) => ({ kind: "image", providerRef: `ref-${index}`, caption: control })),
    });
    expect(Buffer.byteLength(JSON.stringify(huge), "utf8")).toBeGreaterThan(MAX_INBOUND_PAYLOAD_BYTES);
    const result = await receiveWebhook("webchat", webhook({ messages: [huge, message({ providerEventId: "evt-ok" })] }), d);
    expect(result).toEqual({ status: 200, accepted: 1, duplicates: 0, ignored: 1 });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
    expect(startIngest).toHaveBeenCalledTimes(1);
  });
});

describe("los avisos de estado (ADR 0052 §4)", () => {
  const status = (overrides: Record<string, unknown> = {}) => ({
    channel: "webchat",
    accountExternalId: "widget-1",
    providerMessageId: "out-1",
    status: "delivered",
    at: "2026-11-11T10:00:05Z",
    ...overrides,
  });

  it("se aplica al mensaje que salió, en la organización de la cuenta que lo envió y solo en sus conversaciones", async () => {
    const { db, resolve, forOrganization, statusUpdates } = fakeDb();
    const { deps: d, startIngest } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ statuses: [status()] }), d)).resolves.toEqual({
      status: 200,
      accepted: 0,
      duplicates: 0,
      ignored: 0,
    });
    expect(resolve).toHaveBeenCalledWith("webchat", "widget-1");
    expect(forOrganization.mock.calls.map(([org]) => org)).toEqual([ORG]);
    // organización, cuenta, id del proveedor, estado y código.
    expect(statusUpdates).toEqual([{ org: ORG, values: [ORG, "acc-1", "out-1", "delivered", null] }]);
    expect(startIngest).not.toHaveBeenCalled();
  });

  it("un fallo lleva su código; los demás avisos, ninguno", async () => {
    const { db, statusUpdates } = fakeDb();
    const { deps: d } = deps(db);
    await receiveWebhook("webchat", webhook({ statuses: [status({ status: "failed", errorCode: "fake:131047" })] }), d);
    expect(statusUpdates[0]?.values).toEqual([ORG, "acc-1", "out-1", "failed", "fake:131047"]);
  });

  it("un aviso de un mensaje que no se conoce, o de una cuenta que no existe, se confirma sin tocar nada", async () => {
    const unmatched = fakeDb({ statusMatches: 0 });
    await expect(receiveWebhook("webchat", webhook({ statuses: [status()] }), deps(unmatched.db).deps)).resolves.toMatchObject({ status: 200 });
    const noAccount = fakeDb({ account: null });
    await expect(receiveWebhook("webchat", webhook({ statuses: [status()] }), deps(noAccount.db).deps)).resolves.toMatchObject({ status: 200 });
    expect(noAccount.forOrganization).not.toHaveBeenCalled();
    expect(noAccount.statusUpdates).toEqual([]);
  });

  it("una cuenta desactivada sigue recibiendo los avisos de lo que ya envió", async () => {
    const { db, statusUpdates } = fakeDb({ account: { id: "acc-1", organizationId: ORG, status: "disabled" } });
    await receiveWebhook("webchat", webhook({ statuses: [status()] }), deps(db).deps);
    expect(statusUpdates).toHaveLength(1);
  });

  it("con la firma de una cuenta, el aviso de otra se ignora sin resolverla; el de otro canal también", async () => {
    const { db, resolve, statusUpdates } = fakeDb();
    const adapter = createFakeAdapter({ secret: SECRET });
    const signed = (body: object) => {
      const rawBody = JSON.stringify(body);
      return { headers: fakeSignature(SECRET, rawBody, "widget-1"), rawBody };
    };
    const d = { ...deps(db).deps, adapters: new Map([["webchat", adapter]]) };
    await receiveWebhook("webchat", signed({ statuses: [status({ accountExternalId: "widget-2" })] }), d);
    await receiveWebhook("webchat", webhook({ statuses: [status({ channel: "whatsapp" })] }), d);
    expect(resolve).not.toHaveBeenCalled();
    expect(statusUpdates).toEqual([]);
  });

  it("si la base de datos falla de forma pasajera, 500 para que el proveedor lo repita; si no lo admite, se confirma", async () => {
    const transient = fakeDb({ statusError: "08006" });
    await expect(receiveWebhook("webchat", webhook({ statuses: [status()] }), deps(transient.db).deps)).resolves.toMatchObject({ status: 500 });
    const permanent = fakeDb({ statusError: "23514" });
    await expect(receiveWebhook("webchat", webhook({ statuses: [status()] }), deps(permanent.db).deps)).resolves.toMatchObject({ status: 200 });
  });

  it("los mensajes y los avisos del mismo webhook se atienden los dos", async () => {
    const { db, inserts, statusUpdates } = fakeDb();
    const { deps: d } = deps(db);
    await expect(receiveWebhook("webchat", webhook({ messages: [message()], statuses: [status()] }), d)).resolves.toMatchObject({
      status: 200,
      accepted: 1,
    });
    expect(inserts).toHaveLength(1);
    expect(statusUpdates).toHaveLength(1);
  });
});
