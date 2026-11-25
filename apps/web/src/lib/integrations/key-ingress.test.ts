import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

const { getIngressPublicKey } = await import("./key-ingress");

const spki = (bits: number, type: "rsa" | "ec" = "rsa") =>
  (type === "rsa"
    ? generateKeyPairSync("rsa", { modulusLength: bits }).publicKey
    : generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey
  )
    .export({ format: "der", type: "spki" })
    .toString("base64");

describe("getIngressPublicKey", () => {
  const good = spki(2048);

  it("sin las dos variables no hay alta de claves", () => {
    expect(getIngressPublicKey({})).toBeNull();
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_PUBLIC_KEY: good })).toBeNull();
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_KEY_REF: "local:v1" })).toBeNull();
  });

  it("con una pública RSA de 2048 bits o más y su referencia, la clave", () => {
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_PUBLIC_KEY: good, INTEGRATION_INGRESS_KEY_REF: "local:v1" })).toEqual({
      keyRef: "local:v1",
      spkiDerBase64: good,
    });
    const arn = "arn:aws:kms:eu-west-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab";
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_PUBLIC_KEY: good, INTEGRATION_INGRESS_KEY_REF: arn })?.keyRef).toBe(arn);
  });

  it.each([
    ["no es base64 de una clave", "no-es-una-clave"],
    ["RSA de 1024 bits", spki(1024)],
    ["no es RSA", spki(0, "ec")],
  ])("una pública que no vale (%s) deja el alta sin activar", (_label, value) => {
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_PUBLIC_KEY: value, INTEGRATION_INGRESS_KEY_REF: "local:v1" })).toBeNull();
  });

  it("una referencia con caracteres raros, tampoco", () => {
    expect(getIngressPublicKey({ INTEGRATION_INGRESS_PUBLIC_KEY: good, INTEGRATION_INGRESS_KEY_REF: "local v1\n" })).toBeNull();
  });
});
