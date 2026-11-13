import { z } from "zod";
import { CHANNELS } from "./message.js";

// Los estados de entrega de un mensaje que sale (ADR 0052 §4), los mismos que
// messages.status. Los avisos del proveedor llegan tarde, repetidos o
// desordenados: el estado solo avanza, y un fallo es definitivo. Las mismas
// reglas que private.next_delivery_status en la base de datos (la matriz de
// delivery.test.ts es la misma que la de 41_inbound_events.test.sql).

// «unknown» es de quien envía, no del proveedor: el envío salió y no se sabe si
// el proveedor lo recibió (un corte de red, un timeout, un 5xx). No se reintenta
// (podría duplicarse al cliente): queda para una persona, o lo concilia el
// primer aviso del proveedor que llegue, que siempre gana.
export const DELIVERY_STATUSES = ["pending", "sent", "delivered", "read", "failed", "unknown"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

const RANK: Record<Exclude<DeliveryStatus, "unknown">, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/**
 * El estado que queda al recibir un aviso. Nunca retrocede (un «delivered» que
 * llega después de un «read» no cambia nada), y un «failed» no se deshace. Un
 * «failed» después de «delivered» o «read» tampoco cuenta: el mensaje llegó.
 * «unknown» no es definitivo: cualquier aviso del proveedor lo resuelve.
 */
export function nextDeliveryStatus(current: DeliveryStatus | "received", incoming: DeliveryStatus): DeliveryStatus {
  if (current === "failed") return "failed";
  // Solo un envío que aún no había salido pasa a «no se sabe».
  if (incoming === "unknown") return current === "pending" || current === "received" ? "unknown" : current;
  // Desde «no se sabe», cualquier aviso del proveedor gana (no vuelve a pending).
  if (current === "unknown") return incoming === "pending" ? "unknown" : incoming;
  if (incoming === "failed") return current === "delivered" || current === "read" ? current : "failed";
  // «received» no es un estado de lo que sale: si aparece, gana el aviso (como en la base de datos).
  if (current === "received") return incoming;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

/**
 * Un aviso de estado del proveedor, ya traducido por el adaptador, con la
 * cuenta que lo envió. Se valida
 * antes de tocar la base de datos: un estado desconocido o un código de error
 * demasiado largo se rechaza aquí (y se confirma al proveedor), en vez de
 * fallar contra los checks de messages y volver a intentarlo para siempre.
 */
export const deliveryUpdateSchema = z.object({
  channel: z.enum(CHANNELS),
  /**
   * La cuenta del canal que envió el mensaje (channel_accounts.external_id),
   * como en lo que entra: de ella sale la organización, nunca de otro campo.
   */
  accountExternalId: z.string().min(1).max(200),
  /** El id del mensaje en el proveedor (messages.external_message_id). */
  providerMessageId: z.string().min(1).max(200),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  at: z.iso.datetime({ offset: true }),
  /** El código del proveedor, sin texto libre (puede llevar datos); lo que cabe en messages.delivery_error. */
  errorCode: z.string().min(1).max(100).regex(/^[\w.:-]+$/).optional(),
  /**
   * Nuestro id del mensaje, si el proveedor lo devuelve (en WhatsApp,
   * biz_opaque_callback_data): con él se concilia un aviso que llega antes de
   * guardar el id del proveedor, o el de un envío con resultado desconocido.
   */
  reference: z.uuid().optional(),
});
export type DeliveryUpdate = z.infer<typeof deliveryUpdateSchema>;
