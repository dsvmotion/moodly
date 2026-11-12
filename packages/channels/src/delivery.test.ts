import { describe, expect, it } from "vitest";
import { DELIVERY_STATUSES, nextDeliveryStatus } from "./delivery.js";

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
