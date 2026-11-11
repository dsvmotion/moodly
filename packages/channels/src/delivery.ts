// Los estados de entrega de un mensaje que sale (ADR 0052 §4), los mismos que
// messages.status. Los avisos del proveedor llegan tarde, repetidos o
// desordenados: el estado solo avanza, y un fallo es definitivo.

export const DELIVERY_STATUSES = ["pending", "sent", "delivered", "read", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

const RANK: Record<DeliveryStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/**
 * El estado que queda al recibir un aviso. Nunca retrocede (un «delivered» que
 * llega después de un «read» no cambia nada), y un «failed» no se deshace. Un
 * «failed» después de «delivered» o «read» tampoco cuenta: el mensaje llegó.
 */
export function nextDeliveryStatus(current: DeliveryStatus, incoming: DeliveryStatus): DeliveryStatus {
  if (current === "failed") return "failed";
  if (incoming === "failed") return current === "delivered" || current === "read" ? current : "failed";
  return RANK[incoming] > RANK[current] ? incoming : current;
}

/** Un aviso de estado del proveedor, ya traducido por el adaptador. */
export interface DeliveryUpdate {
  /** El id del mensaje en el proveedor (messages.external_message_id). */
  providerMessageId: string;
  status: Exclude<DeliveryStatus, "pending">;
  at: string;
  /** El código del proveedor, sin texto libre (puede llevar datos). */
  errorCode?: string;
}
