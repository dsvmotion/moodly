import { createFakeAdapter, fakeSignature } from "@repo/channels";
import type { ServiceDb } from "@repo/db/service";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { receiveWebhook } from "./receive.ts";

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

function fakeDb(options: { account?: { id: string; organizationId: string; status: "active" | "pending" | "disabled" } | null; existingStatus?: string } = {}) {
  const resolve = vi.fn().mockResolvedValue(options.account === undefined ? { id: "acc-1", organizationId: ORG, status: "active" } : options.account);
  const inserts: { org: string; row: unknown }[] = [];
  const forOrganization = vi.fn((org: string) => ({
    from: () => ({
      insert: (row: unknown) => {
        inserts.push({ org, row });
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                options.existingStatus ? { data: null, error: { code: "23505" } } : { data: { id: `ie-${inserts.length}` }, error: null },
              ),
          }),
        };
      },
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "ie-old", status: options.existingStatus }, error: null }) }) }) }),
    }),
  }));
  const db = { channelAccounts: { resolve }, forOrganization, outbox: {} } as unknown as ServiceDb;
  return { db, resolve, forOrganization, inserts };
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
    expect(inserts).toEqual([{ org: ORG, row: expect.objectContaining({ channel_account_id: "acc-1", provider_event_id: "evt-1" }) }]);
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
});
