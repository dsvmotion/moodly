import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl } from "../testing/local-system-db.ts";
import { reminderKey, reminderWorkflowId } from "./reminders.ts";

// Los recordatorios de punta a punta (paso 4e-2): una cita que reserva el
// agente emite appointment.created, el outbox lo entrega a reception.reminders
// en un worker de verdad (DBOS y Supabase local), que duerme hasta cada
// recordatorio, relee la cita y lo envía por la conversación de la reserva.
// Para no esperar 24 h, el worker de prueba los manda 30 s y 8 s antes de la
// cita. Los datos viven en un local temporal de Demo A que se borra al terminar.
const fixture = join(import.meta.dirname, "..", "testing", "reminders-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-reminders-"));
const children = new Set<ChildProcess>();
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const api = localSupabaseApi();
const marker = `reminders-${randomUUID().slice(0, 8)}`;
const markerFile = join(dir, "started.jsonl");
const OFFSETS = { "24h": 30_000, "4h": 8_000 };
const ids: Record<string, string> = {};
const resources: string[] = [];
let saved: { status: string; reminder: { autonomy_level: string; enabled: boolean } | null } | null = null;
let worker: { child: ChildProcess; output(): string } | null = null;

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
async function customer(name: string, options: { locale?: string; consents?: object; mode?: string } = {}) {
  const contact = await one("insert into public.contacts (organization_id, display_name, locale, consents) values ($1, $2, $3, $4) returning id", [
    ids.org,
    `${marker}-${name}`,
    options.locale ?? null,
    JSON.stringify(options.consents ?? {}),
  ]);
  const conversation = await one(
    `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [ids.org, ids.location, contact, ids.channel, ids.agent, options.mode ?? "agent"],
  );
  return { contact, conversation };
}

/** Una cita como la deja el agente al reservar (o el equipo, sin conversación), en un recurso propio para no solaparse. */
async function book(who: { contact: string; conversation: string | null }, startsInMs: number, bookedBy = "agent") {
  const resource = resources.shift();
  if (!resource) throw new Error("no quedan recursos de prueba");
  const startsAt = new Date(Date.now() + startsInMs).toISOString();
  const id = await one(
    `insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, conversation_id, starts_at, ends_at, idempotency_key, booked_by)
     values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9) returning id`,
    [ids.org, ids.location, ids.service, resource, who.contact, who.conversation, startsAt, `${marker}:${randomUUID()}`, bookedBy],
  );
  return { id, resource, startsAt };
}

/** La hora de la cita tal como sale en su evento (con la zona de Postgres): la que usa el workflow. */
async function eventStartsAt(appointmentId: string, type = "appointment.created"): Promise<string> {
  const { rows } = await admin.query<{ starts_at: string }>(
    "select payload->>'starts_at' as starts_at from public.domain_events where type = $2 and payload->>'appointment_id' = $1 order by created_at desc limit 1",
    [appointmentId, type],
  );
  const startsAt = rows[0]?.starts_at;
  if (!startsAt) throw new Error(`sin evento ${type} para la cita`);
  return startsAt;
}

async function workflowStatus(appointmentId: string, startsAt: string): Promise<string | null> {
  const { rows } = await admin.query<{ status: string }>("select status from dbos.workflow_status where workflow_uuid = $1", [
    reminderWorkflowId(appointmentId, startsAt),
  ]);
  return rows[0]?.status ?? null;
}

async function finished(appointmentId: string, startsAt: string): Promise<boolean> {
  return (await workflowStatus(appointmentId, startsAt)) === "SUCCESS";
}

/** Si el worker dejó en el log que no envió un recordatorio de esa cita, y por qué. */
function skipped(appointmentId: string, reason: string): boolean {
  return (worker?.output() ?? "")
    .split("\n")
    .some((line) => line.includes(`"appointmentId":"${appointmentId}"`) && line.includes(`"reason":"${reason}"`));
}

async function reminders(conversationId: string) {
  const { rows } = await admin.query<{ content: string; idempotency_key: string; author: string; direction: string; created_at: Date }>(
    "select content, idempotency_key, author, direction, created_at from public.messages where conversation_id = $1 order by created_at",
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
    idempotency_key: string;
    target: { kind: string; contactIds: string[] };
  }>(
    `select r.trigger, r.trigger_ref, r.status, r.agent_id, e.skill_key, e.effect_class, e.autonomy_applied, e.status as exec_status, e.idempotency_key, e.target
     from public.agent_runs r join public.executions e on e.run_id = r.id
     where r.trigger_ref like $1 order by e.idempotency_key`,
    [`${appointmentId}:%`],
  );
  return rows;
}

beforeAll(async () => {
  await admin.connect();
  ids.org = await one("select id from public.organizations where name = 'Demo A'", []);
  // La Recepción de Demo A: la que trae appointment_reminder de serie.
  ids.agent = await one(
    `select a.id from public.agents a join public.agent_skills g on g.agent_id = a.id join public.skills s on s.id = g.skill_id
     where a.organization_id = $1 and s.key = 'appointment_reminder'`,
    [ids.org],
  );
  ids.agentType = await one("select t.key as id from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.id = $1", [ids.agent]);
  ids.reminderSkill = await one("select id from public.skills where organization_id is null and key = 'appointment_reminder'", []);
  const { rows: agentRows } = await admin.query<{ status: string }>("select status from public.agents where id = $1", [ids.agent]);
  const { rows: skillRows } = await admin.query<{ autonomy_level: string; enabled: boolean }>(
    "select autonomy_level, enabled from public.agent_skills where agent_id = $1 and skill_id = $2",
    [ids.agent, ids.reminderSkill],
  );
  saved = { status: agentRows[0]?.status ?? "draft", reminder: skillRows[0] ?? null };

  ids.location = await one(
    `insert into public.locations (organization_id, name, timezone, opening_hours)
     values ($1, $2, 'Europe/Madrid', '{"mon": ["09:00", "14:00"]}') returning id`,
    [ids.org, marker],
  );
  ids.service = await one("insert into public.services (organization_id, name, duration_minutes) values ($1, 'Láser', 30) returning id", [ids.org]);
  for (let i = 1; i <= 10; i += 1) {
    const resource = await one(
      "insert into public.booking_resources (organization_id, location_id, name, kind) values ($1, $2, $3, 'room') returning id",
      [ids.org, ids.location, `Cabina ${i}`],
    );
    await admin.query("insert into public.resource_services (organization_id, resource_id, service_id) values ($1, $2, $3)", [ids.org, resource, ids.service]);
    resources.push(resource);
  }
  ids.resources = resources.join(",");
  ids.channel = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'webchat', $3, $4, 'active') returning id`,
    [ids.org, ids.location, marker, ids.agentType],
  );
  await admin.query("update public.agents set status = 'live' where id = $1", [ids.agent]);

  const child = spawn(process.execPath, [fixture, markerFile], {
    env: {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-reminders",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      REMINDER_OFFSETS_MS: JSON.stringify(OFFSETS),
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
    if (saved.reminder) {
      await admin.query("update public.agent_skills set autonomy_level = $3, enabled = $4 where agent_id = $1 and skill_id = $2", [
        ids.agent,
        ids.reminderSkill,
        saved.reminder.autonomy_level,
        saved.reminder.enabled,
      ]);
    }
  }
  if (ids.location) {
    await admin.query("delete from public.agent_runs where agent_id = $1 and location_id = $2", [ids.agent, ids.location]);
    await admin.query(
      "delete from public.domain_events where type like 'appointment.%' and payload->>'appointment_id' in (select id::text from public.appointments where location_id = $1)",
      [ids.location],
    );
    await admin.query("delete from public.appointments where location_id = $1", [ids.location]);
    await admin.query("delete from public.conversations where location_id = $1", [ids.location]);
    await admin.query("delete from public.contacts where display_name like $1", [`${marker}-%`]);
    await admin.query("delete from public.channel_accounts where id = $1", [ids.channel]);
    await admin.query("delete from public.booking_resources where location_id = $1", [ids.location]);
    await admin.query("delete from public.services where id = $1", [ids.service]);
    await admin.query("delete from public.locations where id = $1", [ids.location]);
  }
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

describe("los recordatorios de las citas (paso 4e-2)", () => {
  it("una cita reservada por el agente con menos de «24 h»: el primero sale al reservar y el de «4 h» a su hora, por su conversación", async () => {
    const ana = await customer("ana", { locale: "es" });
    // A 24 s: el de «24 h» (30 s antes) ya pasó, así que sale ya; el de «4 h» (8 s antes), dentro de unos 16 s.
    const appointment = await book(ana, 24_000);
    const startsAt = await eventStartsAt(appointment.id);
    await waitFor(async () => (await reminders(ana.conversation)).length === 1, "sale el primero");
    expect(await workflowStatus(appointment.id, startsAt)).toBe("PENDING");
    await waitFor(() => finished(appointment.id, startsAt), "el workflow termina", 30_000);

    const sent = await reminders(ana.conversation);
    expect(sent.map((message) => [message.direction, message.author, message.idempotency_key])).toEqual([
      ["out", "agent", reminderKey(appointment.id, startsAt, "24h")],
      ["out", "agent", reminderKey(appointment.id, startsAt, "4h")],
    ]);
    // El segundo espera a su hora: no salen los dos a la vez.
    const gap = (sent[1]?.created_at.getTime() ?? 0) - (sent[0]?.created_at.getTime() ?? 0);
    expect(gap).toBeGreaterThan(3_000);
    for (const message of sent) {
      expect(message.content).toMatch(/^Recordatorio: tienes cita de Láser en reminders-/);
      expect(message.content).toContain("BAJA");
    }

    // Cada uno, un run programado del agente con su ejecución: envío a clientes, solo, al contacto de la cita.
    const runs = await runsOf(appointment.id);
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run).toMatchObject({
        trigger: "schedule",
        status: "completed",
        agent_id: ids.agent,
        skill_key: "appointment_reminder",
        effect_class: "external_outreach",
        autonomy_applied: "execute",
        exec_status: "executed",
        target: { kind: "audience", contactIds: [ana.contact] },
      });
    }
    expect(runs.map((run) => run.trigger_ref)).toEqual([`${appointment.id}:24h`, `${appointment.id}:4h`]);
  }, 90_000);

  it("si se mueve, salen los de la hora nueva y no los de la vieja; si se cancela, no sale lo que quedaba", async () => {
    const bea = await customer("bea", { locale: "es" });
    const carla = await customer("carla", { locale: "es" });
    // Bea reserva a 45 s y enseguida se mueve a 24 s: el workflow viejo despierta a los 15 s y a los 37 s y no envía nada.
    const moved = await book(bea, 45_000);
    const oldStartsAt = await eventStartsAt(moved.id);
    const newStartsAt = new Date(Date.now() + 24_000).toISOString();
    await admin.query("update public.appointments set starts_at = $2 where id = $1", [moved.id, newStartsAt]);
    const movedStartsAt = await eventStartsAt(moved.id, "appointment.rescheduled");
    // Carla, a 24 s: sale el primero y, antes del de «4 h», cancela.
    const cancelled = await book(carla, 24_000);
    const cancelledStartsAt = await eventStartsAt(cancelled.id);
    await waitFor(async () => (await reminders(carla.conversation)).length === 1, "a Carla le sale el primero");
    await admin.query("update public.appointments set status = 'cancelled' where id = $1", [cancelled.id]);

    await waitFor(() => finished(cancelled.id, cancelledStartsAt), "el workflow de Carla termina", 30_000);
    await waitFor(() => finished(moved.id, movedStartsAt), "el de la hora nueva de Bea termina", 30_000);
    await waitFor(() => finished(moved.id, oldStartsAt), "el de la hora vieja de Bea termina", 60_000);

    expect((await reminders(bea.conversation)).map((message) => message.idempotency_key)).toEqual([
      reminderKey(moved.id, movedStartsAt, "24h"),
      reminderKey(moved.id, movedStartsAt, "4h"),
    ]);
    expect((await reminders(carla.conversation)).map((message) => message.idempotency_key)).toEqual([reminderKey(cancelled.id, cancelledStartsAt, "24h")]);
    expect(await runsOf(cancelled.id)).toHaveLength(1);
    // Y en el log, por qué: la cita se movió o se canceló antes de su hora.
    expect(skipped(moved.id, "moved")).toBe(true);
    expect(skipped(cancelled.id, "not_booked")).toBe(true);
  }, 120_000);

  it("no sale nada si la reservó el equipo, si el cliente se dio de baja o si la conversación está cerrada", async () => {
    const staff = await customer("dani");
    const optedOut = await customer("eva", { consents: { appointment_reminders: { opted_out_at: new Date().toISOString() } } });
    const closed = await customer("fran", { mode: "closed" });
    const byStaff = await book({ contact: staff.contact, conversation: null }, 12_000, "user");
    const toOptedOut = await book(optedOut, 12_000);
    const toClosed = await book(closed, 12_000);
    const cases = [
      { appointment: byStaff, conversation: staff.conversation },
      { appointment: toOptedOut, conversation: optedOut.conversation },
      { appointment: toClosed, conversation: closed.conversation },
    ];
    for (const { appointment } of cases) {
      const startsAt = await eventStartsAt(appointment.id);
      await waitFor(() => finished(appointment.id, startsAt), "su workflow termina", 30_000);
    }
    for (const { appointment, conversation } of cases) {
      expect(await reminders(conversation)).toEqual([]);
      expect(await runsOf(appointment.id)).toEqual([]);
    }
  }, 90_000);

  it("tampoco con la skill desactivada, con menos autonomía que execute o con el agente en pausa", async () => {
    const cases: { name: string; set: string; reset: string; params: unknown[] }[] = [
      {
        name: "gema",
        set: "update public.agent_skills set enabled = false where agent_id = $1 and skill_id = $2",
        reset: "update public.agent_skills set enabled = true where agent_id = $1 and skill_id = $2",
        params: [ids.agent, ids.reminderSkill],
      },
      {
        name: "hugo",
        set: "update public.agent_skills set autonomy_level = 'draft' where agent_id = $1 and skill_id = $2",
        reset: "update public.agent_skills set autonomy_level = 'execute' where agent_id = $1 and skill_id = $2",
        params: [ids.agent, ids.reminderSkill],
      },
      { name: "ines", set: "update public.agents set status = 'paused' where id = $1", reset: "update public.agents set status = 'live' where id = $1", params: [ids.agent] },
    ];
    for (const { name, set, reset, params } of cases) {
      await admin.query(set, params);
      try {
        const who = await customer(name);
        const appointment = await book(who, 12_000);
        const startsAt = await eventStartsAt(appointment.id);
        await waitFor(() => finished(appointment.id, startsAt), `el workflow de ${name} termina`, 30_000);
        expect(await reminders(who.conversation), name).toEqual([]);
        expect(await runsOf(appointment.id), name).toEqual([]);
      } finally {
        await admin.query(reset, params);
      }
    }
  }, 120_000);
});
