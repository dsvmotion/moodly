import type { ChannelCapabilities } from "./adapter.js";
import type { NormalizedOutbound } from "./message.js";

// Qué puede salir por un canal en este momento (ADR 0052 §4 y §5).

const HOUR_MS = 3_600_000;

/** Si la ventana de servicio sigue abierta: sin ventana, siempre; con ella, solo si el cliente escribió hace menos de esas horas. */
export function serviceWindowOpen(capabilities: ChannelCapabilities, lastInboundAt: Date | null, now: Date): boolean {
  if (capabilities.serviceWindowHours === null) return true;
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < capabilities.serviceWindowHours * HOUR_MS;
}

export type OutboundCheck = { ok: true } | { ok: false; reason: "text_too_long" | "too_many_buttons" | "templates_unsupported" | "window_closed" };

/**
 * Si este mensaje puede salir por este canal ahora: texto que quepa, botones
 * que admita y, fuera de la ventana de servicio, solo una plantilla.
 */
export function checkOutbound(
  message: NormalizedOutbound,
  capabilities: ChannelCapabilities,
  context: { lastInboundAt: Date | null; now: Date },
): OutboundCheck {
  if (message.template && !capabilities.templates) return { ok: false, reason: "templates_unsupported" };
  if (message.text !== undefined && message.text.length > capabilities.maxTextLength) return { ok: false, reason: "text_too_long" };
  if (message.buttons.length > capabilities.maxButtons) return { ok: false, reason: "too_many_buttons" };
  if (!message.template && !serviceWindowOpen(capabilities, context.lastInboundAt, context.now)) return { ok: false, reason: "window_closed" };
  return { ok: true };
}
