import { randomUUID } from "node:crypto";
import { createServiceDb } from "@repo/db/service";
import { createFakeConnectorPlatform, signNangoWebhook, type FakeConnectorPlatform } from "@repo/integrations";
import pg from "pg";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { listUpcomingCalendarEvents } from "./calendar.ts";
import { handleNangoWebhook, type NangoWebhookDeps } from "./nango-webhook.ts";

// El webhook de Nango y la lectura del calendario contra Supabase local con el
// seed aplicado (O-02): el rol moodly_worker de verdad, por SQL, bajo RLS. La
// plataforma es la falsa (sin red); la firma, la de verdad.
const SIGNING_KEY = "00000000-0000-4000-8000-00000000000a";
const silent = pino({ level: "silent" });
const api = localSupabaseApi();
const db = createServiceDb({ url: api.url, secretKey: api.secretKey, workerDatabaseUrl: localWorkerDatabaseUrl() });
// Como postgres: prepara las filas y comprueba desde fuera, sin el worker.
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });

let orgA = "";
let orgB = "";
let rowA = "";
let rowB = "";
let platform: FakeConnectorPlatform;

async function row(id: string) {
  const { rows } = await admin.query<{ status: string; external_connection_id: string | null }>(
    "select status, external_connection_id from public.integrations where id = $1",
    [id],
  );
  return rows[0];
}

function send(body: Record<string, unknown>, opts: { signingKey?: string } = {}) {
  const raw = JSON.stringify({ type: "auth", operation: "creation", success: true, providerConfigKey: "google-calendar", ...body });
  const deps: NangoWebhookDeps = { db, platform, signingKey: SIGNING_KEY, logger: silent };
  return handleNangoWebhook(deps, Buffer.from(raw), signNangoWebhook(raw, opts.signingKey ?? SIGNING_KEY));
}

function connect(connectionId: string, org: string, integrationId: string) {
  platform.addConnection({ connectionId, integrationKey: "google-calendar", tags: { organization_id: org, end_user_id: "u", integration_id: integrationId } });
}

beforeAll(async () => {
  await admin.connect();
  // Dos organizaciones del seed cualesquiera.
  const { rows } = await admin.query<{ id: string }>("select id from public.organizations order by id limit 2");
  [orgA, orgB] = rows.map((r) => r.id) as [string, string];
});

beforeEach(async () => {
  platform = createFakeConnectorPlatform({
    proxyResponse: (request) =>
      request.integrationKey === "outlook"
        ? { value: [{ id: "ms-1", subject: "Tinte · Eva", start: { dateTime: "2026-11-13T11:00:00.0000000", timeZone: "UTC" } }] }
        : { items: [{ id: "e1", summary: "Corte · Ana", start: { dateTime: "2026-11-13T10:00:00Z" } }] },
  });
  await admin.query("delete from public.integrations where provider in ('google-calendar', 'outlook-calendar') and organization_id = any($1)", [[orgA, orgB]]);
  const a = await admin.query<{ id: string }>(
    "insert into public.integrations (organization_id, provider, kind) values ($1, 'google-calendar', 'platform') returning id",
    [orgA],
  );
  const b = await admin.query<{ id: string }>(
    "insert into public.integrations (organization_id, provider, kind) values ($1, 'google-calendar', 'platform') returning id",
    [orgB],
  );
  rowA = a.rows[0]?.id ?? "";
  rowB = b.rows[0]?.id ?? "";
});

afterAll(async () => {
  await admin.query("delete from public.integrations where provider in ('google-calendar', 'outlook-calendar') and organization_id = any($1)", [[orgA, orgB]]);
  await admin.end();
  await db.end();
});

describe("webhook de Nango (moodly_worker, RLS)", () => {
  it("con la firma buena y la conexión confirmada en Nango, activa la fila con su id", async () => {
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgA, rowA);
    await expect(send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } })).resolves.toBe("activated");
    expect(await row(rowA)).toEqual({ status: "active", external_connection_id: conn });
    expect(await row(rowB)).toEqual({ status: "pending", external_connection_id: null });
  });

  it("prueba en negativo: con una firma que no vale no se escribe nada", async () => {
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgA, rowA);
    await expect(
      send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } }, { signingKey: "otra-clave-cualquiera" }),
    ).resolves.toBe("invalid_signature");
    expect(await row(rowA)).toEqual({ status: "pending", external_connection_id: null });
  });

  it("la organización de una etiqueta y la fila de otra: no alcanza la fila (RLS y el filtro)", async () => {
    const conn = `conn-${randomUUID()}`;
    // Nango confirma esas etiquetas, pero la fila de B no es de A.
    connect(conn, orgA, rowB);
    await expect(send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowB } })).resolves.toBe("ignored");
    expect(await row(rowB)).toEqual({ status: "pending", external_connection_id: null });
  });

  it("si las etiquetas del webhook no coinciden con las de la conexión en Nango, no se escribe nada", async () => {
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgB, rowB);
    await expect(send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } })).resolves.toBe("ignored");
    expect(await row(rowA)).toEqual({ status: "pending", external_connection_id: null });
  });

  it("si la persona desconectó mientras tanto, la conexión nueva se borra en Nango y la fila no cambia", async () => {
    await admin.query("update public.integrations set status = 'disconnected' where id = $1", [rowA]);
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgA, rowA);
    await expect(send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } })).resolves.toBe("discarded");
    expect(platform.deleted).toEqual([{ integrationKey: "google-calendar", connectionId: conn }]);
    expect(await row(rowA)).toEqual({ status: "disconnected", external_connection_id: null });
  });

  it("al reconectar con otra conexión, la vieja se borra en Nango", async () => {
    const old = `conn-${randomUUID()}`;
    await admin.query("update public.integrations set status = 'active', external_connection_id = $2 where id = $1", [rowA, old]);
    await admin.query("update public.integrations set status = 'pending' where id = $1", [rowA]);
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgA, rowA);
    await expect(send({ connectionId: conn, operation: "override", tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } })).resolves.toBe(
      "activated",
    );
    expect(await row(rowA)).toEqual({ status: "active", external_connection_id: conn });
    expect(platform.deleted).toEqual([{ integrationKey: "google-calendar", connectionId: old }]);
  });

  it("una autorización fallida pone la fila en error", async () => {
    await expect(
      send({ connectionId: `conn-${randomUUID()}`, success: false, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } }),
    ).resolves.toBe("marked_error");
    expect((await row(rowA))?.status).toBe("error");
  });
});

describe("listUpcomingCalendarEvents (moodly_worker, RLS)", () => {
  it("usa la conexión de su organización, y una sin Google Calendar conectado devuelve null", async () => {
    const conn = `conn-${randomUUID()}`;
    connect(conn, orgA, rowA);
    await send({ connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } });
    const from = new Date("2026-11-13T09:00:00Z");
    const events = await listUpcomingCalendarEvents({ db, platform, organizationId: orgA, from, limit: 5 });
    expect(events).toEqual([{ id: "e1", title: "Corte · Ana", startsAt: new Date("2026-11-13T10:00:00Z"), endsAt: null, allDay: false }]);
    expect(platform.proxied.map((p) => p.connectionId)).toEqual([conn]);
    await expect(listUpcomingCalendarEvents({ db, platform, organizationId: orgB, from, limit: 5 })).resolves.toBeNull();
    expect(platform.proxied).toHaveLength(1);
  });
});

describe("Outlook / Microsoft 365 (el mismo webhook y la misma lectura)", () => {
  async function outlookRow(org: string) {
    const { rows } = await admin.query<{ id: string }>(
      "insert into public.integrations (organization_id, provider, kind) values ($1, 'outlook-calendar', 'platform') returning id",
      [org],
    );
    return rows[0]?.id ?? "";
  }

  it("el webhook firmado de la integración «outlook» activa la fila de outlook-calendar, y la lectura usa Graph con esa conexión", async () => {
    const id = await outlookRow(orgA);
    const conn = `conn-ms-${randomUUID()}`;
    platform.addConnection({ connectionId: conn, integrationKey: "outlook", tags: { organization_id: orgA, end_user_id: "u", integration_id: id } });
    await expect(
      send({ providerConfigKey: "outlook", connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: id } }),
    ).resolves.toBe("activated");
    expect(await row(id)).toEqual({ status: "active", external_connection_id: conn });

    const events = await listUpcomingCalendarEvents({ db, platform, organizationId: orgA, from: new Date("2026-11-13T09:00:00Z"), limit: 3 });
    expect(events).toEqual([{ id: "ms-1", title: "Tinte · Eva", startsAt: new Date("2026-11-13T11:00:00Z"), endsAt: null, allDay: false }]);
    expect(platform.proxied.map((p) => [p.integrationKey, p.connectionId, p.path])).toEqual([["outlook", conn, "/v1.0/me/calendarView"]]);
  });

  it("un webhook de «outlook» con la fila de Google no la activa (la clave tiene que ser la de su proveedor)", async () => {
    const conn = `conn-ms-${randomUUID()}`;
    platform.addConnection({ connectionId: conn, integrationKey: "outlook", tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } });
    await expect(
      send({ providerConfigKey: "outlook", connectionId: conn, tags: { organization_id: orgA, end_user_id: "u", integration_id: rowA } }),
    ).resolves.toBe("ignored");
    expect(await row(rowA)).toEqual({ status: "pending", external_connection_id: null });
  });

  it("el Outlook de otra organización no se lee: B conectado no da eventos a A", async () => {
    const id = await outlookRow(orgB);
    const conn = `conn-ms-${randomUUID()}`;
    platform.addConnection({ connectionId: conn, integrationKey: "outlook", tags: { organization_id: orgB, end_user_id: "u", integration_id: id } });
    await send({ providerConfigKey: "outlook", connectionId: conn, tags: { organization_id: orgB, end_user_id: "u", integration_id: id } });
    expect((await row(id))?.status).toBe("active");
    await expect(
      listUpcomingCalendarEvents({ db, platform, organizationId: orgA, from: new Date("2026-11-13T09:00:00Z"), limit: 3 }),
    ).resolves.toBeNull();
    expect(platform.proxied).toHaveLength(0);
  });
});
