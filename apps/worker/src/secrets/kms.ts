import { DecryptCommand, EncryptCommand, KMSClient, type DecryptCommandInput, type EncryptCommandInput } from "@aws-sdk/client-kms";
import { IngressKeyUnavailableError, SubmissionRejectedError, type IngressKeyring } from "@repo/integrations/key-ingress";
import { SecretDecryptionError, type KeyProvider } from "./vault.ts";

// AWS KMS para el worker en staging y producción (ADR 0034 y 0055; runbook
// docs/runbooks/kms-staging.md). Dos claves en eu-central-1:
//
// - SecretVault (simétrica): cifra la clave de datos de cada secreto con
//   kms:Encrypt y la abre con kms:Decrypt, siempre con el contexto de cifrado
//   {organization_id}. La política de IAM del worker solo deja usarla con ese
//   contexto. El ARN se guarda como key_ref de cada secreto; un secreto con otro
//   key_ref no se intenta abrir con esta clave.
// - Ingreso (asimétrica, RSA): solo kms:Decrypt con RSAES_OAEP_SHA_256 (el
//   mismo algoritmo con el que cifra la web). El worker acepta una lista de ARN
//   (dos durante una rotación) y abre cada envío con la clave que dice el envío,
//   solo si está en esa lista (nota de V10).
//
// Los ARN vienen de la configuración del worker (SECRET_VAULT_KMS_KEY_ID e
// INTEGRATION_INGRESS_KMS_KEY_IDS); las credenciales, de la cadena por defecto
// del SDK (AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en Railway). Nada de esto
// va a los logs, y los errores no llevan ni la clave de datos ni el texto
// cifrado.
//
// Sin verificar en real: falta crear las claves en staging (lo hace producto con
// el runbook).

/** Lo que el worker usa de KMS: Encrypt y Decrypt (inyectable en los tests). */
export interface KmsApi {
  encrypt(input: EncryptCommandInput): Promise<{ CiphertextBlob?: Uint8Array | undefined; KeyId?: string | undefined }>;
  decrypt(input: DecryptCommandInput): Promise<{ Plaintext?: Uint8Array | undefined; KeyId?: string | undefined }>;
}

/**
 * El cliente real. `endpoint` y `credentials` solo los usan los tests (un KMS
 * falso en loopback); en el worker, el endpoint de AWS de la región y las
 * credenciales del entorno.
 */
export function createKmsApi(
  region: string,
  testing?: { endpoint: string; credentials: { accessKeyId: string; secretAccessKey: string } },
): KmsApi {
  const client = new KMSClient({ region, maxAttempts: 3, ...(testing ?? {}) });
  return {
    encrypt: (input) => client.send(new EncryptCommand(input)),
    decrypt: (input) => client.send(new DecryptCommand(input)),
  };
}

const DATA_KEY_BYTES = 32;
export const INGRESS_ENCRYPTION_ALGORITHM = "RSAES_OAEP_SHA_256";

/** Los errores de KMS que dicen que el texto cifrado no es de esta clave o de este contexto. */
function isCiphertextError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return name === "InvalidCiphertextException" || name === "IncorrectKeyException";
}

/**
 * La clave maestra de SecretVault en KMS. Un error de KMS que no es del texto
 * cifrado (red, límites, permisos) se lanza tal cual: quien llama lo reintenta.
 */
export function createKmsKeyProvider(kms: KmsApi, keyArn: string): KeyProvider {
  return {
    keyRef: keyArn,
    async wrap(dataKey, organizationId) {
      const out = await kms.encrypt({ KeyId: keyArn, Plaintext: dataKey, EncryptionContext: { organization_id: organizationId } });
      if (!out.CiphertextBlob || out.CiphertextBlob.length === 0) throw new Error("KMS no devolvió la clave de datos cifrada");
      return Buffer.from(out.CiphertextBlob).toString("base64");
    },
    async unwrap(encryptedDataKey, organizationId, keyRef) {
      if (keyRef !== keyArn) throw new SecretDecryptionError("el secreto se cifró con otra clave maestra");
      let out: Awaited<ReturnType<KmsApi["decrypt"]>>;
      try {
        out = await kms.decrypt({
          KeyId: keyArn,
          CiphertextBlob: Buffer.from(encryptedDataKey, "base64"),
          EncryptionContext: { organization_id: organizationId },
        });
      } catch (err) {
        if (isCiphertextError(err)) throw new SecretDecryptionError("el secreto no se puede descifrar con esta organización y esta clave");
        throw err;
      }
      const dataKey = out.Plaintext ? Buffer.from(out.Plaintext) : null;
      if (!dataKey || dataKey.length !== DATA_KEY_BYTES || out.KeyId !== keyArn) {
        dataKey?.fill(0);
        throw new SecretDecryptionError("KMS devolvió una clave de datos que no es la esperada");
      }
      return dataKey;
    },
  };
}

/**
 * Las claves de ingreso aceptadas, en KMS. unwrap solo con un ARN de la lista,
 * solo con RSAES_OAEP_SHA_256 y comprobando que KMS usó esa misma clave. Un
 * texto cifrado que no es de la clave es un envío que no se abre; cualquier otro
 * fallo de KMS es pasajero (IngressKeyUnavailableError) y el paso lo reintenta.
 */
export function createKmsIngressKeyring(kms: KmsApi, acceptedArns: readonly string[]): IngressKeyring {
  const accepted = new Set(acceptedArns);
  return {
    accepts: (keyRef) => accepted.has(keyRef),
    async unwrap(keyRef, encryptedDataKey) {
      if (!accepted.has(keyRef)) throw new SubmissionRejectedError("clave de ingreso no aceptada");
      let out: Awaited<ReturnType<KmsApi["decrypt"]>>;
      try {
        out = await kms.decrypt({ KeyId: keyRef, CiphertextBlob: encryptedDataKey, EncryptionAlgorithm: INGRESS_ENCRYPTION_ALGORITHM });
      } catch (err) {
        if (isCiphertextError(err)) throw new SubmissionRejectedError("la clave de datos no se puede descifrar con esta clave de ingreso");
        throw new IngressKeyUnavailableError(`KMS no respondió al abrir el envío (${err instanceof Error ? err.name : "Error"})`);
      }
      if (!out.Plaintext || out.KeyId !== keyRef) throw new SubmissionRejectedError("KMS no abrió el envío con la clave esperada");
      return Buffer.from(out.Plaintext);
    },
  };
}
