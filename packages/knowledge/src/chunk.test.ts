import { describe, expect, it } from "vitest";
import { MAX_CHUNK_CHARS, chunkText } from "./chunk.js";

describe("el troceado de una fuente de texto", () => {
  it("un texto corto es un solo trozo, con el título delante", () => {
    expect(chunkText("Horario", "De lunes a viernes de 9:00 a 20:00.")).toEqual(["Horario\nDe lunes a viernes de 9:00 a 20:00."]);
  });

  it("junta párrafos cortos mientras quepan y separa los que no", () => {
    const body = ["Primero.", "Segundo.", "x".repeat(60)].join("\n\n");
    expect(chunkText("T", body, 40)).toEqual(["T\nPrimero.\n\nSegundo.", `T\n${"x".repeat(38)}`, `T\n${"x".repeat(22)}`]);
  });

  it("un párrafo largo se parte por frases, y una frase larga por palabras; ningún trozo pasa del máximo", () => {
    const sentence = "Esta frase tiene bastantes palabras para no caber entera.";
    const body = `${sentence} ${sentence} ${sentence}\n\n${"palabra ".repeat(80)}`;
    const chunks = chunkText("Precios del láser", body, 80);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80);
      expect(chunk.startsWith("Precios del láser\n")).toBe(true);
    }
    // No se pierde ni se inventa texto.
    const words = (text: string) => text.match(/[\p{L}\p{N}]+/gu) ?? [];
    expect(chunks.flatMap((chunk) => words(chunk.slice("Precios del láser\n".length)))).toEqual(words(body));
  });

  it("una palabra enorme (una URL, por ejemplo) se parte a cachos", () => {
    const chunks = chunkText("", "a".repeat(250), 100);
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
  });

  it("sin texto, sin trozos; los saltos de línea de Windows y los espacios de más no cuentan", () => {
    expect(chunkText("T", "  \n\n \r\n")).toEqual([]);
    expect(chunkText("T", "uno\r\n\r\ndos   tres")).toEqual(["T\nuno\n\ndos tres"]);
  });

  it("de serie, trozos de como mucho 1000 caracteres", () => {
    expect(MAX_CHUNK_CHARS).toBe(1000);
    for (const chunk of chunkText("Política", "Una frase normal. ".repeat(300))) expect(chunk.length).toBeLessThanOrEqual(1000);
  });
});
