import { describe, expect, it } from "vitest";
import { scramSha256Verifier } from "./scram.ts";

describe("scramSha256Verifier", () => {
  it("coincide con un cálculo independiente (hashlib de Python, RFC 5802)", () => {
    const salt = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
    expect(scramSha256Verifier("AAAAAAAAAAAAAAAAbbbbbbbb1234567890", salt)).toBe(
      "SCRAM-SHA-256$4096:AAECAwQFBgcICQoLDA0ODw==$f4Ai5oDSjYjVBE6XLoU0jDEJubafumopdvLpY26A/UE=:YUVAaOCXSM3optCB7SPZrnLqGs673tckPYuEIxe9ct4=",
    );
  });

  it("usa una sal nueva cada vez y no contiene la contraseña", () => {
    const password = "x".repeat(20) + "Y1".repeat(10);
    const a = scramSha256Verifier(password);
    const b = scramSha256Verifier(password);
    expect(a).not.toBe(b);
    expect(a).not.toContain(password);
  });

  it.each(["corta123", "con espacios y más de treinta y dos caracteres", "comilla'".repeat(5), "ñ".repeat(40)])(
    "rechaza la contraseña %j",
    (password) => {
      expect(() => scramSha256Verifier(password)).toThrow(/32 y 128 letras o dígitos/);
    },
  );
});
