import { describe, expect, it } from "vitest";
import { CanonicalJsonError, canonicalHash, canonicalJson } from "./canonical.js";

describe("canonicalJson", () => {
  it("ordena las claves y no deja espacios, también en objetos anidados", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
    );
  });

  it("da el mismo texto con las claves en otro orden", () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it("conserva el orden de los arrays: [1,2] y [2,1] no son lo mismo", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("escapa como JSON y deja el Unicode tal cual", () => {
    expect(canonicalJson({ "ñ": 'Cita "urgente"\n', emoji: "😀" })).toBe('{"emoji":"😀","ñ":"Cita \\"urgente\\"\\n"}');
  });

  it("ordena las claves por unidades UTF-16, como RFC 8785", () => {
    expect(canonicalJson({ "é": 1, z: 2, A: 3 })).toBe('{"A":3,"z":2,"é":1}');
  });

  it("normaliza -0 a 0 y escribe los números como JSON", () => {
    expect(canonicalJson([-0, 1.5, 1e21, 100])).toBe("[0,1.5,1e+21,100]");
  });

  it.each([
    ["undefined", { a: undefined }],
    ["una función", { a: () => 1 }],
    ["un bigint", { a: 1n }],
    ["NaN", { a: Number.NaN }],
    ["Infinity", [Number.POSITIVE_INFINITY]],
    ["una fecha", { a: new Date(0) }],
    ["un Map", { a: new Map() }],
  ])("rechaza %s en vez de convertirlo en silencio", (_name, value) => {
    expect(() => canonicalJson(value)).toThrow(CanonicalJsonError);
  });

  it("acepta objetos sin prototipo", () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 });
    expect(canonicalJson(bare)).toBe('{"a":1}');
  });
});

describe("canonicalHash", () => {
  it("es el SHA-256 del texto canónico", () => {
    // echo -n '{"a":1}' | sha256sum
    expect(canonicalHash({ a: 1 })).toBe("015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862");
  });

  it("cambia si cambia un solo valor", () => {
    expect(canonicalHash({ amount: 100 })).not.toBe(canonicalHash({ amount: 1000 }));
  });
});
