import { describe, expect, it } from "vitest";
import { hmacSha256Hex, metaHandshake, secretEquals, verifyHmacSha256, verifyMetaSignature } from "./signature.js";

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

describe("la comprobación del alta del webhook (Meta, hub.challenge)", () => {
  const token = "token-de-verificacion";
  const query = (values: Record<string, string>) => new URLSearchParams(values);

  it("con el token bueno devuelve el challenge tal cual", () => {
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "1158201444" }))).toBe("1158201444");
  });

  it("sin el token bueno, sin modo subscribe o con un challenge raro, nada", () => {
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "1" }))).toBeNull();
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.verify_token": `${token}x`, "hub.challenge": "1" }))).toBeNull();
    expect(metaHandshake(token, query({ "hub.mode": "unsubscribe", "hub.verify_token": token, "hub.challenge": "1" }))).toBeNull();
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.challenge": "1" }))).toBeNull();
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "<script>" }))).toBeNull();
    expect(metaHandshake(token, query({ "hub.mode": "subscribe", "hub.verify_token": token }))).toBeNull();
  });

  it("sin token configurado no acepta nada, ni un token vacío", () => {
    expect(metaHandshake("", query({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }))).toBeNull();
    expect(secretEquals("", "")).toBe(false);
    expect(secretEquals("a", "a")).toBe(true);
    expect(secretEquals("a", "ab")).toBe(false);
    expect(secretEquals("a", null)).toBe(false);
  });
});
