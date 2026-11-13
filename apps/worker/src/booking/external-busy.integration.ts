import { createServiceDb } from "@repo/db/service";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { resolveLocationCalendar } from "./external-busy.ts";

// La resolución del calendario conectado contra Supabase local con el seed (O-02):
// el rol moodly_worker de verdad, por SQL bajo RLS. Mismo criterio que Koibox:
// el calendario del local pedido; si no lo tiene, el de toda la organización;
// nunca el de otro local ni el de otra organización.
const api = localSupabaseApi();
const db = createServiceDb({ url: api.url, secretKey: api.secretKey, workerDatabaseUrl: localWorkerDatabaseUrl() });
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });

let orgA = "";
let orgB = "";
let locA1 = "";
let locA2 = "";

async function connectCalendar(org: string, locationId: string | null, provider: string, connectionId: string) {
  await admin.query(
    `insert into public.integrations (organization_id, location_id, provider, kind, status, external_connection_id)
     values ($1, $2, $3, 'platform', 'active', $4)`,
    [org, locationId, provider, connectionId],
  );
}

async function cleanup() {
  await admin.query("delete from public.integrations where provider in ('google-calendar', 'outlook-calendar') and organization_id = any($1)", [[orgA, orgB]]);
}

beforeAll(async () => {
  await admin.connect();
  const { rows } = await admin.query<{ id: string }>("select id from public.organizations order by id limit 2");
  [orgA, orgB] = rows.map((r) => r.id) as [string, string];
  const { rows: locs } = await admin.query<{ id: string }>(
    "select id from public.locations where organization_id = $1 and status = 'active' order by id limit 2",
    [orgA],
  );
  [locA1, locA2] = locs.map((r) => r.id) as [string, string];
});

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await admin.end();
  await db.end();
});

describe("resolveLocationCalendar (moodly_worker, RLS, criterio del local)", () => {
  it("usa el calendario del local pedido, nunca el de otro local", async () => {
    await connectCalendar(orgA, locA1, "google-calendar", "conn-l1");
    await connectCalendar(orgA, locA2, "google-calendar", "conn-l2");
    const resolved = await resolveLocationCalendar(db.forOrganization(orgA), locA2);
    expect(resolved).toMatchObject({ provider: "google-calendar", connectionId: "conn-l2", integrationKey: "google-calendar" });
  });

  it("sin calendario del local, usa el de toda la organización", async () => {
    await connectCalendar(orgA, null, "google-calendar", "conn-org");
    await connectCalendar(orgA, locA1, "google-calendar", "conn-l1");
    // Un local sin calendario propio cae al de la organización; nunca al de locA1.
    const resolved = await resolveLocationCalendar(db.forOrganization(orgA), locA2);
    expect(resolved?.connectionId).toBe("conn-org");
  });

  it("un local sin calendario y sin uno de la organización: null", async () => {
    await connectCalendar(orgA, locA1, "google-calendar", "conn-l1");
    const resolved = await resolveLocationCalendar(db.forOrganization(orgA), locA2);
    expect(resolved).toBeNull();
  });

  it("sin ningún calendario conectado: null", async () => {
    expect(await resolveLocationCalendar(db.forOrganization(orgA), locA1)).toBeNull();
  });

  it("no usa el calendario de otra organización", async () => {
    await connectCalendar(orgB, null, "google-calendar", "conn-b");
    expect(await resolveLocationCalendar(db.forOrganization(orgA), null)).toBeNull();
  });

  it("solo cuenta un calendario activo con conexión", async () => {
    await admin.query(
      `insert into public.integrations (organization_id, location_id, provider, kind, status, external_connection_id)
       values ($1, null, 'google-calendar', 'platform', 'pending', null)`,
      [orgA],
    );
    expect(await resolveLocationCalendar(db.forOrganization(orgA), locA1)).toBeNull();
  });
});
