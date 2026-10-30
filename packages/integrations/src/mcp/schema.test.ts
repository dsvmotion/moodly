import { describe, expect, it } from "vitest";
import { closeObjects, toolInputSchema } from "./schema.js";

describe("closeObjects", () => {
  it("cierra los objetos que no dicen nada, también los anidados", () => {
    expect(
      closeObjects({
        type: "object",
        properties: { lead: { type: "object", properties: { name: { type: "string" } } }, tags: { type: "array", items: { type: "object" } } },
      }),
    ).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        lead: { type: "object", additionalProperties: false, properties: { name: { type: "string" } } },
        tags: { type: "array", items: { type: "object", additionalProperties: false } },
      },
    });
  });

  it("no toca un objeto que se abre a propósito", () => {
    const open = { type: "object", additionalProperties: true };
    expect(closeObjects(open)).toEqual(open);
  });

  it("no confunde una propiedad llamada «properties» o «type» con una palabra clave", () => {
    const schema = { type: "object", properties: { properties: { type: "string" }, type: { type: "string" } } };
    expect(closeObjects(schema)).toEqual({ ...schema, additionalProperties: false });
  });

  it("no cambia el esquema que recibe", () => {
    const schema = { type: "object", properties: {} };
    closeObjects(schema);
    expect(schema).toEqual({ type: "object", properties: {} });
  });
});

describe("toolInputSchema", () => {
  it("convierte un esquema normal en un objeto cerrado", () => {
    const input = toolInputSchema({ type: "object", properties: { name: { type: "string" } }, required: ["name"] });
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.schema.safeParse({ name: "Ana" }).success).toBe(true);
    expect(input.schema.safeParse({ name: "Ana", extra: 1 }).success).toBe(false);
    expect(input.schema.safeParse({}).success).toBe(false);
  });

  it("admite $ref locales", () => {
    const input = toolInputSchema({
      type: "object",
      properties: { when: { $ref: "#/$defs/Slot" } },
      $defs: { Slot: { type: "object", properties: { start: { type: "string" } } } },
    });
    expect(input.ok).toBe(true);
  });

  it.each([
    ["un destinatario (to)", { type: "object", properties: { to: { type: "string" }, body: { type: "string" } } }, /to: campo reservado/],
    [
      "un campo reservado anidado",
      { type: "object", properties: { lead: { type: "object", properties: { email: { type: "string" } } } } },
      /lead\.email: campo reservado/,
    ],
    ["el tenant", { type: "object", properties: { organizationId: { type: "string" } } }, /organizationId: campo reservado/],
    ["un objeto abierto a propósito", { type: "object", additionalProperties: true }, /claves no declaradas/],
    ["claves por patrón", { type: "object", patternProperties: { "^x": { type: "string" } } }, /claves abiertas/],
    ["un esquema vacío (cualquier cosa)", {}, /claves abiertas/],
    ["un $ref remoto", { type: "object", properties: { a: { $ref: "https://example.com/a.json" } } }, /no admitido/],
    ["una entrada que no es un objeto", { type: "string" }, /es un objeto/],
  ])("no admite %s", (_label, schema, problem) => {
    const input = toolInputSchema(schema);
    expect(input.ok).toBe(false);
    if (input.ok) return;
    expect(input.problems.join("\n")).toMatch(problem);
  });
});
