import type { DeliveryUpdate } from "./delivery.js";
import type { Channel, NormalizedInbound, NormalizedOutbound } from "./message.js";

// El contrato de un canal (ADR 0052 §1): cada canal es un adaptador. Las reglas
// difíciles (duplicados, orden, toma de control, estados) viven fuera, una
// sola vez; el adaptador solo habla con su proveedor.

/** Lo que admite un canal. */
export interface ChannelCapabilities {
  /** El texto más largo que acepta un mensaje. */
  maxTextLength: number;
  /** Cuántos botones de respuesta rápida admite (0: ninguno). */
  maxButtons: number;
  /** Si tiene plantillas aprobadas por el proveedor. */
  templates: boolean;
  /** La ventana de servicio, en horas, desde el último mensaje del cliente (null: no tiene). Fuera de ella solo salen plantillas. */
  serviceWindowHours: number | null;
  /** Si el proveedor avisa de entregado y leído. */
  deliveryReceipts: boolean;
}

/** Una petición HTTP tal como llega, sin tocar: la firma se calcula sobre el cuerpo exacto. */
export interface RawWebhook {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: string;
}

/** Lo que trae un webhook, ya normalizado: mensajes nuevos y avisos de estado. */
export interface ParsedWebhook {
  messages: NormalizedInbound[];
  statuses: DeliveryUpdate[];
}

export interface SendResult {
  /** El id del mensaje en el proveedor: con él llegan después sus avisos de estado. */
  providerMessageId: string;
}

/** Un envío que no salió. retryable: si un reintento puede salir bien (red, 5xx, límite de ritmo). */
export class ChannelSendError extends Error {
  override name = "ChannelSendError";
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly providerCode?: string,
  ) {
    super(message);
  }
}

/** La firma no cuadra: el webhook no se procesa ni se guarda. */
export class InvalidSignatureError extends Error {
  override name = "InvalidSignatureError";
}

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: ChannelCapabilities;
  /** Comprueba la firma con el secreto de la cuenta. Sin firma válida, nada más. */
  verify(webhook: RawWebhook): Promise<boolean>;
  /** Traduce un webhook ya verificado. Lo que no entiende lo ignora; nunca inventa un tenant. */
  parse(webhook: RawWebhook): ParsedWebhook;
  /** Envía un mensaje ya validado. Idempotente con message.idempotencyKey cuando el proveedor lo permite. */
  send(message: NormalizedOutbound): Promise<SendResult>;
}
