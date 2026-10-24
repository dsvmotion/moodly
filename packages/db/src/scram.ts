import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

// Verificador SCRAM-SHA-256 de una contraseña de Postgres, calculado fuera de
// la base de datos (RFC 5802 y RFC 7677, formato de PostgreSQL). Con
// `ALTER ROLE … PASSWORD '<verificador>'` la contraseña en claro nunca llega al
// servidor ni a sus logs: Postgres guarda el verificador tal cual.

const ITERATIONS = 4096;

// Solo letras y dígitos: no necesitan SASLprep ni escaparse en una URL de
// conexión, y con 32 o más hay entropía de sobra.
export const ROLE_PASSWORD_PATTERN = /^[A-Za-z0-9]{32,128}$/;

export function scramSha256Verifier(password: string, salt: Buffer = randomBytes(16)): string {
  if (!ROLE_PASSWORD_PATTERN.test(password)) {
    throw new Error("La contraseña del rol debe tener entre 32 y 128 letras o dígitos");
  }
  const saltedPassword = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", saltedPassword).update("Server Key").digest();
  return `SCRAM-SHA-256$${ITERATIONS}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}
