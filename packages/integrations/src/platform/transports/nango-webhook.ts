import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Los webhooks de Nango (ADR 0053): la firma, antes que nada, y después la forma.
//
// - X-Nango-Hmac-Sha256 = HMAC-SHA256 en hexadecimal del cuerpo crudo, con la
//   clave de firma del entorno (Environment Settings → Webhooks → Signing key;
//   no es la clave secreta de la API). La cabecera antigua X-Nango-Signature
//   (SHA-256 sin HMAC) no se acepta.
// - Se compara en tiempo constante, y sobre los bytes tal cual llegaron: un
//   cuerpo que se parsea y se vuelve a serializar ya no es el que se firmó.
// - Solo se parsea un cuerpo con la firma buena. Lo que trae es de Nango, pero
//   el worker lo vuelve a comprobar contra la API (GET /connections) y contra
//   la fila antes de escribir nada.

export const NANGO_SIGNATURE_HEADER = "x-nango-hmac-sha256";

/** El cuerpo de un webhook no pasa de esto (los de auth ocupan unos cientos de bytes). */
export const NANGO_WEBHOOK_MAX_BYTES = 64 * 1024;

export function signNangoWebhook(rawBody: Uint8Array | string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(rawBody).digest("hex");
}

/** true solo si la firma es la del cuerpo con esa clave. Nunca lanza. */
export function verifyNangoWebhook(
  rawBody: Uint8Array | string,
  signature: string | string[] | undefined | null,
  signingKey: string,
): boolean {
  if (!signingKey || typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = Buffer.from(signNangoWebhook(rawBody, signingKey), "hex");
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const authWebhook = z.object({
  type: z.literal("auth"),
  operation: z.enum(["creation", "override", "refresh"]),
  success: z.boolean(),
  connectionId: z.string().min(1).max(255),
  providerConfigKey: z.string().min(1).max(255),
  tags: z.record(z.string(), z.string()).nullish(),
});

export interface NangoAuthWebhook {
  operation: "creation" | "override" | "refresh";
  success: boolean;
  connectionId: string;
  integrationKey: string;
  tags: Readonly<Record<string, string>>;
}

/**
 * Lee un webhook ya verificado. Devuelve el de auth, o null si es de otro tipo
 * (sync, forward…): esos no los atiende este incremento. Lanza si no es JSON.
 */
export function parseNangoWebhook(rawBody: Uint8Array | string): NangoAuthWebhook | null {
  const text = typeof rawBody === "string" ? rawBody : Buffer.from(rawBody).toString("utf8");
  const body: unknown = JSON.parse(text);
  const parsed = authWebhook.safeParse(body);
  if (!parsed.success) return null;
  return {
    operation: parsed.data.operation,
    success: parsed.data.success,
    connectionId: parsed.data.connectionId,
    integrationKey: parsed.data.providerConfigKey,
    tags: Object.freeze({ ...(parsed.data.tags ?? {}) }),
  };
}
