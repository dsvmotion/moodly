import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretDecryptionError, createLocalKeyProvider, createSecretVault } from "./vault.ts";

const ORG_A = "a0000000-0000-4000-8000-000000000000";
const ORG_B = "b0000000-0000-4000-8000-000000000000";
const masterKey = randomBytes(32).toString("base64");
const vault = createSecretVault(createLocalKeyProvider(masterKey));
// Valor de prueba sin forma de clave: gitleaks marca los que la tienen.
const PLAINTEXT = "valor de prueba, no es una clave";

function flip(base64: string, index: number): string {
  const bytes = Buffer.from(base64, "base64");
  bytes[index] = (bytes[index] ?? 0) ^ 0xff;
  return bytes.toString("base64");
}

describe("SecretVault (cifrado de sobre)", () => {
  it("descifra lo que cifró, para la misma organización", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    expect(await vault.open(ORG_A, sealed)).toBe(PLAINTEXT);
    expect(sealed.keyRef).toBe("local:v1");
  });

  it("lo guardado no contiene el secreto y va en base64", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    const stored = JSON.stringify(sealed);
    expect(stored).not.toContain(PLAINTEXT);
    expect(Buffer.from(sealed.ciphertext, "base64").toString("utf8")).not.toContain(PLAINTEXT);
    expect(sealed.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(sealed.encryptedDataKey).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("dos cifrados del mismo valor son distintos (clave de datos y IV nuevos)", async () => {
    const [one, two] = await Promise.all([vault.seal(ORG_A, PLAINTEXT), vault.seal(ORG_A, PLAINTEXT)]);
    expect(one.ciphertext).not.toBe(two.ciphertext);
    expect(one.encryptedDataKey).not.toBe(two.encryptedDataKey);
  });

  it("nunca repite el IV, tampoco al cifrar con la clave maestra (GCM no admite repetirlo con la misma clave)", async () => {
    const seals = await Promise.all(Array.from({ length: 20 }, () => vault.seal(ORG_A, PLAINTEXT)));
    const ivs = (field: "ciphertext" | "encryptedDataKey") =>
      new Set(seals.map((sealed) => Buffer.from(sealed[field], "base64").subarray(0, 12).toString("hex")));
    expect(ivs("encryptedDataKey").size).toBe(20);
    expect(ivs("ciphertext").size).toBe(20);
  });

  it("un secreto copiado a otra organización no se descifra", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    await expect(vault.open(ORG_B, sealed)).rejects.toThrow(SecretDecryptionError);
  });

  it("un byte cambiado en el texto cifrado no se descifra", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    await expect(vault.open(ORG_A, { ...sealed, ciphertext: flip(sealed.ciphertext, 30) })).rejects.toThrow(SecretDecryptionError);
  });

  it("un byte cambiado en la clave de datos cifrada no se descifra", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    await expect(vault.open(ORG_A, { ...sealed, encryptedDataKey: flip(sealed.encryptedDataKey, 20) })).rejects.toThrow(
      SecretDecryptionError,
    );
  });

  it("la clave de datos de un secreto no abre otro", async () => {
    const one = await vault.seal(ORG_A, PLAINTEXT);
    const two = await vault.seal(ORG_A, "otro-secreto");
    await expect(vault.open(ORG_A, { ...one, encryptedDataKey: two.encryptedDataKey })).rejects.toThrow(SecretDecryptionError);
  });

  it("con otra clave maestra no se descifra", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    const other = createSecretVault(createLocalKeyProvider(randomBytes(32).toString("base64")));
    await expect(other.open(ORG_A, sealed)).rejects.toThrow(SecretDecryptionError);
  });

  it("un secreto de otra versión de clave maestra se rechaza por su referencia", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    const v2 = createSecretVault(createLocalKeyProvider(masterKey, "v2"));
    await expect(v2.open(ORG_A, sealed)).rejects.toThrow(/otra clave maestra/);
  });

  it("un texto cifrado truncado se rechaza", async () => {
    const sealed = await vault.seal(ORG_A, PLAINTEXT);
    await expect(vault.open(ORG_A, { ...sealed, ciphertext: "AAAA" })).rejects.toThrow(SecretDecryptionError);
  });

  it("la clave maestra local tiene que ser de 32 bytes", () => {
    expect(() => createLocalKeyProvider(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("guarda Unicode sin perderlo", async () => {
    const value = "contraseña-ñ-€-😀";
    expect(await vault.open(ORG_A, await vault.seal(ORG_A, value))).toBe(value);
  });
});
