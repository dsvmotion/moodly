import { constants, createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";

// El alta de la clave de una integración con clave del cliente (ADR 0055 §1):
// la web la cifra hacia el worker y la deja en integration_secret_submissions.
//
// - Cifrado de sobre: una clave de datos aleatoria cifra el valor con
//   AES-256-GCM; la clave de datos se cifra con la parte pública de la clave
//   de ingreso (RSA-OAEP con SHA-256). La web solo tiene la parte pública: no
//   puede descifrar nada.
// - Dato asociado: organización, integración, envío y proveedor. Un envío
//   copiado a otra organización, integración o envío no se descifra.
// - El worker abre el envío con la clave que dice la fila (key_ref), pero solo
//   si está en su lista de claves aceptadas (nota de V10): así una rotación no
//   depende del orden en que se cambian la web y el worker, y un key_ref que no
//   es nuestro no le hace usar otra clave.
// - En staging y producción la parte privada vive en AWS KMS (sin verificar en
//   real todavía; apps/worker/src/secrets/kms.ts); en desarrollo y tests, un
//   par local con la misma interfaz.
//
// El valor en claro solo existe en memoria: nunca se registra ni va a un error.

const IV_BYTES = 12;
const TAG_BYTES = 16;
const DATA_KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** El largo de una clave de API que se acepta (Koibox y las que vengan). */
export const SUBMITTED_KEY_MIN = 8;
export const SUBMITTED_KEY_MAX = 512;

/** De qué envío es: va entero en el dato asociado. Lo pone el servidor, nunca el cliente. */
export interface SubmissionContext {
  organizationId: string;
  integrationId: string;
  submissionId: string;
  provider: string;
}

/** Lo que se guarda en integration_secret_submissions (base64 salvo la referencia). */
export interface SealedSubmission {
  keyRef: string;
  encryptedDataKey: string;
  ciphertext: string;
}

/** La parte pública de la clave de ingreso que usa la web (configuración, no secreta). */
export interface IngressPublicKey {
  keyRef: string;
  /** SubjectPublicKeyInfo en DER, en base64 (lo que devuelve kms:GetPublicKey). */
  spkiDerBase64: string;
}

/** El envío no se puede abrir: otra clave, otro contexto, un byte cambiado o un valor que no vale. */
export class SubmissionRejectedError extends Error {
  override readonly name = "SubmissionRejectedError";
}

/**
 * La clave de ingreso no responde ahora (KMS: red, límites, permisos): no dice
 * nada del envío, así que no se descarta y quien llama lo reintenta.
 */
export class IngressKeyUnavailableError extends Error {
  override readonly name = "IngressKeyUnavailableError";
}

export function submissionAad(context: SubmissionContext): string {
  return `${context.organizationId}|${context.integrationId}|${context.submissionId}|${context.provider}`;
}

/** Comprueba la forma de la clave pegada, sin decir nada de su contenido. */
export function isAcceptableSubmittedKey(value: string): boolean {
  return value.length >= SUBMITTED_KEY_MIN && value.length <= SUBMITTED_KEY_MAX && /^[\x21-\x7e]+$/.test(value);
}

export function sealSubmission(publicKey: IngressPublicKey, context: SubmissionContext, plaintext: string): SealedSubmission {
  if (!isAcceptableSubmittedKey(plaintext)) throw new SubmissionRejectedError("la clave no tiene una forma válida");
  const key = createPublicKey({ key: Buffer.from(publicKey.spkiDerBase64, "base64"), format: "der", type: "spki" });
  const dataKey = randomBytes(DATA_KEY_BYTES);
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
    cipher.setAAD(Buffer.from(submissionAad(context), "utf8"));
    const body = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
    const encryptedDataKey = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey);
    return {
      keyRef: publicKey.keyRef,
      encryptedDataKey: encryptedDataKey.toString("base64"),
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64"),
    };
  } finally {
    dataKey.fill(0);
  }
}

/**
 * Las claves de ingreso que acepta el worker. unwrap descifra la clave de datos
 * con la parte privada (KMS o local); solo se llama con un keyRef que accepts.
 */
export interface IngressKeyring {
  accepts(keyRef: string): boolean;
  unwrap(keyRef: string, encryptedDataKey: Buffer): Promise<Buffer>;
}

/** Un par local por cada keyRef (desarrollo y tests; nunca en staging ni producción). */
export function createLocalIngressKeyring(keys: readonly { keyRef: string; privateKeyPem: string }[]): IngressKeyring {
  const byRef = new Map(keys.map((k) => [k.keyRef, createPrivateKey(k.privateKeyPem)]));
  return {
    accepts: (keyRef) => byRef.has(keyRef),
    unwrap(keyRef, encryptedDataKey) {
      const key = byRef.get(keyRef);
      if (!key) return Promise.reject(new SubmissionRejectedError("clave de ingreso no aceptada"));
      try {
        return Promise.resolve(privateDecrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, encryptedDataKey));
      } catch {
        return Promise.reject(new SubmissionRejectedError("la clave de datos no se puede descifrar con esta clave de ingreso"));
      }
    },
  };
}

/** Abre un envío. Lanza SubmissionRejectedError si no se puede (nunca con el valor ni el detalle). */
export async function openSubmission(keyring: IngressKeyring, context: SubmissionContext, sealed: SealedSubmission): Promise<string> {
  if (!keyring.accepts(sealed.keyRef)) throw new SubmissionRejectedError("clave de ingreso no aceptada");
  if (!BASE64.test(sealed.encryptedDataKey) || !BASE64.test(sealed.ciphertext)) {
    throw new SubmissionRejectedError("el envío no tiene la forma esperada");
  }
  const raw = Buffer.from(sealed.ciphertext, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new SubmissionRejectedError("el envío no tiene la forma esperada");
  let dataKey: Buffer;
  try {
    dataKey = await keyring.unwrap(sealed.keyRef, Buffer.from(sealed.encryptedDataKey, "base64"));
  } catch (err) {
    // Un fallo pasajero de la clave de ingreso se reintenta; lo demás es que el envío no se abre.
    if (err instanceof IngressKeyUnavailableError) throw err;
    throw new SubmissionRejectedError("la clave de datos no se puede descifrar");
  }
  try {
    if (dataKey.length !== DATA_KEY_BYTES) throw new SubmissionRejectedError("la clave de datos no tiene el tamaño esperado");
    const decipher = createDecipheriv("aes-256-gcm", dataKey, raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(submissionAad(context), "utf8"));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    let plaintext: string;
    try {
      plaintext = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    } catch {
      // GCM no dice por qué: otra organización, otra integración, otro envío o un byte cambiado.
      throw new SubmissionRejectedError("el envío no se descifra con este contexto");
    }
    if (!isAcceptableSubmittedKey(plaintext)) throw new SubmissionRejectedError("la clave no tiene una forma válida");
    return plaintext;
  } finally {
    dataKey.fill(0);
  }
}
