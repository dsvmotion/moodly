import { describe, expect, it } from "vitest";
import { ChannelSendError } from "./adapter.js";
import { FAKE_ACCOUNT_HEADER, FAKE_SIGNATURE_HEADER, createFakeAdapter, fakeSignature } from "./fake.js";
import { normalizedOutboundSchema } from "./message.js";

const outbound = normalizedOutboundSchema.parse({
  channel: "webchat",
  accountExternalId: "w-1",
  to: { kind: "webchat", value: "s-1" },
  text: "Hola",
  idempotencyKey: "run-1:reply",
});

describe("el adaptador de prueba cumple el contrato", () => {
  it("sin la firma correcta no verifica", async () => {
    const adapter = createFakeAdapter({ secret: "s3cr3t" });
    await expect(adapter.verify({ headers: fakeSignature("s3cr3t", "{}"), rawBody: "{}" })).resolves.toEqual({ scope: "platform" });
    await expect(adapter.verify({ headers: fakeSignature("otra", "{}"), rawBody: "{}" })).resolves.toBeNull();
    await expect(adapter.verify({ headers: fakeSignature("s3cr3t", "{}"), rawBody: '{"x":1}' })).resolves.toBeNull();
    await expect(adapter.verify({ headers: { [FAKE_SIGNATURE_HEADER]: "s3cr3t" }, rawBody: "{}" })).resolves.toBeNull();
    await expect(adapter.verify({ headers: {}, rawBody: "{}" })).resolves.toBeNull();
  });

  it("con scope de cuenta, la firma cubre la cuenta y el cuerpo: cambiar la cuenta la invalida", async () => {
    const adapter = createFakeAdapter({ secret: "s3cr3t", scope: "account" });
    await expect(adapter.verify({ headers: fakeSignature("s3cr3t", "{}", "w-1"), rawBody: "{}" })).resolves.toEqual({
      scope: "account",
      accountExternalId: "w-1",
    });
    const forged = { ...fakeSignature("s3cr3t", "{}", "w-1"), [FAKE_ACCOUNT_HEADER]: "w-2" };
    await expect(adapter.verify({ headers: forged, rawBody: "{}" })).resolves.toBeNull();
    await expect(adapter.verify({ headers: fakeSignature("s3cr3t", "{}"), rawBody: "{}" })).resolves.toBeNull();
  });

  it("traduce mensajes y avisos de estado, y rechaza un mensaje mal formado", () => {
    const adapter = createFakeAdapter({ secret: "s" });
    const message = {
      channel: "webchat",
      accountExternalId: "w-1",
      providerEventId: "e-1",
      from: { kind: "webchat", value: "s-1" },
      receivedAt: "2026-11-11T10:00:00Z",
      text: "Hola",
    };
    const status = { providerMessageId: "fake-1", status: "delivered", at: "2026-11-11T10:00:05Z" };
    const parsed = adapter.parse({ headers: {}, rawBody: JSON.stringify({ messages: [message], statuses: [status] }) });
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.statuses).toEqual([status]);
    expect(() => adapter.parse({ headers: {}, rawBody: JSON.stringify({ messages: [{ ...message, text: "" }] }) })).toThrow();
  });

  it("con la misma clave, un envío: un reintento devuelve el mismo id del proveedor", async () => {
    const adapter = createFakeAdapter({ secret: "s" });
    const first = await adapter.send(outbound);
    const again = await adapter.send(outbound);
    expect(again).toEqual(first);
    expect(adapter.sent).toHaveLength(1);
  });

  it("un fallo del proveedor dice si se puede reintentar", async () => {
    const adapter = createFakeAdapter({ secret: "s" });
    adapter.failNextSend(new ChannelSendError("límite de ritmo", true, "429"));
    await expect(adapter.send(outbound)).rejects.toMatchObject({ name: "ChannelSendError", retryable: true, providerCode: "429" });
    await expect(adapter.send(outbound)).resolves.toEqual({ providerMessageId: "fake-1" });
  });
});
