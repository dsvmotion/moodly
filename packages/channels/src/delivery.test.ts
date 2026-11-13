import { describe, expect, it } from "vitest";
import { DELIVERY_STATUSES, deliveryUpdateSchema, nextDeliveryStatus } from "./delivery.js";

describe("los estados de entrega (ADR 0052 §4)", () => {
  it("avanzan en orden: pending → sent → delivered → read", () => {
    expect(nextDeliveryStatus("pending", "sent")).toBe("sent");
    expect(nextDeliveryStatus("sent", "delivered")).toBe("delivered");
    expect(nextDeliveryStatus("delivered", "read")).toBe("read");
    expect(nextDeliveryStatus("pending", "read")).toBe("read");
  });

  it("un aviso que llega tarde o repetido no hace retroceder el estado", () => {
    expect(nextDeliveryStatus("read", "delivered")).toBe("read");
    expect(nextDeliveryStatus("read", "sent")).toBe("read");
    expect(nextDeliveryStatus("delivered", "delivered")).toBe("delivered");
  });

  it("un fallo antes de entregarse es definitivo; después de entregado o leído no cuenta", () => {
    expect(nextDeliveryStatus("sent", "failed")).toBe("failed");
    expect(nextDeliveryStatus("pending", "failed")).toBe("failed");
    expect(nextDeliveryStatus("delivered", "failed")).toBe("delivered");
    expect(nextDeliveryStatus("read", "failed")).toBe("read");
    for (const incoming of DELIVERY_STATUSES) expect(nextDeliveryStatus("failed", incoming)).toBe("failed");
  });
});

// La matriz entera, la misma literal que 41_inbound_events.test.sql comprueba
// contra private.next_delivery_status: el TypeScript y el SQL dicen lo mismo.
const MATRIX: [string, string, string][] = [
["received", "pending", "pending"],
["received", "sent", "sent"],
["received", "delivered", "delivered"],
["received", "read", "read"],
["received", "failed", "failed"],
["pending", "pending", "pending"],
["pending", "sent", "sent"],
["pending", "delivered", "delivered"],
["pending", "read", "read"],
["pending", "failed", "failed"],
["sent", "pending", "sent"],
["sent", "sent", "sent"],
["sent", "delivered", "delivered"],
["sent", "read", "read"],
["sent", "failed", "failed"],
["delivered", "pending", "delivered"],
["delivered", "sent", "delivered"],
["delivered", "delivered", "delivered"],
["delivered", "read", "read"],
["delivered", "failed", "delivered"],
["read", "pending", "read"],
["read", "sent", "read"],
["read", "delivered", "read"],
["read", "read", "read"],
["read", "failed", "read"],
["failed", "pending", "failed"],
["failed", "sent", "failed"],
["failed", "delivered", "failed"],
["failed", "read", "failed"],
["failed", "failed", "failed"],
];

describe("nextDeliveryStatus y la base de datos dicen lo mismo", () => {
  it.each(MATRIX)("%s + %s → %s", (current, incoming, expected) => {
    expect(nextDeliveryStatus(current as Parameters<typeof nextDeliveryStatus>[0], incoming as (typeof DELIVERY_STATUSES)[number])).toBe(expected);
  });
});

describe("deliveryUpdateSchema", () => {
  const update = { channel: "whatsapp", accountExternalId: "106540352242922", providerMessageId: "wamid.1", status: "delivered", at: "2026-11-11T10:00:00Z" };
  it("acepta un aviso bien formado, con o sin código de error", () => {
    expect(deliveryUpdateSchema.safeParse(update).success).toBe(true);
    expect(deliveryUpdateSchema.safeParse({ ...update, status: "failed", errorCode: "131026" }).success).toBe(true);
  });

  it("rechaza un estado desconocido (o pending), un código largo o con texto libre, y un id vacío", () => {
    expect(deliveryUpdateSchema.safeParse({ ...update, status: "deleted" }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, status: "pending" }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, errorCode: "x".repeat(101) }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, errorCode: "número no válido: +34 600" }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, providerMessageId: "" }).success).toBe(false);
  });

  it("rechaza un aviso sin la cuenta que lo envió, o de un canal que no existe", () => {
    expect(deliveryUpdateSchema.safeParse({ ...update, accountExternalId: undefined }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, accountExternalId: "" }).success).toBe(false);
    expect(deliveryUpdateSchema.safeParse({ ...update, channel: "fax" }).success).toBe(false);
  });
});
