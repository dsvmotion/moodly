import { describe, expect, it } from "vitest";
import {
  isActive,
  MAIN_NAV,
  RECORDS_NAV,
  SETTINGS_GROUPS,
  SETTINGS_NAV,
  SETTINGS_SECTIONS,
  settingsSectionBySlug,
} from "./navigation";

// Rutas canónicas (en inglés, ADR 0041) y una entrada por destino (auditoría del
// frontend 2026-10-23, F-1 y F-6).
describe("navegación", () => {
  const all = [...MAIN_NAV, ...RECORDS_NAV, SETTINGS_NAV];

  it("ningún destino aparece dos veces", () => {
    const hrefs = all.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    const keys = all.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todas las rutas cuelgan de /app y son estables (minúsculas, sin acentos)", () => {
    for (const { href } of [...all, ...SETTINGS_SECTIONS]) {
      expect(href).toMatch(/^\/app(\/[a-z]+)*$/);
    }
  });

  it("Ajustes queda activo en cualquiera de sus secciones", () => {
    for (const section of SETTINGS_SECTIONS) expect(isActive(section.href, SETTINGS_NAV.href)).toBe(true);
    expect(isActive("/app/settings", SETTINGS_NAV.href)).toBe(true);
    expect(isActive("/app/settingsx", SETTINGS_NAV.href)).toBe(false);
  });

  it("cada sección de Ajustes solo se marca a sí misma", () => {
    for (const section of SETTINGS_SECTIONS) {
      const active = SETTINGS_SECTIONS.filter((candidate) => isActive(section.href, candidate.href));
      expect(active.map((candidate) => candidate.key)).toEqual([section.key]);
    }
  });

  it("Ajustes tiene las 14 secciones de MANUAL §9.4 en 5 grupos, sin repetir tramo de URL", () => {
    expect(SETTINGS_GROUPS.map((group) => group.key)).toEqual(["personal", "people", "business", "ai", "security"]);
    // services: servicios, precios y equipo (OA04).
    expect(SETTINGS_SECTIONS.map((section) => section.slug).sort()).toEqual(
      ["audit", "billing", "general", "integrations", "locations", "models", "plan", "preferences", "privacy", "profile", "roles", "security", "services", "team"],
    );
    expect(settingsSectionBySlug("locations")?.key).toBe("locations");
    expect(settingsSectionBySlug("api")).toBeNull();
  });

  it("la ventana de un agente no activa la de otro", () => {
    const reception = "/app/agents/reception";
    expect(isActive(reception, reception)).toBe(true);
    expect(isActive(reception, "/app/agents/customer")).toBe(false);
    expect(isActive(reception, "/app/agents")).toBe(true);
  });
});
