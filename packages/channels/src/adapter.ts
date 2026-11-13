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

/** A quién cubre una firma válida. */
export type VerifiedSender = { scope: "platform" } | { scope: "account"; accountExternalId: string };

/** Lo que trae un webhook, ya normalizado: mensajes nuevos y avisos de estado. */
export interface ParsedWebhook {
  messages: NormalizedInbound[];
  statuses: DeliveryUpdate[];
}

export interface SendResult {
  /** El id del mensaje en el proveedor: con él llegan después sus avisos de estado. */
  providerMessageId: string;
}

/**
 * Un envío que falló. retryable: si un reintento puede salir bien (red, 5xx,
 * límite de ritmo). outcomeUnknown: el proveedor pudo recibirlo y entregarlo
 * igualmente (corte de red, timeout, 5xx o respuesta sin id). Si además el
 * proveedor no acepta claves de idempotencia, quien envía no lo repite a
 * ciegas: un reintento podría duplicarlo al cliente.
 */
export class ChannelSendError extends Error {
  override name = "ChannelSendError";
  readonly outcomeUnknown: boolean;
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly providerCode?: string,
    options?: ErrorOptions & { outcomeUnknown?: boolean },
  ) {
    super(message, options);
    this.outcomeUnknown = options?.outcomeUnknown ?? false;
  }
}

/** La firma no cuadra: el webhook no se procesa ni se guarda. */
export class InvalidSignatureError extends Error {
  override name = "InvalidSignatureError";
}

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: ChannelCapabilities;
  /**
   * Comprueba la firma (en tiempo constante, con el secreto de la plataforma).
   * Sin firma válida, null y nada más. Con ella, a quién cubre: a toda la
   * plataforma (p. ej. Meta, que firma con el secreto de la app: cada mensaje
   * se atribuye por su propia cuenta) o a una sola cuenta (p. ej. el token del
   * chat web: solo valen los mensajes de esa cuenta).
   */
  verify(webhook: RawWebhook): Promise<VerifiedSender | null>;
  /**
   * La comprobación del webhook que hacen algunos proveedores al darlo de alta
   * (p. ej. el GET de Meta con hub.challenge): la respuesta en texto si la
   * petición es buena, null si no. Los canales sin ella no la definen.
   */
  handshake?(query: URLSearchParams): string | null;
  /** Traduce un webhook ya verificado. Lo que no entiende lo ignora; nunca inventa un tenant. */
  parse(webhook: RawWebhook): ParsedWebhook;
  /** Envía un mensaje ya validado. Idempotente con message.idempotencyKey cuando el proveedor lo permite. */
  send(message: NormalizedOutbound): Promise<SendResult>;
}
