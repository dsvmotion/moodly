import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DBOSClient } from "@dbos-inc/dbos-sdk";
import { executionHash } from "@repo/agent-core";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APPROVAL_HANDLER_KEY } from "./agents/approvals.ts";
import { backfillWorkflowId, deliveryWorkflowId } from "./events/outbox.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "./testing/local-system-db.ts";

// W3: el publicador solo entrega a los consumidores que existen al publicar.
// Un consumidor con relleno (agent.approval, 24 h) recibe al llegar lo que se
// publicó antes, una sola vez y sin ejecutar lo que ya no espera a nadie; uno
// sin relleno (test.late) no recibe nada de antes; y lo que queda fuera de la
// ventana no se entrega.
const fixture = join(import.meta.dirname, "testing", "backfill-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-backfill-"));
const children = new Set<ChildProcess>();
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const api = localSupabaseApi();
const PROBE = "backfill_probe";
const LATE = "test.late";
const BACKFILL_ID = backfillWorkflowId(APPROVAL_HANDLER_KEY, "approval.decided");
const BACKFILL_RETRY_ID = backfillWorkflowId(APPROVAL_HANDLER_KEY, "approval.decided", 2);
const BACKFILL_ATTEMPTS = [1, 2, 3].map((attempt) => backfillWorkflowId(APPROVAL_HANDLER_KEY, "approval.decided", attempt));
const baseEnv = {
  ...process.env,
  WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
  WORKER_APP_VERSION: "test-backfill",
  LOG_LEVEL: "info",
  SUPABASE_URL: api.url,
  SUPABASE_SECRET_KEY: api.secretKey,
  WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
};

interface Effect {
  step: string;
  idempotencyKey?: string;
  eventId?: string;
}

interface Decided {
  executionId: string;
  idempotencyKey: string;
  eventId: string;
}

let org = "";
let agent = "";
const runs: string[] = [];

beforeAll(async () => {
  await admin.connect();
  const { rows } = await admin.query<{ org: string; agent: string }>(
    `select o.id as org, a.id as agent from public.organizations o join public.agents a on a.organization_id = o.id
     where o.name = 'Demo A' order by a.created_at limit 1`,
  );
  if (!rows[0]) throw new Error("No hay un agente de Demo A en el seed");
  org = rows[0].org;
  agent = rows[0].agent;
});

afterAll(async () => {
  for (const child of children) child.kill("SIGKILL");
  if (runs.length > 0) {
    await admin.query(
      `delete from public.domain_events where organization_id = $1
         and (source_run_id = any($2::uuid[]) or payload->>'run_id' = any($2::text[]))`,
      [org, runs],
    );
    await admin.query("delete from public.agent_runs where id = any($1::uuid[])", [runs]);
  }
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

/** Un puerto libre de 127.0.0.1 para el /health del worker de prueba. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function health(port: number): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  return { status: res.status, body: await res.json() };
}

function startWorker(file: string, phase: "before" | "after", healthPort?: number) {
  const child = spawn(process.execPath, [fixture, file], {
    env: {
      ...baseEnv,
      BACKFILL_PHASE: phase,
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      ...(healthPort ? { HEALTH_PORT: String(healthPort) } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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

async function stop(worker: ReturnType<typeof startWorker>): Promise<void> {
  worker.child.kill("SIGTERM");
  expect(await worker.exited, worker.output()).toBe(0);
}

function effects(file: string): Effect[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Effect);
}

async function waitFor(condition: () => boolean | Promise<boolean>, what: string, output: () => string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function workflowStatus(workflowId: string): Promise<string | null> {
  const { rows } = await admin.query<{ status: string }>("select status from dbos.workflow_status where workflow_uuid = $1", [workflowId]);
  return rows[0]?.status ?? null;
}

/** El since con el que se lanzó un relleno, tal como lo guardó DBOS. */
async function sinceOf(workflowId: string): Promise<string | null> {
  const { rows } = await admin.query<{ inputs: string | null }>("select inputs from dbos.workflow_input where workflow_uuid = $1", [workflowId]);
  const match = /"since"\s*:\s*"([^"]+)"/.exec(rows[0]?.inputs ?? "");
  return match?.[1] ?? null;
}

async function published(eventId: string): Promise<boolean> {
  const { rows } = await admin.query<{ published_at: Date | null }>("select published_at from public.domain_events where id = $1", [eventId]);
  return rows[0]?.published_at != null;
}

async function executionStatus(id: string): Promise<string | undefined> {
  const { rows } = await admin.query<{ status: string }>("select status from public.executions where id = $1", [id]);
  return rows[0]?.status;
}

/**
 * Una ejecución de backfill_probe pendiente de aprobación, ya aprobada: el
 * trigger emit_approval_decided escribe su approval.decided, como cuando
 * decide una persona (eso, con RLS y guard_approval, lo prueba pgTAP).
 */
async function approvedExecution(): Promise<Decided> {
  const { rows: runRows } = await admin.query<{ id: string }>(
    `insert into public.agent_runs (organization_id, agent_id, trigger, status) values ($1, $2, 'schedule', 'awaiting_approval') returning id`,
    [org, agent],
  );
  const runId = (runRows[0] as { id: string }).id;
  runs.push(runId);
  const input = { n: Math.floor(Math.random() * 1_000_000) };
  const target = { kind: "none" } as const;
  const inputHash = executionHash({ organizationId: org, locationId: null, runId, skillKey: PROBE, skillVersion: 1, input, target });
  const idempotencyKey = `backfill-${randomUUID()}`;
  const { rows: executionRows } = await admin.query<{ id: string }>(
    `insert into public.executions (run_id, organization_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
     values ($1, $2, $3, 1, 'internal_write', 'draft', $4, $5, $6, 'needs_approval', $7) returning id`,
    [runId, org, PROBE, JSON.stringify(input), JSON.stringify(target), inputHash, idempotencyKey],
  );
  const executionId = (executionRows[0] as { id: string }).id;
  const { rows: approvalRows } = await admin.query<{ id: string }>(
    `insert into public.approvals (execution_id, organization_id, effect_class, input_hash, required_role, expires_at)
     values ($1, $2, 'internal_write', $3, 'org_admin', now() + interval '1 day') returning id`,
    [executionId, org, inputHash],
  );
  const approvalId = (approvalRows[0] as { id: string }).id;
  // Como decide() de converse.integration.ts: la fila decidida y su evento,
  // lo que deja emit_approval_decided cuando decide una persona con sesión.
  await admin.query("begin");
  try {
    await admin.query("set local session_replication_role = replica");
    await admin.query("update public.approvals set status = 'approved', decided_at = now() where id = $1", [approvalId]);
    await admin.query("set local session_replication_role = origin");
    const { rows: eventRows } = await admin.query<{ id: string }>(
      `insert into public.domain_events (organization_id, location_id, type, payload, source_run_id)
       values ($1, null, 'approval.decided', jsonb_build_object('approval_id', $2::uuid, 'execution_id', $3::uuid, 'run_id', $4::uuid, 'decision', 'approved'), $4)
       returning id`,
      [org, approvalId, executionId, runId],
    );
    await admin.query("commit");
    return { executionId, idempotencyKey, eventId: (eventRows[0] as { id: string }).id };
  } catch (error) {
    await admin.query("rollback");
    throw error;
  }
}

describe("outbox: relleno de un consumidor que llega después que sus eventos (W3)", () => {
  it("agent.approval recibe una vez las decisiones de su ventana, no ejecuta lo ya resuelto, y nadie sin relleno recibe lo viejo", async () => {
    const file = join(dir, `${randomUUID()}.jsonl`);

    // Antes: un worker sin agent.approval. Las tres decisiones se publican y
    // solo le llegan a log.
    const before = startWorker(file, "before");
    await waitFor(() => before.output().includes("worker arrancado"), "arranca sin agent.approval", before.output);
    const waiting = await approvedExecution();
    const settled = await approvedExecution();
    const old = await approvedExecution();
    for (const decided of [waiting, settled, old]) {
      await waitFor(() => published(decided.eventId), "la decisión se publica", before.output);
      expect(await workflowStatus(deliveryWorkflowId(decided.eventId, APPROVAL_HANDLER_KEY))).toBeNull();
    }
    await stop(before);

    // Entre medias: una ejecución ya no espera a nadie (la resolvió otra vía) y
    // una decisión queda fuera de la ventana de 24 h.
    await admin.query("update public.executions set status = 'failed' where id = $1", [settled.executionId]);
    await admin.query("update public.domain_events set created_at = now() - interval '30 hours' where id = $1", [old.eventId]);
    // Como el primer despliegue con agent.approval: su relleno no ha corrido.
    // Entero: los resultados de sus pasos (operation_outputs, sin cascada desde
    // workflow_status) harían que el relleno repitiera la página de otra vuelta.
    for (const table of ["operation_outputs", "workflow_input", "workflow_output", "workflow_status"]) {
      await admin.query(`delete from dbos.${table} where workflow_uuid = any($1)`, [BACKFILL_ATTEMPTS]);
    }

    // Después: llegan agent.approval (con relleno) y test.late (sin él).
    const after = startWorker(file, "after");
    await waitFor(() => /backfill: \d+ eventos encolados/.test(after.output()), "el relleno termina y lo dice", after.output);
    const line = /backfill: (\d+) eventos encolados/.exec(after.output());
    // Las dos de la ventana (y lo que hubiera dejado otro test en ella).
    expect(Number(line?.[1])).toBeGreaterThanOrEqual(2);
    expect(await workflowStatus(BACKFILL_ID)).toBe("SUCCESS");
    for (const decided of [waiting, settled]) {
      await waitFor(
        async () => (await workflowStatus(deliveryWorkflowId(decided.eventId, APPROVAL_HANDLER_KEY))) === "SUCCESS",
        "la entrega del relleno termina",
        after.output,
      );
    }

    // La que esperaba se ejecuta, una vez; la ya resuelta no se toca.
    expect(effects(file).filter((e) => e.step === "execute").map((e) => e.idempotencyKey)).toEqual([waiting.idempotencyKey]);
    expect(await executionStatus(waiting.executionId)).toBe("executed");
    expect(await executionStatus(settled.executionId)).toBe("failed");
    // Fuera de la ventana: ni se encola.
    expect(await workflowStatus(deliveryWorkflowId(old.eventId, APPROVAL_HANDLER_KEY))).toBeNull();
    expect(await executionStatus(old.executionId)).toBe("needs_approval");
    // test.late llegó a la vez pero sin relleno: nada de antes.
    for (const decided of [waiting, settled, old]) expect(await workflowStatus(deliveryWorkflowId(decided.eventId, LATE))).toBeNull();
    expect(effects(file).filter((e) => e.step === "late")).toEqual([]);

    // Lo nuevo sí les llega a los dos, por el publicador.
    const fresh = await approvedExecution();
    await waitFor(() => effects(file).some((e) => e.step === "late" && e.eventId === fresh.eventId), "test.late recibe lo nuevo", after.output);
    await waitFor(() => effects(file).some((e) => e.idempotencyKey === fresh.idempotencyKey), "agent.approval ejecuta lo nuevo", after.output);
    await stop(after);

    // Al volver a arrancar, el relleno no se repite y nada se ejecuta dos veces.
    const again = startWorker(file, "after");
    await waitFor(() => again.output().includes("worker arrancado"), "vuelve a arrancar", again.output);
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    expect(again.output()).not.toMatch(/backfill: \d+ eventos encolados/);
    await stop(again);
    const executed = effects(file).filter((e) => e.step === "execute").map((e) => e.idempotencyKey);
    expect(executed.filter((key) => key === waiting.idempotencyKey)).toHaveLength(1);
    expect(executed.filter((key) => key === fresh.idempotencyKey)).toHaveLength(1);
    expect(effects(file).filter((e) => e.step === "late")).toHaveLength(1);
    expect(again.output()).not.toContain(api.secretKey);

    // Si el relleno hubiera terminado en error, el siguiente arranque lo
    // vuelve a lanzar con el ID del segundo intento; lo que ya se entregó no se
    // repite (mismo ID de entrega), y un arranque más no lanza un tercero.
    await admin.query("update dbos.workflow_status set status = 'ERROR' where workflow_uuid = $1", [BACKFILL_ID]);
    const retried = startWorker(file, "after");
    await waitFor(() => /backfill: \d+ eventos encolados/.test(retried.output()), "el segundo intento termina y lo dice", retried.output);
    expect(retried.output()).toContain("backfill: el anterior terminó en error, se vuelve a lanzar");
    expect(await workflowStatus(BACKFILL_RETRY_ID)).toBe("SUCCESS");
    // La misma ventana que el primero: el since del segundo intento es el suyo, no uno calculado ahora.
    const firstSince = await sinceOf(BACKFILL_ID);
    expect(firstSince).not.toBeNull();
    expect(await sinceOf(BACKFILL_RETRY_ID)).toBe(firstSince);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await stop(retried);
    const settledAgain = startWorker(file, "after");
    await waitFor(() => settledAgain.output().includes("worker arrancado"), "arranca tras el segundo intento", settledAgain.output);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(settledAgain.output()).not.toMatch(/backfill: \d+ eventos encolados/);
    await stop(settledAgain);
    expect(await workflowStatus(BACKFILL_ATTEMPTS[2] as string)).toBeNull();
    const afterRetry = effects(file).filter((e) => e.step === "execute").map((e) => e.idempotencyKey);
    expect(afterRetry.filter((key) => key === waiting.idempotencyKey)).toHaveLength(1);
    expect(afterRetry.filter((key) => key === fresh.idempotencyKey)).toHaveLength(1);
    expect(effects(file).filter((e) => e.step === "late")).toHaveLength(1);

    // Aparcado (MAX_RECOVERY_ATTEMPTS_EXCEEDED: tiró el proceso demasiadas
    // veces), como en la entrada de canales: no se relanza; queda en el log.
    await admin.query("update dbos.workflow_status set status = 'MAX_RECOVERY_ATTEMPTS_EXCEEDED' where workflow_uuid = $1", [BACKFILL_RETRY_ID]);
    const healthPort = await freePort();
    const parked = startWorker(file, "after", healthPort);
    await waitFor(() => parked.output().includes("backfill: aparcado, no se reintenta"), "el aparcado queda en el log", parked.output);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(parked.output()).not.toMatch(/backfill: \d+ eventos encolados/);
    // Y en /health, que es lo que mira la alerta de staging: degraded mientras siga aparcado.
    await waitFor(() => parked.output().includes("worker arrancado"), "arranca con el relleno aparcado", parked.output);
    expect(await health(healthPort)).toEqual({ status: 503, body: { status: "degraded" } });
    await waitFor(() => parked.output().includes("salud del worker degradada"), "el detalle de degraded va al log", parked.output);
    // Cuando una persona lo reanuda (DBOS resumeWorkflow, como `dbos workflow
    // resume`), termina sin entregar dos veces y /health vuelve a ok sin reiniciar.
    const client = await DBOSClient.create({ systemDatabaseUrl: localSystemDatabaseUrl(), systemDatabaseSchemaName: "dbos" });
    try {
      await client.resumeWorkflow(BACKFILL_RETRY_ID);
    } finally {
      await client.destroy();
    }
    await waitFor(async () => (await workflowStatus(BACKFILL_RETRY_ID)) === "SUCCESS", "el relleno reanudado termina", parked.output);
    await waitFor(async () => (await health(healthPort)).status === 200, "/health vuelve a ok", parked.output);
    expect(await health(healthPort)).toEqual({ status: 200, body: { status: "ok" } });
    await stop(parked);
    expect(await workflowStatus(BACKFILL_ATTEMPTS[2] as string)).toBeNull();
    const afterResume = effects(file).filter((e) => e.step === "execute").map((e) => e.idempotencyKey);
    expect(afterResume.filter((key) => key === waiting.idempotencyKey)).toHaveLength(1);
    expect(afterResume.filter((key) => key === fresh.idempotencyKey)).toHaveLength(1);

    // Si no se puede leer el since del primer intento, el siguiente rellena
    // desde ahora menos su ventana y lo deja dicho en un warn.
    await admin.query("update dbos.workflow_status set status = 'ERROR' where workflow_uuid = $1", [BACKFILL_RETRY_ID]);
    await admin.query("delete from dbos.workflow_input where workflow_uuid = $1", [BACKFILL_ID]);
    const lost = startWorker(file, "after");
    await waitFor(() => /backfill: \d+ eventos encolados/.test(lost.output()), "el tercer intento termina y lo dice", lost.output);
    expect(lost.output()).toContain("backfill: no se pudo leer el since del primer intento");
    expect(await workflowStatus(BACKFILL_ATTEMPTS[2] as string)).toBe("SUCCESS");
    const thirdSince = await sinceOf(BACKFILL_ATTEMPTS[2] as string);
    expect(thirdSince).not.toBeNull();
    expect(Date.parse(thirdSince as string)).toBeGreaterThan(Date.parse(firstSince as string));
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await stop(lost);
    const afterLost = effects(file).filter((e) => e.step === "execute").map((e) => e.idempotencyKey);
    expect(afterLost.filter((key) => key === waiting.idempotencyKey)).toHaveLength(1);
    expect(afterLost.filter((key) => key === fresh.idempotencyKey)).toHaveLength(1);
  });
});
