import { CalendarUnavailableError, createFakeConnectorPlatform } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { createBusySource } from "./external-busy.ts";

// La parte del worker: createBusySource construye el lector del catálogo
// (CALENDAR_READERS) y le añade memo y tope de tiempo. El decorador y el
// filtrado se prueban en @repo/integrations (external-busy.test.ts); la
// resolución de la fila bajo RLS, en external-busy.integration.ts.

const CONNECTION = { provider: "google-calendar", connectionId: "conn-a", integrationKey: "google-calendar" };
const FROM = new Date("2026-11-14T09:00:00Z");
const TO = new Date("2026-11-14T11:00:00Z");

describe("createBusySource", () => {
  it("lee las horas ocupadas por el proxy de su conexión", async () => {
    const platform = createFakeConnectorPlatform({
      proxyResponse: () => ({ items: [{ id: "e1", start: { dateTime: "2026-11-14T09:00:00Z" }, end: { dateTime: "2026-11-14T09:30:00Z" } }] }),
    });
    platform.addConnection({ connectionId: CONNECTION.connectionId, integrationKey: CONNECTION.integrationKey, tags: {} });
    const busy = await createBusySource({ platform, ...CONNECTION }).list(FROM, TO);
    expect(busy).toEqual([{ startsAt: new Date("2026-11-14T09:00:00Z"), endsAt: new Date("2026-11-14T09:30:00Z") }]);
  });

  it("un fallo del proveedor se convierte en CalendarUnavailableError", async () => {
    const platform = createFakeConnectorPlatform({
      proxyResponse: () => {
        throw new Error("boom");
      },
    });
    platform.addConnection({ connectionId: CONNECTION.connectionId, integrationKey: CONNECTION.integrationKey, tags: {} });
    await expect(createBusySource({ platform, ...CONNECTION }).list(FROM, TO)).rejects.toBeInstanceOf(CalendarUnavailableError);
  });

  it("un proveedor que no está en el catálogo es un error de programación", () => {
    const platform = createFakeConnectorPlatform({});
    expect(() => createBusySource({ platform, provider: "inventado", connectionId: "c", integrationKey: "k" })).toThrow();
  });
});
