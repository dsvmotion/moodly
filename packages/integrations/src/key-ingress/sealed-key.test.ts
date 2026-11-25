import { generateKeyPairSync, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  IngressKeyUnavailableError,
  SubmissionRejectedError,
  createLocalIngressKeyring,
  isAcceptableSubmittedKey,
  openSubmission,
  sealSubmission,
  type IngressPublicKey,
  type SubmissionContext,
} from "./sealed-key.js";

function pair(keyRef: string) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    publicKey: { keyRef, spkiDerBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64") } satisfies IngressPublicKey,
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

const OLD = pair("local:v1");
const NEW = pair("local:v2");
// Una clave de mentira, armada sin un literal con forma de clave (gitleaks).
const KEY = ["kbx", "test", "0123456789", "abcdef"].join("_");

function context(): SubmissionContext {
  return { organizationId: randomUUID(), integrationId: randomUUID(), submissionId: randomUUID(), provider: "koibox" };
}

describe("sealSubmission / openSubmission", () => {
  it("la web cifra con la parte pública y el worker lo abre con la privada", async () => {
    const ctx = context();
    const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
    expect(sealed.keyRef).toBe("local:v1");
    expect(sealed.ciphertext).not.toContain(KEY);
    expect(Buffer.from(sealed.ciphertext, "base64").toString("utf8")).not.toContain(KEY);
    const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: OLD.privateKeyPem }]);
    await expect(openSubmission(keyring, ctx, sealed)).resolves.toBe(KEY);
  });

  it("cada envío cifra distinto (clave de datos e IV nuevos)", () => {
    const ctx = context();
    const a = sealSubmission(OLD.publicKey, ctx, KEY);
    const b = sealSubmission(OLD.publicKey, ctx, KEY);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.encryptedDataKey).not.toBe(b.encryptedDataKey);
  });

  it.each(["organizationId", "integrationId", "submissionId", "provider"] as const)(
    "un envío movido a otro %s no se descifra",
    async (field) => {
      const ctx = context();
      const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
      const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: OLD.privateKeyPem }]);
      const moved = { ...ctx, [field]: field === "provider" ? "otro" : randomUUID() };
      await expect(openSubmission(keyring, moved, sealed)).rejects.toBeInstanceOf(SubmissionRejectedError);
    },
  );

  it("con un byte cambiado no se descifra", async () => {
    const ctx = context();
    const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
    const raw = Buffer.from(sealed.ciphertext, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: OLD.privateKeyPem }]);
    await expect(openSubmission(keyring, ctx, { ...sealed, ciphertext: raw.toString("base64") })).rejects.toBeInstanceOf(
      SubmissionRejectedError,
    );
  });

  it("durante una rotación abre con la clave que dice el envío: la vieja y la nueva (nota de V10)", async () => {
    const keyring = createLocalIngressKeyring([
      { keyRef: "local:v1", privateKeyPem: OLD.privateKeyPem },
      { keyRef: "local:v2", privateKeyPem: NEW.privateKeyPem },
    ]);
    const a = context();
    const b = context();
    await expect(openSubmission(keyring, a, sealSubmission(OLD.publicKey, a, KEY))).resolves.toBe(KEY);
    await expect(openSubmission(keyring, b, sealSubmission(NEW.publicKey, b, KEY))).resolves.toBe(KEY);
  });

  it("un key_ref que no está en la lista no se usa, aunque la fila lo pida", async () => {
    const keyring = createLocalIngressKeyring([{ keyRef: "local:v2", privateKeyPem: NEW.privateKeyPem }]);
    const ctx = context();
    const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
    await expect(openSubmission(keyring, ctx, sealed)).rejects.toThrow("clave de ingreso no aceptada");
    // Ni haciéndose pasar por la que sí acepta: la clave de datos no se descifra con otra privada.
    await expect(openSubmission(keyring, ctx, { ...sealed, keyRef: "local:v2" })).rejects.toBeInstanceOf(SubmissionRejectedError);
  });

  it("si la clave de ingreso no responde (KMS caído), el error sale tal cual para reintentar, no como envío que no se abre", async () => {
    const ctx = context();
    const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
    const keyring = {
      accepts: () => true,
      unwrap: () => Promise.reject(new IngressKeyUnavailableError("KMS no respondió")),
    };
    await expect(openSubmission(keyring, ctx, sealed)).rejects.toBeInstanceOf(IngressKeyUnavailableError);
    // Cualquier otro error del keyring sí es «no se abre».
    await expect(openSubmission({ accepts: () => true, unwrap: () => Promise.reject(new Error("otro")) }, ctx, sealed)).rejects.toBeInstanceOf(
      SubmissionRejectedError,
    );
  });

  it("los errores no llevan ni la clave ni el texto cifrado", async () => {
    const ctx = context();
    const sealed = sealSubmission(OLD.publicKey, ctx, KEY);
    const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: OLD.privateKeyPem }]);
    const err = (await openSubmission(keyring, { ...ctx, provider: "otro" }, sealed).then(
      () => new Error("no falló"),
      (e: unknown) => e as Error,
    ));
    expect(err).toBeInstanceOf(SubmissionRejectedError);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain(sealed.ciphertext.slice(0, 16));
  });

  it("la forma de la clave: ni vacía, ni con espacios o controles, ni enorme", () => {
    expect(isAcceptableSubmittedKey(KEY)).toBe(true);
    expect(isAcceptableSubmittedKey("corta")).toBe(false);
    expect(isAcceptableSubmittedKey("con espacio 12345")).toBe(false);
    expect(isAcceptableSubmittedKey("ctrl\u0000123456789")).toBe(false);
    expect(isAcceptableSubmittedKey("x".repeat(513))).toBe(false);
    expect(() => sealSubmission(OLD.publicKey, context(), "corta")).toThrow(SubmissionRejectedError);
  });
});
