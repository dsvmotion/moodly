import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl } from "../testing/local-system-db.ts";
import { offerKey, waitlistWorkflowId } from "./offers.ts";

// Las ofertas de la lista de espera de punta a punta (paso 4f-2): una cita que
// se cancela emite appointment.cancelled, el outbox lo entrega a
// reception.waitlist en un worker de verdad (DBOS y Supabase local), que
// ofrece el hueco al primero de la lista que encaja por su conversación,
// duerme mientras dura la oferta y después decide: reservada, cogida por otra
// persona o al siguiente. Para no esperar 30 minutos, el worker de prueba da 6 s
// por oferta. Los huecos empiezan a 2 h, salvo el que comprueba que no se
// ofrece uno que empieza antes de que acabe el plazo. Las horas de silencio son
// las de verdad: el local está en una zona horaria en la que ahora son las
// 14:00, salvo en el test que las comprueba. Cada test tiene su propio servicio
// (su propia lista): los huecos de todos empiezan a unas 2 h y las franjas de
// un test contendrían los de los demás. Los datos viven en un local temporal
// de Demo A que se borra al terminar.
const fixture = join(import.meta.dirname, "..", "testing", "waitlist-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-waitlist-"));
const children = new Set<ChildProcess>();
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const api = localSupabaseApi();
const marker = `waitlist-${randomUUID().slice(0, 8)}`;
const markerFile = join(dir, "started.jsonl");
const OFFER_MS = 6_000;
const HOUR = 3_600_000;

/** Una zona horaria fija en la que ahora son más o menos las `hour` (en Etc/GMT el signo va al revés). */
function zoneAt(hour: number): string {
  const offset = ((hour - new Date().getUTCHours() + 36) % 24) - 12;
  return offset === 0 ? "Etc/GMT" : offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}
const ids: Record<string, string> = {};
const resources: string[] = [];
const allResources: string[] = [];
const services: string[] = [];
let saved: { status: string; offer: { autonomy_level: string; enabled: boolean } | null } | null = null;
let worker: { child: ChildProcess; output(): string } | null = null;
let entries = 0;

async function one(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`sin id: ${sql}`);
  return id;
}

async function waitFor(condition: () => Promise<boolean>, what: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${worker?.output() ?? ""}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Un cliente con su conversación en el chat web del local de prueba. */
async function customer(name: string, options: { locale?: string } = {}) {
  const contact = await one("insert into public.contacts (organization_id, display_name, locale) values ($1, $2, $3) returning id", [
    ids.org,
    `${marker}-${name}`,
    options.locale ?? "es",
  ]);
  const conversation = await one(
    `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
     values ($1, $2, $3, $4, $5) returning id`,
    [ids.org, ids.location, contact, ids.channel, ids.agent],
  );
  return { contact, conversation };
}

/**
 * Apunta a alguien en la lista, como lo deja join_waitlist. El orden de la
 * lista es el de alta: cada entrada nueva, un segundo después de la anterior.
 */
async function enlist(who: { contact: string; conversation: string | null }, window: { from: number; until: number }, service: string): Promise<string> {
  entries += 1;
  return one(
    `insert into public.waitlist_entries (organization_id, location_id, contact_id, conversation_id, service_id, wanted_from, wanted_until, idempotency_key, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval '1 hour' + make_interval(secs => $9)) returning id`,
    [ids.org, ids.location, who.contact, who.conversation, service, new Date(window.from).toISOString(), new Date(window.until).toISOString(), `${marker}:${randomUUID()}`, entries],
  );
}

/** Una franja que contiene un hueco que empieza en `startsAt`. */
const around = (startsAt: number) => ({ from: startsAt - HOUR, until: startsAt + 2 * HOUR });

/** Un servicio nuevo, con su propia lista de espera, que hacen todos los recursos del local. */
async function newService(name = "Láser"): Promise<string> {
  const id = await one("insert into public.services (organization_id, name, duration_minutes) values ($1, $2, 30) returning id", [ids.org, name]);
  await admin.query(
    "insert into public.resource_services (organization_id, resource_id, service_id) select $1, r, $3 from unnest($2::uuid[]) r",
    [ids.org, allResources, id],
  );
  services.push(id);
  return id;
}

/** Una cita del equipo en un recurso propio para no solaparse con las de otros tests. */
async function book(contact: string, startsInMs: number, service: string) {
  const resource = resources.shift();
  if (!resource) throw new Error("no quedan recursos de prueba");
  const startsAt = new Date(Date.now() + startsInMs);
  const id = await one(
    `insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
     values ($1, $2, $3, $4, $5, $6, $6, $7, 'user') returning id`,
    [ids.org, ids.location, service, resource, contact, startsAt.toISOString(), `${marker}:${randomUUID()}`],
  );
  return { id, resource, service, startsAt: startsAt.getTime() };
}

/** La misma hora en otro recurso no cuenta: el hueco es el de ese recurso. */
async function bookSame(slot: { resource: string; service: string; startsAt: number }, contact: string) {
  return one(
    `insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
     values ($1, $2, $3, $4, $5, $6, $6, $7, 'user') returning id`,
    [ids.org, ids.location, slot.service, slot.resource, contact, new Date(slot.startsAt).toISOString(), `${marker}:${randomUUID()}`],
  );
}

async function cancel(appointmentId: string) {
  await admin.query("update public.appointments set status = 'cancelled' where id = $1", [appointmentId]);
}

async function entry(id: string) {
  const { rows } = await admin.query<{
    status: string;
    offered_resource_id: string | null;
    offered_starts_at: Date | null;
    offer_expires_at: Date | null;
  }>("select status, offered_resource_id, offered_starts_at, offer_expires_at from public.waitlist_entries where id = $1", [id]);
  const row = rows[0];
  if (!row) throw new Error("sin entrada");
  return row;
}

async function finished(appointmentId: string): Promise<boolean> {
  const { rows } = await admin.query<{ status: string }>("select status from dbos.workflow_status where workflow_uuid = $1", [
    waitlistWorkflowId(appointmentId),
  ]);
  return rows[0]?.status === "SUCCESS";
}

async function messages(conversationId: string) {
  const { rows } = await admin.query<{ content: string; idempotency_key: string; author: string; direction: string }>(
    "select content, idempotency_key, author, direction from public.messages where conversation_id = $1 order by created_at",
    [conversationId],
  );
  return rows;
}

async function runsOf(appointmentId: string) {
  const { rows } = await admin.query<{
    trigger: string;
    trigger_ref: string;
    status: string;
    agent_id: string;
    skill_key: string;
    effect_class: string;
    autonomy_applied: string;
    exec_status: string;
    target: { kind: string; contactIds: string[] };
  }>(
    `select r.trigger, r.trigger_ref, r.status, r.agent_id, e.skill_key, e.effect_class, e.autonomy_applied, e.status as exec_status, e.target
     from public.agent_runs r join public.executions e on e.run_id = r.id
     where r.trigger_ref like $1 order by r.created_at`,
    [`${appointmentId}:%`],
  );
  return rows;
}

/** Si el worker dejó en el log una línea de esa cita con ese fragmento. */
function logged(appointmentId: string, fragment: string): boolean {
  return (worker?.output() ?? "")
    .split("\n")
    .some((line) => line.includes(`"appointmentId":"${appointmentId}"`) && line.includes(fragment));
}

beforeAll(async () => {
  await admin.connect();
  ids.org = await one("select id from public.organizations where name = 'Demo A'", []);
  // La Recepción de Demo A: la que trae waitlist_offer de serie.
  ids.agent = await one(
    `select a.id from public.agents a join public.agent_skills g on g.agent_id = a.id join public.skills s on s.id = g.skill_id
     where a.organization_id = $1 and s.key = 'waitlist_offer'`,
    [ids.org],
  );
  ids.agentType = await one("select t.key as id from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.id = $1", [ids.agent]);
  ids.offerSkill = await one("select id from public.skills where organization_id is null and key = 'waitlist_offer'", []);
  const { rows: agentRows } = await admin.query<{ status: string }>("select status from public.agents where id = $1", [ids.agent]);
  const { rows: skillRows } = await admin.query<{ autonomy_level: string; enabled: boolean }>(
    "select autonomy_level, enabled from public.agent_skills where agent_id = $1 and skill_id = $2",
    [ids.agent, ids.offerSkill],
  );
  saved = { status: agentRows[0]?.status ?? "draft", offer: skillRows[0] ?? null };

  ids.location = await one(
    `insert into public.locations (organization_id, name, timezone, opening_hours)
     values ($1, $2, $3, '{"mon": ["09:00", "14:00"]}') returning id`,
    [ids.org, marker, zoneAt(14)],
  );
  for (let i = 1; i <= 10; i += 1) {
    const resource = await one(
      "insert into public.booking_resources (organization_id, location_id, name, kind) values ($1, $2, $3, 'room') returning id",
      [ids.org, ids.location, `Cabina ${i}`],
    );
    resources.push(resource);
    allResources.push(resource);
  }
  ids.channel = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'webchat', $3, $4, 'active') returning id`,
    [ids.org, ids.location, marker, ids.agentType],
  );
  ids.staffContact = await one("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [ids.org, `${marker}-equipo`]);
  await admin.query("update public.agents set status = 'live' where id = $1", [ids.agent]);

  const child = spawn(process.execPath, [fixture, markerFile], {
    env: {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-waitlist",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WAITLIST_OFFER_MS: String(OFFER_MS),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.on("close", () => children.delete(child));
  worker = { child, output: () => output };
  await waitFor(async () => existsSync(markerFile) && readFileSync(markerFile, "utf8").includes('"started"'), "el worker arranca");
}, 90_000);

afterAll(async () => {
  for (const child of children) child.kill("SIGKILL");
  if (saved) {
    await admin.query("update public.agents set status = $2 where id = $1", [ids.agent, saved.status]);
    if (saved.offer) {
      await admin.query("update public.agent_skills set autonomy_level = $3, enabled = $4 where agent_id = $1 and skill_id = $2", [
        ids.agent,
        ids.offerSkill,
        saved.offer.autonomy_level,
        saved.offer.enabled,
      ]);
    }
  }
  if (ids.location) {
    await admin.query("delete from public.agent_runs where agent_id = $1 and location_id = $2", [ids.agent, ids.location]);
    await admin.query(
      "delete from public.domain_events where type like 'appointment.%' and payload->>'appointment_id' in (select id::text from public.appointments where location_id = $1)",
      [ids.location],
    );
    await admin.query("delete from public.waitlist_entries where location_id = $1", [ids.location]);
    await admin.query("delete from public.appointments where location_id = $1", [ids.location]);
    await admin.query("delete from public.conversations where location_id = $1", [ids.location]);
    await admin.query("delete from public.contacts where display_name like $1", [`${marker}-%`]);
    await admin.query("delete from public.channel_accounts where id = $1", [ids.channel]);
    await admin.query("delete from public.booking_resources where location_id = $1", [ids.location]);
    await admin.query("delete from public.services where id = any($1::uuid[])", [services]);
    await admin.query("delete from public.locations where id = $1", [ids.location]);
  }
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

describe("las ofertas de la lista de espera (paso 4f-2)", () => {
  it("el hueco va al primero de la lista que encaja, por su conversación; al acabar su plazo, al siguiente; y al final, a nadie", async () => {
    const service = await newService();
    const otherService = await newService("Peeling");
    const appointment = await book(ids.staffContact ?? "", 2 * HOUR, service);
    const ana = await customer("ana");
    const bea = await customer("bea", { locale: "en" });
    const carla = await customer("carla");
    const dani = await customer("dani");
    const eva = await customer("eva");
    const olga = await customer("olga");
    const anaEntry = await enlist(ana, around(appointment.startsAt), service);
    const beaEntry = await enlist(bea, around(appointment.startsAt), service);
    // Otro servicio; una franja que no contiene el hueco; sin conversación por la que avisar; una franja que ya pasó.
    const carlaEntry = await enlist(carla, around(appointment.startsAt), otherService);
    const daniEntry = await enlist(dani, { from: appointment.startsAt + HOUR, until: appointment.startsAt + 3 * HOUR }, service);
    const evaEntry = await enlist({ contact: eva.contact, conversation: null }, around(appointment.startsAt), service);
    const olgaEntry = await enlist(olga, { from: Date.now() - 3 * HOUR, until: Date.now() - HOUR }, service);

    await cancel(appointment.id);
    // Primero, a Ana: su entrada guarda el hueco y su plazo, y le llega el aviso.
    await waitFor(async () => (await messages(ana.conversation)).length === 1, "a Ana le llega la oferta");
    const offered = await entry(anaEntry);
    expect(offered).toMatchObject({ status: "offered", offered_resource_id: appointment.resource });
    expect(offered.offered_starts_at?.getTime()).toBe(appointment.startsAt);
    const expiresAt = offered.offer_expires_at?.toISOString() ?? "";
    const [toAna] = await messages(ana.conversation);
    expect(toAna).toMatchObject({
      direction: "out",
      author: "agent",
      idempotency_key: offerKey(anaEntry, new Date(appointment.startsAt).toISOString(), expiresAt),
    });
    expect(toAna?.content).toMatch(/^¡Se ha liberado un hueco! Láser en waitlist-/);
    expect(toAna?.content).toContain("contesta SÍ");
    expect((await entry(beaEntry)).status).toBe("waiting");

    // Al acabar su plazo, Ana vuelve a esperar (sin oferta) y le toca a Bea, en su idioma.
    await waitFor(async () => (await messages(bea.conversation)).length === 1, "a Bea le llega la oferta", 30_000);
    expect(await entry(anaEntry)).toMatchObject({ status: "waiting", offered_resource_id: null, offered_starts_at: null, offer_expires_at: null });
    expect((await entry(beaEntry)).status).toBe("offered");
    expect((await messages(bea.conversation))[0]?.content).toMatch(/^A slot has opened up: Láser at waitlist-/);

    // Y cuando acaba el de Bea, no queda nadie más que encaje: se acaba.
    await waitFor(() => finished(appointment.id), "el workflow termina", 30_000);
    expect((await entry(beaEntry)).status).toBe("waiting");
    expect(logged(appointment.id, '"reason":"no_candidates"')).toBe(true);
    for (const [who, id] of [
      [carla, carlaEntry],
      [dani, daniEntry],
      [eva, evaEntry],
    ] as const) {
      expect((await entry(id)).status).toBe("waiting");
      expect(await messages(who.conversation)).toEqual([]);
    }
    // La de Olga caducó: su franja ya había pasado.
    expect((await entry(olgaEntry)).status).toBe("expired");
    expect(await messages(olga.conversation)).toEqual([]);

    // Cada oferta, un run programado del agente con su ejecución: envío a clientes, solo, al contacto de la entrada.
    const runs = await runsOf(appointment.id);
    expect(runs.map((run) => run.trigger_ref)).toEqual([`${appointment.id}:${anaEntry}`, `${appointment.id}:${beaEntry}`]);
    expect(runs.map((run) => run.target.contactIds)).toEqual([[ana.contact], [bea.contact]]);
    for (const run of runs) {
      expect(run).toMatchObject({
        trigger: "schedule",
        status: "completed",
        agent_id: ids.agent,
        skill_key: "waitlist_offer",
        effect_class: "external_outreach",
        autonomy_applied: "execute",
        exec_status: "executed",
      });
    }
  }, 90_000);

  it("si quien lo tiene ofrecido lo reserva, su entrada queda reservada y no se ofrece a nadie más", async () => {
    const service = await newService();
    const appointment = await book(ids.staffContact ?? "", 2 * HOUR, service);
    const fran = await customer("fran");
    const gema = await customer("gema");
    const franEntry = await enlist(fran, around(appointment.startsAt), service);
    const gemaEntry = await enlist(gema, around(appointment.startsAt), service);
    await cancel(appointment.id);
    await waitFor(async () => (await entry(franEntry)).status === "offered", "a Fran se le ofrece");
    await bookSame(appointment, fran.contact);

    await waitFor(() => finished(appointment.id), "el workflow termina", 30_000);
    expect(await entry(franEntry)).toMatchObject({ status: "booked", offered_resource_id: appointment.resource });
    expect((await entry(gemaEntry)).status).toBe("waiting");
    expect(await messages(gema.conversation)).toEqual([]);
    expect(logged(appointment.id, '"settled":"booked"')).toBe(true);
  }, 60_000);

  it("si lo coge otra persona mientras tanto, la oferta se retira y no se ofrece a nadie más", async () => {
    const service = await newService();
    const appointment = await book(ids.staffContact ?? "", 2 * HOUR, service);
    const hugo = await customer("hugo");
    const ines = await customer("ines");
    const hugoEntry = await enlist(hugo, around(appointment.startsAt), service);
    const inesEntry = await enlist(ines, around(appointment.startsAt), service);
    await cancel(appointment.id);
    await waitFor(async () => (await entry(hugoEntry)).status === "offered", "a Hugo se le ofrece");
    await bookSame(appointment, ids.staffContact ?? "");

    await waitFor(() => finished(appointment.id), "el workflow termina", 30_000);
    expect(await entry(hugoEntry)).toMatchObject({ status: "waiting", offered_resource_id: null });
    expect((await entry(inesEntry)).status).toBe("waiting");
    expect(await messages(ines.conversation)).toEqual([]);
    expect(logged(appointment.id, '"settled":"taken"')).toBe(true);
  }, 60_000);

  it("si alguien coge el hueco antes de que llegue el evento, no se ofrece a nadie", async () => {
    const service = await newService();
    const appointment = await book(ids.staffContact ?? "", 2 * HOUR, service);
    const mar = await customer("mar");
    const marEntry = await enlist(mar, around(appointment.startsAt), service);
    await cancel(appointment.id);
    // Enseguida, antes de que el outbox lo entregue (publica cada pocos segundos).
    await bookSame(appointment, ids.staffContact ?? "");
    await waitFor(() => finished(appointment.id), "el workflow termina", 30_000);
    expect(logged(appointment.id, '"reason":"slot_taken"')).toBe(true);
    expect((await entry(marEntry)).status).toBe("waiting");
    expect(await messages(mar.conversation)).toEqual([]);
  }, 60_000);

  it("no se ofrece un hueco que empieza antes de que acabe el plazo, ni de 22:00 a 07:00 del local", async () => {
    const service = await newService();
    const soon = await book(ids.staffContact ?? "", 3_000, service);
    const jon = await customer("jon");
    const jonEntry = await enlist(jon, around(soon.startsAt), service);
    await cancel(soon.id);
    await waitFor(() => finished(soon.id), "el workflow del hueco cercano termina", 30_000);
    expect(logged(soon.id, '"reason":"too_late"')).toBe(true);

    // El local pasa a una zona en la que ahora son las 02:00: esperaría a las 07:00, después del hueco.
    await admin.query("update public.locations set timezone = $2 where id = $1", [ids.location, zoneAt(2)]);
    try {
      const night = await book(ids.staffContact ?? "", 2 * HOUR, service);
      const kai = await customer("kai");
      const kaiEntry = await enlist(kai, around(night.startsAt), service);
      await cancel(night.id);
      await waitFor(() => finished(night.id), "el workflow de noche termina", 30_000);
      expect(logged(night.id, '"reason":"too_late"')).toBe(true);
      expect((await entry(kaiEntry)).status).toBe("waiting");
      expect(await messages(kai.conversation)).toEqual([]);
    } finally {
      await admin.query("update public.locations set timezone = $2 where id = $1", [ids.location, zoneAt(14)]);
    }
    expect((await entry(jonEntry)).status).toBe("waiting");
    expect(await messages(jon.conversation)).toEqual([]);
  }, 60_000);

  it("con la skill desactivada no sale ninguna oferta y nadie se queda con el hueco guardado", async () => {
    const service = await newService();
    await admin.query("update public.agent_skills set enabled = false where agent_id = $1 and skill_id = $2", [ids.agent, ids.offerSkill]);
    try {
      const appointment = await book(ids.staffContact ?? "", 2 * HOUR, service);
      const lua = await customer("lua");
      const luaEntry = await enlist(lua, around(appointment.startsAt), service);
      await cancel(appointment.id);
      await waitFor(() => finished(appointment.id), "el workflow termina", 30_000);
      expect(await entry(luaEntry)).toMatchObject({ status: "waiting", offered_resource_id: null });
      expect(await messages(lua.conversation)).toEqual([]);
      expect(await runsOf(appointment.id)).toEqual([]);
      expect(logged(appointment.id, '"reason":"skill_disabled"')).toBe(true);
    } finally {
      await admin.query("update public.agent_skills set enabled = true where agent_id = $1 and skill_id = $2", [ids.agent, ids.offerSkill]);
    }
  }, 60_000);
});
