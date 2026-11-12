import { describe, expect, it } from "vitest";
import type { ChannelCapabilities } from "./adapter.js";
import { normalizedOutboundSchema } from "./message.js";
import { checkOutbound, serviceWindowOpen } from "./outbound.js";

const whatsapp: ChannelCapabilities = { maxTextLength: 4096, maxButtons: 3, templates: true, serviceWindowHours: 24, deliveryReceipts: true };
const webchat: ChannelCapabilities = { maxTextLength: 4096, maxButtons: 5, templates: false, serviceWindowHours: null, deliveryReceipts: false };
const now = new Date("2026-11-11T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const message = (fields: Record<string, unknown>) =>
  normalizedOutboundSchema.parse({ channel: "whatsapp", accountExternalId: "a", to: { kind: "phone", value: "+34600000001" }, idempotencyKey: "k", ...fields });

describe("qué puede salir por un canal (ADR 0052 §4 y §5)", () => {
  it("la ventana de servicio de 24 h se abre con el último mensaje del cliente", () => {
    expect(serviceWindowOpen(whatsapp, hoursAgo(1), now)).toBe(true);
    expect(serviceWindowOpen(whatsapp, hoursAgo(24), now)).toBe(false);
    expect(serviceWindowOpen(whatsapp, null, now)).toBe(false);
    expect(serviceWindowOpen(webchat, null, now)).toBe(true);
  });

  it("dentro de la ventana sale el texto libre; fuera, solo una plantilla", () => {
    expect(checkOutbound(message({ text: "Hola" }), whatsapp, { lastInboundAt: hoursAgo(2), now })).toEqual({ ok: true });
    expect(checkOutbound(message({ text: "Hola" }), whatsapp, { lastInboundAt: hoursAgo(30), now })).toEqual({ ok: false, reason: "window_closed" });
    expect(checkOutbound(message({ template: { name: "recordatorio", language: "es" } }), whatsapp, { lastInboundAt: null, now })).toEqual({ ok: true });
  });

  it("un canal sin plantillas no las envía; el texto y los botones tienen que caber", () => {
    expect(checkOutbound(message({ template: { name: "r", language: "es" } }), webchat, { lastInboundAt: null, now })).toEqual({
      ok: false,
      reason: "templates_unsupported",
    });
    expect(checkOutbound(message({ text: "x".repeat(4097) }), whatsapp, { lastInboundAt: hoursAgo(1), now })).toEqual({ ok: false, reason: "text_too_long" });
    const buttons = [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `Opción ${n}` }));
    expect(checkOutbound(message({ text: "Elige", buttons }), whatsapp, { lastInboundAt: hoursAgo(1), now })).toEqual({ ok: false, reason: "too_many_buttons" });
  });
});
