import "server-only";
import { createPublicKey } from "node:crypto";
import type { IngressPublicKey } from "@repo/integrations/key-ingress";
import { logger } from "@/lib/observability/logger";

// La parte pública de la clave de ingreso (ADR 0055 §1): con ella la web cifra
// la clave de una integración hacia el worker, que es el único que la abre. No
// es secreta. En staging y producción es la de AWS KMS (kms:GetPublicKey); en
// local, la del par que genera `pnpm db:seed`.
// - INTEGRATION_INGRESS_PUBLIC_KEY: SubjectPublicKeyInfo en DER, en base64.
// - INTEGRATION_INGRESS_KEY_REF: qué clave es (el ARN de KMS o «local:v1»);
//   va con cada envío, y el worker solo abre los de las claves que acepta.
// Sin las dos, o si no son una clave RSA de 2048 bits o más, no hay alta de
// claves y la pantalla lo dice.

const KEY_REF = /^[A-Za-z0-9:/._-]{3,300}$/;

let cached: { raw: string; keyRef: string; key: IngressPublicKey } | null = null;

export function getIngressPublicKey(env: Record<string, string | undefined> = process.env): IngressPublicKey | null {
  const raw = env["INTEGRATION_INGRESS_PUBLIC_KEY"]?.trim();
  const keyRef = env["INTEGRATION_INGRESS_KEY_REF"]?.trim();
  if (!raw || !keyRef) return null;
  if (cached?.raw === raw && cached.keyRef === keyRef) return cached.key;
  if (!KEY_REF.test(keyRef)) {
    logger.error("INTEGRATION_INGRESS_KEY_REF no es válida: el alta de claves de integraciones no está disponible");
    return null;
  }
  try {
    const key = createPublicKey({ key: Buffer.from(raw, "base64"), format: "der", type: "spki" });
    const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
    if (key.asymmetricKeyType !== "rsa" || bits < 2048) throw new Error("no es una clave RSA de 2048 bits o más");
  } catch (err) {
    logger.error({ err }, "INTEGRATION_INGRESS_PUBLIC_KEY no es válida: el alta de claves de integraciones no está disponible");
    return null;
  }
  const key: IngressPublicKey = { keyRef, spkiDerBase64: raw };
  cached = { raw, keyRef, key };
  return key;
}
