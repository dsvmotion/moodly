import { describe, expect, it } from "vitest";
import { CONNECT_SESSION_TTL_MS, displayStatus } from "./status";

const NOW = new Date("2026-11-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("displayStatus", () => {
  it("sin fila, sin conectar", () => {
    expect(displayStatus(undefined, NOW)).toBe("none");
  });

  it("una pendiente reciente sigue pendiente", () => {
    expect(displayStatus({ status: "pending", updated_at: ago(60_000) }, NOW)).toBe("pending");
  });

  it("una pendiente más vieja que la sesión de Nango se enseña caducada (salida: reconectar o desconectar)", () => {
    expect(displayStatus({ status: "pending", updated_at: ago(CONNECT_SESSION_TTL_MS + 1) }, NOW)).toBe("expired");
  });

  it("los demás estados no caducan", () => {
    for (const status of ["active", "error", "disconnected"]) {
      expect(displayStatus({ status, updated_at: ago(10 * CONNECT_SESSION_TTL_MS) }, NOW)).toBe(status);
    }
  });
});
