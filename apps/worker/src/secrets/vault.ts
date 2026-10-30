import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Secretos de cada organización con cifrado de sobre (ADR 0034, sobre el 0019
// §4 y MANUAL §10.4). Cada secreto tiene su propia clave de datos, que cifra
// el valor con AES-256-GCM y la organización como dato asociado; la clave
// maestra (AWS KMS en eu-central-1, o una clave local en desarrollo) cifra la
// clave de datos, también ligada a la organización. Un secreto copiado a otra
// organización, o con un solo byte cambiado, no se descifra.
//
// Solo el worker descifra, en el momento de usar el secreto. El valor en claro
// nunca se escribe en la base de datos ni en los logs.

/** Lo que se guarda en public.integration_secrets (todo en base64 salvo la referencia). */
export interface SealedSecret {
  keyRef: string;
  encryptedDataKey: string;
  ciphertext: string;
}

/** La clave maestra: AWS KMS en staging y producción; local en desarrollo y tests. */
export interface KeyProvider {
  /** Qué clave maestra usa para cifrar (se guarda junto al secreto). */
  readonly keyRef: string;
  wrap(dataKey: Buffer, organizationId: string): Promise<string>;
  unwrap(encryptedDataKey: string, organizationId: string, keyRef: string): Promise<Buffer>;
}

export class SecretDecryptionError extends Error {
  override name = "SecretDecryptionError";
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const raw = Buffer.from(sealed, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new SecretDecryptionError("texto cifrado demasiado corto");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  } catch {
    // GCM no distingue por qué: otra organización, otra clave o un byte cambiado.
    throw new SecretDecryptionError("el secreto no se puede descifrar con esta organización y esta clave");
  }
}

export interface SecretVault {
  seal(organizationId: string, plaintext: string): Promise<SealedSecret>;
  open(organizationId: string, sealed: SealedSecret): Promise<string>;
}

export function createSecretVault(keys: KeyProvider): SecretVault {
  return {
    async seal(organizationId, plaintext) {
      const dataKey = randomBytes(32);
      try {
        return {
          keyRef: keys.keyRef,
          encryptedDataKey: await keys.wrap(dataKey, organizationId),
          ciphertext: seal(dataKey, Buffer.from(plaintext, "utf8"), organizationId),
        };
      } finally {
        dataKey.fill(0);
      }
    },
    async open(organizationId, sealed) {
      const dataKey = await keys.unwrap(sealed.encryptedDataKey, organizationId, sealed.keyRef);
      try {
        return open(dataKey, sealed.ciphertext, organizationId).toString("utf8");
      } finally {
        dataKey.fill(0);
      }
    },
  };
}

/**
 * Clave maestra local, para desarrollo y tests (nunca en staging ni en
 * producción, que usan AWS KMS). La clave son 32 bytes en base64, en una
 * variable de entorno del worker local; la organización va como dato asociado,
 * igual que el contexto de cifrado de KMS.
 */
export function createLocalKeyProvider(masterKeyBase64: string, version = "v1"): KeyProvider {
  const masterKey = Buffer.from(masterKeyBase64, "base64");
  if (masterKey.length !== 32) throw new Error("la clave maestra local tiene que ser de 32 bytes en base64");
  const keyRef = `local:${version}`;
  return {
    keyRef,
    wrap: (dataKey, organizationId) => Promise.resolve(seal(masterKey, dataKey, `${keyRef}|${organizationId}`)),
    unwrap: (encryptedDataKey, organizationId, ref) => {
      if (ref !== keyRef) return Promise.reject(new SecretDecryptionError(`el secreto se cifró con otra clave maestra (${ref})`));
      try {
        return Promise.resolve(open(masterKey, encryptedDataKey, `${keyRef}|${organizationId}`));
      } catch (error) {
        return Promise.reject(error as Error);
      }
    },
  };
}
