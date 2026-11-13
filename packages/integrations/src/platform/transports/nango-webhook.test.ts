import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseNangoWebhook, signNangoWebhook, verifyNangoWebhook } from "./nango-webhook.js";

const SIGNING_KEY = "00000000-0000-4000-8000-00000000000a";
const BODY = JSON.stringify({
  type: "auth",
  operation: "creation",
  success: true,
  connectionId: "conn-1",
  providerConfigKey: "google-calendar",
  tags: { organization_id: "org-1", end_user_id: "user-1", integration_id: "int-1" },
});

describe("verifyNangoWebhook", () => {
  it("acepta la firma HMAC del cuerpo con la clave de firma", () => {
    expect(verifyNangoWebhook(BODY, signNangoWebhook(BODY, SIGNING_KEY), SIGNING_KEY)).toBe(true);
    expect(verifyNangoWebhook(Buffer.from(BODY), signNangoWebhook(BODY, SIGNING_KEY).toUpperCase(), SIGNING_KEY)).toBe(true);
  });

  it("rechaza otra clave", () => {
    expect(verifyNangoWebhook(BODY, signNangoWebhook(BODY, "otra-clave"), SIGNING_KEY)).toBe(false);
  });

  it("rechaza un cuerpo cambiado (un byte)", () => {
    const sig = signNangoWebhook(BODY, SIGNING_KEY);
    expect(verifyNangoWebhook(BODY.replace("org-1", "org-2"), sig, SIGNING_KEY)).toBe(false);
    expect(verifyNangoWebhook(`${BODY} `, sig, SIGNING_KEY)).toBe(false);
  });

  it("rechaza la firma antigua X-Nango-Signature (SHA-256 sin HMAC)", () => {
    const legacy = createHash("sha256").update(`${SIGNING_KEY}${BODY}`).digest("hex");
    expect(verifyNangoWebhook(BODY, legacy, SIGNING_KEY)).toBe(false);
  });

  it.each([undefined, null, "", "abc", "z".repeat(64), ["a", "b"]])("rechaza una cabecera %j", (header) => {
    expect(verifyNangoWebhook(BODY, header as string | undefined, SIGNING_KEY)).toBe(false);
  });

  it("sin clave de firma no acepta nada", () => {
    expect(verifyNangoWebhook(BODY, signNangoWebhook(BODY, ""), "")).toBe(false);
  });
});

describe("parseNangoWebhook", () => {
  it("lee el de auth", () => {
    expect(parseNangoWebhook(BODY)).toEqual({
      operation: "creation",
      success: true,
      connectionId: "conn-1",
      integrationKey: "google-calendar",
      tags: { organization_id: "org-1", end_user_id: "user-1", integration_id: "int-1" },
    });
  });

  it("los de otro tipo no son de este incremento", () => {
    expect(parseNangoWebhook(JSON.stringify({ type: "sync", connectionId: "c" }))).toBeNull();
    expect(parseNangoWebhook(JSON.stringify({ type: "auth", operation: "creation" }))).toBeNull();
  });

  it("lanza si no es JSON", () => {
    expect(() => parseNangoWebhook("no json")).toThrow();
  });
});
