import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_GROUPS, SETTINGS_SECTIONS } from "./navigation";

// Ajustes (P6): lo que promete la navegación existe. Una sección con contenido
// tiene su carpeta en app/app/ajustes/<slug>; una pendiente no la tiene (la
// atiende ajustes/[seccion], que dice qué habrá y con qué llega) y tiene sus
// textos en los dos idiomas.
const appDir = resolve(import.meta.dirname, "../app/app/ajustes");
const messages = (locale: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, `../../messages/${locale}.json`), "utf8")) as {
    settings: {
      groups: Record<string, string>;
      sections: Record<string, string>;
      pending: Record<string, { description?: string; what?: string } | string>;
    };
  };

describe("estructura de Ajustes", () => {
  it.each(SETTINGS_SECTIONS.map((section) => [section.slug, section.ready] as const))(
    "%s: carpeta propia solo si tiene contenido (ready=%s)",
    (slug, ready) => {
      expect(existsSync(resolve(appDir, slug, "page.tsx"))).toBe(ready);
    },
  );

  it("la ruta dinámica de las pendientes existe", () => {
    expect(existsSync(resolve(appDir, "[seccion]", "page.tsx"))).toBe(true);
  });

  it.each(["es", "en"])("textos completos en %s", (locale) => {
    const { settings } = messages(locale);
    for (const group of SETTINGS_GROUPS) expect(settings.groups[group.key], group.key).toBeTruthy();
    for (const section of SETTINGS_SECTIONS) {
      expect(settings.sections[section.key], section.key).toBeTruthy();
      const pending = settings.pending[section.key];
      if (section.ready) {
        expect(pending, `${section.key} tiene contenido: sin texto de pendiente`).toBeUndefined();
      } else {
        expect(typeof pending === "object" && pending.description && pending.what, section.key).toBeTruthy();
      }
    }
  });
});
