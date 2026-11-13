import { describe, expect, it } from "vitest";
import { PLATFORM_INTEGRATIONS, platformIntegration, platformIntegrationByKey, platformIntegrationsIn } from "./catalog.js";

describe("el catálogo de integraciones de plataforma", () => {
  it("cada proveedor y cada clave aparecen una sola vez (el webhook busca por clave)", () => {
    const providers = PLATFORM_INTEGRATIONS.map((e) => e.provider);
    const keys = PLATFORM_INTEGRATIONS.map((e) => e.integrationKey);
    expect(new Set(providers).size).toBe(providers.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("Outlook se pide con los permisos mínimos: leer el calendario y refrescar, nunca .default ni escritura", () => {
    const outlook = platformIntegration("outlook-calendar");
    expect(outlook).toMatchObject({ integrationKey: "outlook", category: "calendar" });
    expect(outlook?.scopes).toEqual(["offline_access", "Calendars.Read"]);
    expect(platformIntegrationByKey("outlook")).toBe(outlook);
    for (const entry of PLATFORM_INTEGRATIONS) {
      for (const scope of entry.scopes ?? []) {
        expect(scope).not.toMatch(/\.default$|ReadWrite|\.Write|Send/i);
      }
    }
  });

  it("los calendarios son Google y Outlook, en ese orden", () => {
    expect(platformIntegrationsIn("calendar").map((e) => e.provider)).toEqual(["google-calendar", "outlook-calendar"]);
  });

  it("no se puede modificar en tiempo de ejecución", () => {
    expect(Object.isFrozen(PLATFORM_INTEGRATIONS)).toBe(true);
    expect(Object.isFrozen(platformIntegration("outlook-calendar")?.scopes)).toBe(true);
  });

  it("lo que no está en el catálogo es undefined", () => {
    expect(platformIntegration("gmail")).toBeUndefined();
    expect(platformIntegration(42)).toBeUndefined();
    expect(platformIntegrationByKey("outlook-calendar")).toBeUndefined();
  });
});
