import { performance } from "node:perf_hooks";
import { afterAll, describe, expect, it } from "vitest";
import { seedOrganizations } from "./seed/data.ts";
import { localWorkerDatabaseUrl, readLocalSupabase } from "./seed/local-supabase.ts";
import { WorkerSqlError, createServiceDb } from "./service.ts";
import { createWorkerSql } from "./worker-sql.ts";

// forOrganization(org).transaction contra Supabase local con el seed aplicado
// (PL-T1, paso 2a; ADR 0049): el rol moodly_worker de verdad, por SQL, bajo RLS.
// Solo lee: el rol todavía no tiene privilegios de escritura (20261112040500).
const local = readLocalSupabase();
const workerDatabaseUrl = localWorkerDatabaseUrl(local);
const service = createServiceDb({ url: local.apiUrl, secretKey: local.secretKey, workerDatabaseUrl });

function orgId(name: string): string {
  const org = seedOrganizations.find((candidate) => candidate.name === name);
  if (!org) throw new Error(`No hay organización ${name} en el seed`);
  return org.id;
}
const ORG_A = orgId("Demo A");
const ORG_B = orgId("Demo B");

afterAll(async () => {
  await service.end();
});

describe("forOrganization(org).transaction (moodly_worker, RLS)", () => {
  it("solo ve las filas de su organización, aunque la consulta no filtre", async () => {
    const orgs = await service.forOrganization(ORG_A).transaction((sql) =>
      sql.query<{ organization_id: string }>("select distinct organization_id from public.conversations"),
    );
    expect(orgs.map((row) => row.organization_id)).toEqual([ORG_A]);
  });

  it("aunque pida las de otra organización por su id, no las ve", async () => {
    const rows = await service.forOrganization(ORG_A).transaction((sql) =>
      sql.query("select id from public.locations where organization_id = $1", [ORG_B]),
    );
    expect(rows).toEqual([]);
  });

  it("y la misma consulta con B fijada ve las de B", async () => {
    const orgs = await service.forOrganization(ORG_B).transaction((sql) =>
      sql.query<{ organization_id: string }>("select distinct organization_id from public.locations"),
    );
    expect(orgs.map((row) => row.organization_id)).toEqual([ORG_B]);
  });

  it("una consulta no puede cambiar la organización ni el rol de la transacción", async () => {
    const tenant = service.forOrganization(ORG_A);
    await expect(
      tenant.transaction((sql) => sql.query("select set_config('moodly.organization_id', $1, true)", [ORG_B])),
    ).rejects.toThrow(WorkerSqlError);
    await expect(tenant.transaction((sql) => sql.query("set local role service_role"))).rejects.toThrow(WorkerSqlError);
  });

  it("no puede escribir donde solo lee, y el error deshace la transacción", async () => {
    await expect(
      service.forOrganization(ORG_A).transaction((sql) => sql.query("update public.conversations set mode = mode")),
    ).rejects.toThrow(/permission denied/);
    // La conexión vuelve sana al pool: la siguiente transacción funciona.
    const rows = await service.forOrganization(ORG_A).transaction((sql) => sql.query("select 1 as ok"));
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it("una organización que no es un uuid no abre la transacción", async () => {
    await expect(service.forOrganization(ORG_A).transaction(async () => undefined)).resolves.toBeUndefined();
    const sqlOnly = createWorkerSql({ connectionString: workerDatabaseUrl });
    await expect(sqlOnly.inOrganization("no-es-un-uuid", async () => undefined)).rejects.toThrow(/uuid/);
    await sqlOnly.end();
  });

  it("se niega a trabajar con una conexión que no es moodly_worker (RLS no actuaría)", async () => {
    const asOwner = createWorkerSql({ connectionString: local.dbUrl });
    await expect(asOwner.inOrganization(ORG_A, (sql) => sql.query("select 1"))).rejects.toThrow(WorkerSqlError);
    await asOwner.end();
  });
});

// Latencia (ADR 0049, «Qué la haría aceptada»): las 7 lecturas que hace hoy
// prepare (converse.ts) por PostgREST, una tras otra, frente a las mismas en una
// transacción SQL; y lo que añade abrir la transacción con la organización.
describe("latencia", () => {
  const RUNS = 30;
  const p50 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

  it("mide prepare por PostgREST frente a una transacción SQL, y el coste de fijar la organización", async () => {
    const tenant = service.forOrganization(ORG_A);
    const [conversation] = await tenant.transaction((sql) =>
      sql.query<{ id: string; location_id: string; channel_account_id: string }>(
        "select id, location_id, channel_account_id from public.conversations order by created_at limit 1",
      ),
    );
    if (!conversation) throw new Error("el seed no tiene conversaciones en Demo A");

    const viaRest: number[] = [];
    const viaSql: number[] = [];
    const bare: number[] = [];
    const scoped: number[] = [];
    const owner = createWorkerSql({ connectionString: workerDatabaseUrl, max: 1 });

    for (let i = 0; i < RUNS; i++) {
      let t = performance.now();
      await tenant.from("conversations").select("id, location_id, contact_id, agent_id, mode, channel_account_id").eq("id", conversation.id).maybeSingle();
      await tenant.from("messages").select("id, content").eq("conversation_id", conversation.id).limit(1);
      await tenant.from("channel_accounts").select("channel").eq("id", conversation.channel_account_id).maybeSingle();
      await tenant.from("messages").select("direction, author, content").eq("conversation_id", conversation.id).limit(20);
      await tenant.from("locations").select("name, timezone").eq("id", conversation.location_id).maybeSingle();
      await tenant.from("org_model_settings").select("*").maybeSingle();
      await tenant.from("services").select("id, name").limit(50);
      viaRest.push(performance.now() - t);

      t = performance.now();
      await tenant.transaction(async (sql) => {
        await sql.query("select id, location_id, contact_id, agent_id, mode, channel_account_id from public.conversations where id = $1", [conversation.id]);
        await sql.query("select id, content from public.messages where conversation_id = $1 limit 1", [conversation.id]);
        await sql.query("select channel from public.channel_accounts where id = $1", [conversation.channel_account_id]);
        await sql.query("select direction, author, content from public.messages where conversation_id = $1 limit 20", [conversation.id]);
        await sql.query("select name, timezone from public.locations where id = $1", [conversation.location_id]);
        await sql.query("select * from public.org_model_settings");
        await sql.query("select id, name from public.services limit 50");
      });
      viaSql.push(performance.now() - t);

      // Lo que añade la transacción (begin + set_config + commit) a una consulta.
      t = performance.now();
      await owner.inOrganization(ORG_A, (sql) => sql.query("select 1"));
      scoped.push(performance.now() - t);
      t = performance.now();
      await owner.inOrganization(ORG_A, async () => undefined);
      bare.push(performance.now() - t);
    }
    await owner.end();

    const report = {
      runs: RUNS,
      prepareViaPostgrestP50Ms: Number(p50(viaRest).toFixed(2)),
      prepareViaSqlTransactionP50Ms: Number(p50(viaSql).toFixed(2)),
      transactionWithOneQueryP50Ms: Number(p50(scoped).toFixed(2)),
      transactionOverheadP50Ms: Number(p50(bare).toFixed(2)),
    };
    console.log(`PL-T1 latencia: ${JSON.stringify(report)}`);
    // Solo una red de seguridad muy holgada: los números van al PR.
    expect(report.transactionOverheadP50Ms).toBeLessThan(50);
  }, 120_000);
});
