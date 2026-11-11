import { createHmac, timingSafeEqual } from "node:crypto";

// Firmas de los webhooks (ADR 0052 §2): HMAC-SHA256 del cuerpo exacto, con el
// secreto de la plataforma para ese canal (variables del worker, nunca en los
// logs), comparado en tiempo constante. Se comprueba antes de mirar nada más:
// sin firma válida no se resuelve ninguna cuenta.

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/** La firma HMAC-SHA256 de un cuerpo, en hexadecimal. */
export function hmacSha256Hex(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** Si la firma en hexadecimal es la del cuerpo con ese secreto (en tiempo constante; nunca lanza). */
export function verifyHmacSha256(secret: string, rawBody: string, signatureHex: string | undefined): boolean {
  if (!secret || !signatureHex || !HEX_SHA256.test(signatureHex)) return false;
  const expected = Buffer.from(hmacSha256Hex(secret, rawBody), "hex");
  const given = Buffer.from(signatureHex, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** La cabecera X-Hub-Signature-256 de Meta: «sha256=<hex>» con el secreto de la app. */
export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return verifyHmacSha256(appSecret, rawBody, header.slice("sha256=".length));
}
