import { describe, expect, it } from "vitest";
import { BODY_MAX, TITLE_MAX, createSourceSchema, deleteSourceSchema, updateSourceSchema } from "./schema";

const ID = "a0000000-0000-4000-8000-000000000001";

describe("formas de la pantalla de conocimiento (B20-3)", () => {
  it("crear: tipo de texto, toda la organización o un local, título y texto sin espacios en los extremos", () => {
    expect(createSourceSchema.parse({ type: "faq", locationId: "", title: "  Horarios ", body: "\n Abrimos a las 9.\n" })).toEqual({
      type: "faq",
      locationId: "",
      title: "Horarios",
      body: "Abrimos a las 9.",
    });
    expect(createSourceSchema.safeParse({ type: "pricing", locationId: ID, title: "Precios", body: "Láser: 60 €" }).success).toBe(true);
  });

  it("solo los tipos que se escriben a mano: documentos, web y respuestas del equipo llegan por otras vías", () => {
    for (const type of ["document", "website", "human_answer", "otro", ""]) {
      expect(createSourceSchema.safeParse({ type, locationId: "", title: "T", body: "B" }).success).toBe(false);
    }
  });

  it("el local es un id o vacío", () => {
    expect(createSourceSchema.safeParse({ type: "faq", locationId: "A1 Norte", title: "T", body: "B" }).success).toBe(false);
    expect(createSourceSchema.safeParse({ type: "faq", locationId: null, title: "T", body: "B" }).success).toBe(false);
  });

  it("los saltos de línea del navegador (\\r\\n) se guardan como \\n y cuentan como uno", () => {
    expect(updateSourceSchema.parse({ id: ID, title: "T", body: "uno\r\ndos\rtres" }).body).toBe("uno\ndos\ntres");
    // 20.001 caracteres en el formulario y 20.000 al guardarlo: cabe.
    const body = `${"a".repeat(9_999)}\r\n${"a".repeat(10_000)}`;
    expect(body).toHaveLength(BODY_MAX + 1);
    expect(updateSourceSchema.parse({ id: ID, title: "T", body }).body).toHaveLength(BODY_MAX);
  });

  it("límites de la tabla: título de 1 a 200 y texto de 1 a 20.000, sin contar los espacios de los extremos", () => {
    const ok = (title: string, body: string) => updateSourceSchema.safeParse({ id: ID, title, body }).success;
    expect(ok("x".repeat(TITLE_MAX), "x".repeat(BODY_MAX))).toBe(true);
    expect(ok(`  ${"x".repeat(TITLE_MAX)}  `, "b")).toBe(true);
    expect(ok("x".repeat(TITLE_MAX + 1), "b")).toBe(false);
    expect(ok("t", "x".repeat(BODY_MAX + 1))).toBe(false);
    expect(ok("   ", "b")).toBe(false);
    expect(ok("t", " \n ")).toBe(false);
  });

  it("cambiar y borrar piden el id de la fuente", () => {
    expect(updateSourceSchema.safeParse({ id: "1", title: "T", body: "B" }).success).toBe(false);
    expect(deleteSourceSchema.safeParse({ id: ID }).success).toBe(true);
    expect(deleteSourceSchema.safeParse({ id: "" }).success).toBe(false);
  });
});
