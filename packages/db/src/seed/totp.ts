import { createHmac } from "node:crypto";

// Códigos TOTP (RFC 6238: HMAC-SHA1, 6 cifras, pasos de 30 s) a partir del
// secreto en base32 que devuelve Supabase Auth al dar de alta el factor. Lo usan
// el seed (para verificar el factor de los org_admin) y los e2e (para entrar).
// Solo para desarrollo y pruebas: los usuarios reales usan su app de autenticación.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Secreto TOTP no válido (base32)");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Código TOTP de 6 cifras para el instante `now` (milisegundos). */
export function totp(secretBase32: string, now: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, "0");
}
