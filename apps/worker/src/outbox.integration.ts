import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliveryWorkflowId } from "./events/outbox.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "./testing/local-system-db.ts";

// W3 (ADR 0009): del alta de una invitación al consumidor, pasando por el
// outbox, el publicador programado y una entrega por consumidor; con el tenant
// tomado de la fila (control 3.7) y la entrega reanudada tras matar el worker.
const fixture = join(import.meta.dirname, "testing", "outbox-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-outbox-"));
const children = new Set<ChildProcess>();
// Postgres como postgres: prepara datos y comprueba desde fuera, sin el worker.
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const marker = `outbox-${randomUUID().slice(0, 8)}`;
const api = localSupabaseApi();
const baseEnv = {
  ...process.env,
  WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
  // Fija a propósito: si otro test registró después otra versión, esta ya no es
  // la última, como tras una vuelta atrás. El worker se promueve al arrancar
  // (worker.ts) y el publicador programado le llega igual.
  WORKER_APP_VERSION: "test-outbox",
  LOG_LEVEL: "info",
  SUPABASE_URL: api.url,
  SUPABASE_SECRET_KEY: api.secretKey,
  WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
};

interface Effect {
  step: string;
  pid: number;
  eventId?: string;
  organizationId?: string;
  payloadKeys?: string[];
  touched?: number;
}

interface Org {
  id: string;
  adminId: string;
}

beforeAll(async () => {
  await admin.connect();
});

afterAll(async () => {
  for (const child of children) child.kill("SIGKILL");
  await admin.query("delete from public.invitations where email like $1", [`${marker}%`]);
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

function startWorker(file: string, env: NodeJS.ProcessEnv): { child: ChildProcess; output(): string; exited: Promise<number | null> } {
  const child = spawn(process.execPath, [fixture, file], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => {
    child.on("close", (code) => {
      children.delete(child);
      resolve(code);
    });
  });
  return { child, output: () => output, exited };
}

function effects(file: string, eventId?: string): Effect[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Effect)
    .filter((effect) => eventId === undefined || effect.eventId === eventId);
}

async function waitFor(condition: () => boolean | Promise<boolean>, what: string, output: () => string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function org(name: string): Promise<Org> {
  const { rows } = await admin.query<{ id: string; admin_id: string }>(
    `select o.id, m.user_id as admin_id from public.organizations o
     join public.memberships m on m.organization_id = o.id and m.role = 'org_admin'
     where o.name = $1 order by m.created_at limit 1`,
    [name],
  );
  if (!rows[0]) throw new Error(`No hay organización ${name} con org_admin en el seed`);
  return { id: rows[0].id, adminId: rows[0].admin_id };
}

/** Una invitación nueva (su trigger escribe invitation.created en la misma transacción). */
async function invite(target: Org): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `insert into public.invitations (organization_id, email, role, token_hash, invited_by)
     values ($1, $2, 'org_admin', encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), $3)
     returning id`,
    [target.id, `${marker}-${randomUUID().slice(0, 8)}@demo.test`, target.adminId],
  );
  return (rows[0] as { id: string }).id;
}

async function eventOf(invitationId: string): Promise<{ id: string; organization_id: string; published_at: Date | null }> {
  const { rows } = await admin.query<{ id: string; organization_id: string; published_at: Date | null }>(
    "select id, organization_id, published_at from public.domain_events where payload->>'invitation_id' = $1",
    [invitationId],
  );
  expect(rows).toHaveLength(1);
  return rows[0] as { id: string; organization_id: string; published_at: Date | null };
}

async function revokedAt(invitationId: string): Promise<Date | null> {
  const { rows } = await admin.query<{ revoked_at: Date | null }>("select revoked_at from public.invitations where id = $1", [invitationId]);
  return rows[0]?.revoked_at ?? null;
}

async function deliveries(eventId: string): Promise<number> {
  const { rows } = await admin.query<{ n: number }>("select count(*)::int as n from dbos.workflow_status where workflow_uuid = $1", [
    deliveryWorkflowId(eventId, "test.effects"),
  ]);
  return rows[0]?.n ?? 0;
}

async function stop(worker: ReturnType<typeof startWorker>): Promise<void> {
  worker.child.kill("SIGTERM");
  expect(await worker.exited, worker.output()).toBe(0);
}

describe("outbox: de la invitación al consumidor (W3)", () => {
  it("la invitación llega al consumidor con la organización de la fila, una sola vez aunque se vuelva a publicar", async () => {
    const orgA = await org("Demo A");
    const file = join(dir, `${randomUUID()}.jsonl`);
    const worker = startWorker(file, { ...baseEnv, WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}` });

    const invitationId = await invite(orgA);
    const event = await eventOf(invitationId);
    expect(event.organization_id).toBe(orgA.id);
    await waitFor(() => effects(file, event.id).some((e) => e.step === "done"), "la entrega termina", worker.output);

    const [seen] = effects(file, event.id).filter((e) => e.step === "seen");
    expect(seen?.organizationId).toBe(orgA.id);
    expect(seen?.payloadKeys).toEqual(["invitation_id", "invited_by", "role"]);
    expect(effects(file, event.id).find((e) => e.step === "done")?.touched).toBe(1);
    expect(await revokedAt(invitationId)).not.toBeNull();
    expect((await eventOf(invitationId)).published_at).not.toBeNull();

    // Como si el publicador se hubiera caído antes de marcarlo: vuelve a estar
    // pendiente, se vuelve a encolar con el mismo ID y no se entrega otra vez.
    await admin.query("update public.domain_events set published_at = null where id = $1", [event.id]);
    await waitFor(async () => (await eventOf(invitationId)).published_at !== null, "se vuelve a publicar", worker.output);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(effects(file, event.id).filter((e) => e.step === "seen")).toHaveLength(1);
    expect(await deliveries(event.id)).toBe(1);

    await stop(worker);
    expect(worker.output()).not.toContain(api.secretKey);
  });

  it("un payload manipulado no cambia de tenant: la entrega solo llega a la organización de la fila (3.7)", async () => {
    const [orgA, orgB] = await Promise.all([org("Demo A"), org("Demo B")]);
    // La víctima: una invitación de B. Su propio evento se da por publicado
    // para que solo llegue el falsificado.
    const victim = await invite(orgB);
    await admin.query("update public.domain_events set published_at = now() where payload->>'invitation_id' = $1", [victim]);
    const { rows } = await admin.query<{ id: string }>(
      `insert into public.domain_events (organization_id, type, payload)
       values ($1, 'invitation.created', $2::jsonb) returning id`,
      [
        orgA.id,
        JSON.stringify({ invitation_id: victim, role: "staff", invited_by: orgB.adminId, organization_id: orgB.id, location_id: randomUUID() }),
      ],
    );
    const forged = (rows[0] as { id: string }).id;

    const file = join(dir, `${randomUUID()}.jsonl`);
    const worker = startWorker(file, { ...baseEnv, WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}` });
    await waitFor(() => effects(file, forged).some((e) => e.step === "done"), "la entrega falsificada termina", worker.output);

    const [seen] = effects(file, forged).filter((e) => e.step === "seen");
    expect(seen?.organizationId).toBe(orgA.id);
    // Zod quita las claves de tenant del payload: el consumidor ni las ve.
    expect(seen?.payloadKeys).toEqual(["invitation_id", "invited_by", "role"]);
    // Con el acceso de A, la invitación de B no existe: nada que revocar.
    expect(effects(file, forged).find((e) => e.step === "done")?.touched).toBe(0);
    expect(await revokedAt(victim)).toBeNull();
    await stop(worker);
  });

  it("muere en mitad de una entrega, vuelve con el mismo executorID y la termina sin repetir lo hecho", async () => {
    const orgA = await org("Demo A");
    const executorId = `test-${randomUUID().slice(0, 8)}`;
    const file = join(dir, `${randomUUID()}.jsonl`);
    const hung = startWorker(file, { ...baseEnv, WORKER_EXECUTOR_ID: executorId, HANG_IN_TOUCH: "1" });

    const invitationId = await invite(orgA);
    const event = await eventOf(invitationId);
    await waitFor(() => effects(file, event.id).some((e) => e.step === "touch-begin"), "la entrega llega a «touch»", hung.output);
    hung.child.kill("SIGKILL");
    await hung.exited;
    expect(await revokedAt(invitationId)).toBeNull();

    const recovered = startWorker(file, { ...baseEnv, WORKER_EXECUTOR_ID: executorId });
    await waitFor(() => effects(file, event.id).some((e) => e.step === "done"), "la entrega se reanuda y termina", recovered.output);

    const steps = effects(file, event.id);
    // «seen» terminó antes de morir: no se repite. «touch» estaba a medias: se
    // repite entero en el proceso nuevo (al menos una vez, regla 2).
    expect(steps.filter((e) => e.step === "seen").map((e) => e.pid)).toEqual([hung.child.pid]);
    expect(steps.filter((e) => e.step === "done").map((e) => e.pid)).toEqual([recovered.child.pid]);
    expect(steps.find((e) => e.step === "done")?.touched).toBe(1);
    expect(await revokedAt(invitationId)).not.toBeNull();
    expect(await deliveries(event.id)).toBe(1);
    await stop(recovered);
  });

  it("cada hora borra las vueltas del publicador ya terminadas, pero no las entregas ni las que fallaron", async () => {
    const orgA = await org("Demo A");
    const file = join(dir, `${randomUUID()}.jsonl`);
    const env = { ...baseEnv, WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}` };
    const worker = startWorker(file, env);
    const event = await eventOf(await invite(orgA));
    await waitFor(() => effects(file, event.id).some((e) => e.step === "done"), "la entrega termina", worker.output);
    await stop(worker);

    const { rows } = await admin.query<{ id: string }>(
      `select workflow_uuid as id from dbos.workflow_status
       where name = 'outbox.publish' and status = 'SUCCESS' order by created_at desc limit 3`,
    );
    const [oldOk, oldFailed, recent] = rows.map((row) => row.id);
    const delivery = deliveryWorkflowId(event.id, "test.effects");
    // Dos horas atrás: una que terminó bien, otra que falló y la entrega.
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await admin.query("update dbos.workflow_status set completed_at = $1 where workflow_uuid = any($2)", [
      twoHoursAgo,
      [oldOk, oldFailed, delivery],
    ]);
    await admin.query("update dbos.workflow_status set status = 'ERROR' where workflow_uuid = $1", [oldFailed]);

    const pruner = startWorker(file, { ...env, TRIGGER_PRUNE: "1" });
    await waitFor(() => effects(file).some((e) => e.step === "pruned" && e.pid === pruner.child.pid), "la limpieza termina", pruner.output);
    await stop(pruner);

    const { rows: left } = await admin.query<{ id: string }>("select workflow_uuid as id from dbos.workflow_status where workflow_uuid = any($1)", [
      [oldOk, oldFailed, recent, delivery],
    ]);
    const ids = left.map((row) => row.id);
    expect(ids).not.toContain(oldOk);
    expect(ids).toContain(oldFailed);
    expect(ids).toContain(recent);
    expect(ids).toContain(delivery);
  });
});
