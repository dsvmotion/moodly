import { describe, expect, it } from "vitest";
import { hmacSha256Hex, verifyHmacSha256, verifyMetaSignature } from "./signature.js";

const body = '{"entry":[{"id":"1"}]}';
const secret = "s3cr3t";

describe("las firmas de los webhooks (ADR 0052 §2)", () => {
  it("acepta la firma HMAC-SHA256 del cuerpo exacto con el secreto", () => {
    expect(verifyHmacSha256(secret, body, hmacSha256Hex(secret, body))).toBe(true);
    expect(verifyHmacSha256(secret, body, hmacSha256Hex(secret, body).toUpperCase())).toBe(true);
  });

  it("rechaza otro secreto, un cuerpo cambiado en un byte, una firma corta, vacía o que no es hexadecimal", () => {
    const good = hmacSha256Hex(secret, body);
    expect(verifyHmacSha256("otro", body, good)).toBe(false);
    expect(verifyHmacSha256(secret, `${body} `, good)).toBe(false);
    expect(verifyHmacSha256(secret, body, good.slice(0, 63))).toBe(false);
    expect(verifyHmacSha256(secret, body, "")).toBe(false);
    expect(verifyHmacSha256(secret, body, undefined)).toBe(false);
    expect(verifyHmacSha256(secret, body, "z".repeat(64))).toBe(false);
  });

  it("sin secreto configurado no acepta nada, ni una firma «vacía»", () => {
    expect(verifyHmacSha256("", body, hmacSha256Hex("", body))).toBe(false);
  });

  it("la cabecera de Meta lleva «sha256=» delante", () => {
    const signature = hmacSha256Hex(secret, body);
    expect(verifyMetaSignature(secret, body, `sha256=${signature}`)).toBe(true);
    expect(verifyMetaSignature(secret, body, signature)).toBe(false);
    expect(verifyMetaSignature(secret, body, `sha1=${signature}`)).toBe(false);
    expect(verifyMetaSignature(secret, body, undefined)).toBe(false);
  });
});
