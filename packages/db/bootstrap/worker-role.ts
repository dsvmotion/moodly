// SQL que da login a un rol del worker en un proyecto alojado. Lo ejecuta el
// workflow «Staging · worker» con `supabase db query --linked`; la contraseña
// llega por un secreto del entorno de GitHub y sale como verificador SCRAM,
// nunca en claro.
//
//   node bootstrap/worker-role.ts                  dbos_worker   (W2, ADR 0027), con DBOS_WORKER_DB_PASSWORD
//   node bootstrap/worker-role.ts moodly_worker    moodly_worker (PL-T1, ADR 0049), con MOODLY_WORKER_DB_PASSWORD
//
// Solo da login: los atributos de moodly_worker (sin BYPASSRLS, sin heredar…)
// y sus privilegios los fija la migración 20261112040500_worker_role.
import { scramSha256Verifier } from "../src/scram.ts";

const ROLES = {
  dbos_worker: "DBOS_WORKER_DB_PASSWORD",
  moodly_worker: "MOODLY_WORKER_DB_PASSWORD",
} as const;

const role = (process.argv[2] ?? "dbos_worker") as keyof typeof ROLES;
const secret = ROLES[role];
if (!secret) {
  process.stderr.write(`::error::rol desconocido: solo ${Object.keys(ROLES).join(" o ")}\n`);
  process.exit(1);
}

const password = process.env[secret];
if (!password) {
  process.stderr.write(`::error::falta el secreto ${secret}\n`);
  process.exit(1);
}

let verifier: string;
try {
  verifier = scramSha256Verifier(password);
} catch (err) {
  process.stderr.write(`::error::${(err as Error).message}\n`);
  process.exit(1);
}

// El nombre del rol sale de la lista de arriba; el verificador solo lleva
// base64, «$» y «:»: ninguno puede romper la comilla.
process.stdout.write(`alter role ${role} with login password '${verifier}';\n`);
