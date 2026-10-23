import { describe, expect, it } from "vitest";
import { AGENT_TYPES } from "@repo/config";
import {
  AGENTS_NAV,
  isActive,
  isAgentKey,
  MAIN_NAV,
  RECORDS_NAV,
  SETTINGS_GROUPS,
  SETTINGS_NAV,
  SETTINGS_SECTIONS,
  settingsSectionBySlug,
} from "./navigation";

// Rutas canónicas del ADR 0023 y una entrada por destino (auditoría del
// frontend 2026-10-23, F-1 y F-6).
describe("navegación", () => {
  const all = [...MAIN_NAV, ...AGENTS_NAV, ...RECORDS_NAV, SETTINGS_NAV];

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

  it("hay una ventana por cada agente de serie, en el orden de AGENT_TYPES", () => {
    expect(AGENTS_NAV.map((agent) => agent.key)).toEqual(AGENT_TYPES.map((agent) => agent.key));
    for (const agent of AGENTS_NAV) {
      expect(agent.href).toBe(`/app/agentes/${agent.key}`);
      expect(agent.dotClass).toBe(`bg-agent-${agent.key}`);
    }
  });

  it("isAgentKey solo acepta los 4 de serie", () => {
    for (const { key } of AGENT_TYPES) expect(isAgentKey(key)).toBe(true);
    for (const value of ["marketing", "", "Reception", "admin/", "__proto__"]) expect(isAgentKey(value)).toBe(false);
  });

  it("Ajustes queda activo en cualquiera de sus secciones", () => {
    for (const section of SETTINGS_SECTIONS) expect(isActive(section.href, SETTINGS_NAV.href)).toBe(true);
    expect(isActive("/app/ajustes", SETTINGS_NAV.href)).toBe(true);
    expect(isActive("/app/ajustesx", SETTINGS_NAV.href)).toBe(false);
  });

  it("cada sección de Ajustes solo se marca a sí misma", () => {
    for (const section of SETTINGS_SECTIONS) {
      const active = SETTINGS_SECTIONS.filter((candidate) => isActive(section.href, candidate.href));
      expect(active.map((candidate) => candidate.key)).toEqual([section.key]);
    }
  });

  it("Ajustes tiene las 13 secciones de MANUAL §9.4 en 5 grupos, sin repetir tramo de URL", () => {
    expect(SETTINGS_GROUPS.map((group) => group.key)).toEqual(["personal", "people", "business", "ai", "security"]);
    expect(SETTINGS_SECTIONS.map((section) => section.slug).sort()).toEqual(
      ["auditoria", "equipo", "facturacion", "general", "integraciones", "modelos", "perfil", "plan", "preferencias", "privacidad", "roles", "sedes", "seguridad"],
    );
    expect(settingsSectionBySlug("sedes")?.key).toBe("locations");
    expect(settingsSectionBySlug("api")).toBeNull();
  });

  it("la ventana de un agente no activa la de otro", () => {
    const reception = "/app/agentes/reception";
    expect(isActive(reception, reception)).toBe(true);
    expect(isActive(reception, "/app/agentes/customer")).toBe(false);
    expect(isActive(reception, "/app/agentes")).toBe(true);
  });
});
