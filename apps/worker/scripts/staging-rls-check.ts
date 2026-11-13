// Comprobación de moodly_worker contra staging (PL-T1, ADR 0049): la lanza el
// workflow «Staging · worker» (acción rls-connect) por el pooler en modo sesión.
// No lee ni escribe datos de clientes: solo cuenta filas visibles, que tienen
// que ser 0 sin organización fijada y con una organización que no existe.
//
//   WORKER_DATABASE_URL=… node staging-rls-check.ts
//
// Nunca imprime la URL: lleva la contraseña.
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = process.env["WORKER_DATABASE_URL"];
if (!url) throw new Error("falta WORKER_DATABASE_URL");

function fail(message: string): never {
  process.stderr.write(`::error::${message}\n`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, application_name: "moodly_worker_staging_check" });
try {
  await client.connect();
  const { rows: who } = await client.query<{ current: string; session: string; bypass: boolean; superuser: boolean; ssl: boolean }>(
    `select current_user as current, session_user as session, r.rolbypassrls as bypass, r.rolsuper as superuser,
            coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl
     from pg_roles r where r.rolname = session_user`,
  );
  const me = who[0];
  if (!me || me.current !== "moodly_worker" || me.session !== "moodly_worker") fail(`no es moodly_worker (${me?.session ?? "?"}/${me?.current ?? "?"})`);
  if (me.bypass || me.superuser) fail("moodly_worker se salta RLS (BYPASSRLS o superusuario)");
  if (!me.ssl) fail("la conexión no va por TLS");

  // Sin organización fijada: RLS no deja ver nada.
  const count = async () =>
    Number((await client.query<{ n: string }>("select (select count(*) from public.conversations) + (select count(*) from public.locations) as n")).rows[0]?.n);
  const withoutOrg = await count();
  // Con una organización que no existe, tampoco (local a la transacción).
  await client.query("begin");
  await client.query("select set_config('moodly.organization_id', $1, true)", [randomUUID()]);
  const withUnknownOrg = await count();
  await client.query("rollback");
  if (withoutOrg !== 0 || withUnknownOrg !== 0) fail(`moodly_worker ve filas que no son suyas (${withoutOrg}, ${withUnknownOrg})`);

  process.stdout.write(
    `${JSON.stringify({ role: me.current, sessionUser: me.session, bypassRls: me.bypass, tls: me.ssl, visibleWithoutOrg: withoutOrg, visibleWithUnknownOrg: withUnknownOrg }, null, 2)}\n`,
  );
} finally {
  await client.end().catch(() => undefined);
}
