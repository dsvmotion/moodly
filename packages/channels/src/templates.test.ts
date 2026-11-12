import { describe, expect, it } from "vitest";
import { TemplateError, pickTemplate, renderTemplate, templateArity, templateRef } from "./templates.js";
import type { MessageTemplate } from "./templates.js";

const reminder: MessageTemplate = {
  name: "recordatorio_cita",
  language: "es",
  category: "utility",
  body: "Hola {{1}}, te recordamos tu cita el {{2}}.",
  status: "approved",
};

describe("las plantillas (ADR 0052 §5)", () => {
  it("cuenta sus huecos y los rellena en orden", () => {
    expect(templateArity(reminder.body)).toBe(2);
    expect(renderTemplate(reminder, ["Ana", "lunes a las 9:00"])).toBe("Hola Ana, te recordamos tu cita el lunes a las 9:00.");
    expect(templateArity("Sin huecos")).toBe(0);
    expect(templateArity("{{1}} y otra vez {{1}}")).toBe(1);
  });

  it("con variables de más o de menos, o huecos salteados, no sale", () => {
    expect(() => renderTemplate(reminder, ["Ana"])).toThrow(TemplateError);
    expect(() => renderTemplate(reminder, ["Ana", "lunes", "extra"])).toThrow(TemplateError);
    expect(() => templateArity("Hola {{1}} y {{3}}")).toThrow(TemplateError);
    expect(() => templateRef(reminder, [])).toThrow(TemplateError);
  });

  it("solo elige plantillas aprobadas: por idioma exacto, por idioma base o por el de reserva", () => {
    const registry: MessageTemplate[] = [
      { ...reminder, language: "en", body: "Hi {{1}}, reminder for {{2}}." },
      reminder,
      { ...reminder, language: "ca", status: "pending" },
    ];
    expect(pickTemplate(registry, "recordatorio_cita", "es")?.language).toBe("es");
    expect(pickTemplate(registry, "recordatorio_cita", "es-ES")?.language).toBe("es");
    expect(pickTemplate(registry, "recordatorio_cita", "ca")).toBeNull();
    expect(pickTemplate(registry, "recordatorio_cita", "ca", "en")?.language).toBe("en");
    expect(pickTemplate(registry, "otra", "es")).toBeNull();
  });

  it("la referencia que sale lleva nombre, idioma y variables", () => {
    expect(templateRef(reminder, ["Ana", "lunes"])).toEqual({ name: "recordatorio_cita", language: "es", variables: ["Ana", "lunes"] });
  });
});
