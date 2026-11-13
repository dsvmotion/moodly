import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_SECTIONS, LEGACY_SETTINGS_SLUGS, legacyRedirects } from "./legacy-routes";
import { SETTINGS_SECTIONS } from "./navigation";

const appDir = resolve(import.meta.dirname, "../app/app");

describe("redirecciones de las rutas en español (ADR 0041)", () => {
  it("cada sección redirige a una ruta que existe, y la vieja ya no existe", () => {
    for (const [es, en] of Object.entries(LEGACY_SECTIONS)) {
      expect(existsSync(resolve(appDir, en)), en).toBe(true);
      expect(existsSync(resolve(appDir, es)), es).toBe(false);
    }
    expect(existsSync(resolve(appDir, "ajustes"))).toBe(false);
  });

  it("cada sección de Ajustes renombrada va a una de la navegación", () => {
    const slugs = SETTINGS_SECTIONS.map((section) => section.slug);
    for (const en of Object.values(LEGACY_SETTINGS_SLUGS)) expect(slugs).toContain(en);
    // Las que no cambian de nombre las cubre la regla general; services (OA04) es nueva y no tuvo ruta en español.
    const renamed = new Set(Object.values(LEGACY_SETTINGS_SLUGS));
    expect(slugs.filter((slug) => !renamed.has(slug)).sort()).toEqual(["general", "plan", "roles", "services"]);
  });

  it("las concretas van antes que la general de Ajustes, y todas son temporales", () => {
    const redirects = legacyRedirects();
    const general = redirects.findIndex((r) => r.source === "/app/ajustes/:path*");
    const concrete = redirects.filter((r) => r.source.startsWith("/app/ajustes/") && !r.source.includes(":"));
    expect(concrete).toHaveLength(Object.keys(LEGACY_SETTINGS_SLUGS).length);
    for (const r of concrete) expect(redirects.indexOf(r)).toBeLessThan(general);
    expect(redirects.every((r) => r.permanent === false)).toBe(true);
    expect(redirects.find((r) => r.source === "/app/invitacion/:path*")?.destination).toBe("/app/invitation/:path*");
  });
});
