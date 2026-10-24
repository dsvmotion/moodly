// SQL que da login al rol dbos_worker en un proyecto alojado (W2, ADR 0027).
// Lo ejecuta el workflow «Staging · worker» (acción role) con
// `supabase db query --linked`; la contraseña llega en DBOS_WORKER_DB_PASSWORD
// (secreto del entorno de GitHub) y sale como verificador SCRAM, nunca en claro.
//
//   node bootstrap/worker-role.ts > "$RUNNER_TEMP/worker-role.sql"
import { scramSha256Verifier } from "../src/scram.ts";

const password = process.env["DBOS_WORKER_DB_PASSWORD"];
if (!password) {
  process.stderr.write("::error::falta el secreto DBOS_WORKER_DB_PASSWORD\n");
  process.exit(1);
}

let verifier: string;
try {
  verifier = scramSha256Verifier(password);
} catch (err) {
  process.stderr.write(`::error::${(err as Error).message}\n`);
  process.exit(1);
}

// El verificador solo lleva base64, «$» y «:»: no puede romper la comilla.
process.stdout.write(`alter role dbos_worker with login password '${verifier}';\n`);
