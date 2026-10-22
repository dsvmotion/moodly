import { describe, expect, it } from "vitest";
import { totp } from "./totp.ts";

// Vectores de prueba del RFC 6238 (apéndice B, SHA-1): la semilla es el texto
// ASCII "12345678901234567890", pasado aquí a base32 como lo entrega Auth. El RFC
// da 8 cifras y aquí se usan las 6 últimas.
function toBase32(bytes: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
const RFC6238_SEED = toBase32(Buffer.from("12345678901234567890", "ascii"));

describe("totp", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("t = %i s → %s", (seconds, code) => {
    expect(totp(RFC6238_SEED, seconds * 1000)).toBe(code);
  });

  it("rechaza un secreto que no es base32", () => {
    expect(() => totp("no-es-base32!")).toThrow();
  });
});
