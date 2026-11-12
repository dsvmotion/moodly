import { describe, expect, it } from "vitest";
import { CUSTOMER_CHANNELS, TEAM_CHANNELS, isCustomerChannel, normalizedInboundSchema, normalizedOutboundSchema } from "./message.js";

const inbound = {
  channel: "whatsapp",
  accountExternalId: "phone-1",
  providerEventId: "evt-1",
  providerMessageId: "wamid.1",
  from: { kind: "phone", value: "+34600000001" },
  receivedAt: "2026-11-11T10:00:00Z",
  text: "Hola",
};

describe("el mensaje normalizado (ADR 0052 §1)", () => {
  it("dos familias que no se mezclan: canales del cliente y del equipo", () => {
    expect(CUSTOMER_CHANNELS.filter((channel) => (TEAM_CHANNELS as readonly string[]).includes(channel))).toEqual([]);
    expect(isCustomerChannel("whatsapp")).toBe(true);
    expect(isCustomerChannel("slack")).toBe(false);
  });

  it("lo que entra trae la cuenta y el id del evento del proveedor, sin adjuntos por defecto", () => {
    expect(normalizedInboundSchema.parse(inbound)).toMatchObject({ accountExternalId: "phone-1", providerEventId: "evt-1", attachments: [] });
  });

  it("un mensaje sin texto ni adjuntos no es un mensaje; con un adjunto, sí", () => {
    expect(normalizedInboundSchema.safeParse({ ...inbound, text: "   " }).success).toBe(false);
    expect(
      normalizedInboundSchema.safeParse({ ...inbound, text: "", attachments: [{ kind: "image", providerRef: "media-1" }] }).success,
    ).toBe(true);
  });

  it("no acepta más texto del que cabe en messages.content, ni una fecha sin zona", () => {
    expect(normalizedInboundSchema.safeParse({ ...inbound, text: "x".repeat(10_001) }).success).toBe(false);
    expect(normalizedInboundSchema.safeParse({ ...inbound, receivedAt: "2026-11-11 10:00" }).success).toBe(false);
  });

  it("lo que sale lleva texto o plantilla, nunca las dos cosas ni ninguna", () => {
    const base = { channel: "whatsapp", accountExternalId: "phone-1", to: { kind: "phone", value: "+34600000001" }, idempotencyKey: "k-1" };
    expect(normalizedOutboundSchema.safeParse({ ...base, text: "Hola" }).success).toBe(true);
    expect(normalizedOutboundSchema.safeParse({ ...base, template: { name: "recordatorio", language: "es" } }).success).toBe(true);
    expect(normalizedOutboundSchema.safeParse({ ...base, text: "Hola", template: { name: "recordatorio", language: "es" } }).success).toBe(false);
    expect(normalizedOutboundSchema.safeParse(base).success).toBe(false);
    expect(normalizedOutboundSchema.safeParse({ ...base, text: "  " }).success).toBe(false);
  });

  it("sin clave de idempotencia no sale nada", () => {
    expect(
      normalizedOutboundSchema.safeParse({ channel: "webchat", accountExternalId: "w", to: { kind: "webchat", value: "s-1" }, text: "Hola" }).success,
    ).toBe(false);
  });
});
