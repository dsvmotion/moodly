// Comprobaciones del worker contra staging (W2), con el rol dbos_worker y el
// pooler en modo sesión. Las lanza a mano el workflow «Staging · worker»; no
// tocan datos de clientes (solo el esquema dbos).
//
//   node staging-check.ts connect                    login, TLS y versión del esquema dbos
//   node staging-check.ts lease                      el pooler suelta el lock de un proceso muerto
//   node staging-check.ts lease-hold <executorId>    (interno) toma el lock y espera
//   node staging-check.ts smoke-enqueue <workflowId> encola el workflow de comprobación
//   node staging-check.ts smoke-finish <workflowId>  lo despierta y comprueba el resultado
//
// Lee WORKER_SYSTEM_DATABASE_URL. Nunca la imprime: lleva la contraseña.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { DBOSClient } from "@dbos-inc/dbos-sdk";
import pg from "pg";
import { leaseKey } from "../src/lease.ts";
import { SMOKE_QUEUE, SMOKE_TOPIC, SMOKE_WORKFLOW, type SmokeMessage, type SmokeResult } from "../src/smoke.ts";

const url = process.env["WORKER_SYSTEM_DATABASE_URL"];
if (!url) throw new Error("falta WORKER_SYSTEM_DATABASE_URL");
const [command, arg] = process.argv.slice(2);

function report(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function fail(message: string, data?: unknown): never {
  if (data !== undefined) report(data);
  process.stderr.write(`::error::${message}\n`);
  process.exit(1);
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const TRY_LOCK = "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked";

async function connect(): Promise<void> {
  const row = await withClient(async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `select current_user as role,
              (select ssl from pg_stat_ssl where pid = pg_backend_pid()) as ssl,
              (select max(version) from dbos.dbos_migrations) as dbos_schema_version,
              has_schema_privilege('dbos', 'CREATE') as can_create_in_dbos`,
    );
    return rows[0];
  });
  report(row);
  if (row?.["role"] !== "dbos_worker") fail("no entra como dbos_worker", row);
  if (row?.["ssl"] !== true) fail("la conexión no va cifrada", row);
  if (row?.["can_create_in_dbos"] !== false) fail("dbos_worker puede crear en dbos", row);
}

async function leaseHold(executorId: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ locked: boolean }>(TRY_LOCK, [leaseKey(executorId)]);
  if (!rows[0]?.locked) fail("no pude tomar el lock de prueba");
  process.stdout.write("held\n");
  await new Promise(() => {}); // hasta que lo maten
}

// Regla 1 a través del pooler: si el proceso que tiene el lock muere, el
// pooler tiene que cerrar (o limpiar) su sesión para que Postgres lo suelte.
// Si no lo hiciera, el worker nuevo esperaría para siempre.
async function lease(): Promise<void> {
  const executorId = `lease-check-${randomUUID().slice(0, 8)}`;
  const holder = spawn(process.execPath, [import.meta.filename, "lease-hold", executorId], {
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((resolve, reject) => {
    holder.stdout.on("data", (chunk: Buffer) => chunk.toString().includes("held") && resolve());
    holder.on("exit", () => reject(new Error("el proceso de prueba salió antes de tomar el lock")));
  });

  await withClient(async (client) => {
    const whileAlive = (await client.query<{ locked: boolean }>(TRY_LOCK, [leaseKey(executorId)])).rows[0]?.locked;
    if (whileAlive) fail("con el primer proceso vivo, otro pudo tomar el lock");

    holder.kill("SIGKILL");
    const killedAt = Date.now();
    for (;;) {
      const { rows } = await client.query<{ locked: boolean }>(TRY_LOCK, [leaseKey(executorId)]);
      if (rows[0]?.locked) break;
      if (Date.now() - killedAt > 60_000) fail("el pooler no soltó el lock en 60 s tras matar al proceso");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    report({ lockedWhileAlive: false, releasedAfterKillMs: Date.now() - killedAt });
  });
}

async function withDbos<T>(fn: (client: DBOSClient) => Promise<T>): Promise<T> {
  const client = await DBOSClient.create({ systemDatabaseUrl: url as string, systemDatabaseSchemaName: "dbos" });
  try {
    return await fn(client);
  } finally {
    await client.destroy();
  }
}

async function smokeEnqueue(workflowID: string): Promise<void> {
  await withDbos(async (client) => {
    // 15 minutos para reiniciar el contenedor entre este paso y smoke-finish.
    await client.enqueue({ queueName: SMOKE_QUEUE, workflowName: SMOKE_WORKFLOW, workflowID }, 900);
    const deadline = Date.now() + 120_000;
    for (;;) {
      const steps = (await client.listWorkflowSteps(workflowID)) ?? [];
      if (steps.some((step) => step.name === "first")) break;
      if (Date.now() > deadline) fail("el worker no ejecutó el primer paso en 2 minutos (¿está arrancado?)");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    const status = await client.retrieveWorkflow(workflowID).getStatus();
    report({ workflowID, status: status?.status, executorId: status?.executorId, applicationVersion: status?.applicationVersion });
  });
}

async function smokeFinish(workflowID: string): Promise<void> {
  const expectRestart = process.env["EXPECT_RESTART"] === "true";
  await withDbos(async (client) => {
    const message: SmokeMessage = { sentAtEpochMs: Date.now() };
    await client.send(workflowID, message, SMOKE_TOPIC);
    const handle = client.retrieveWorkflow<SmokeResult>(workflowID);
    const result = await Promise.race([
      handle.getResult(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("sin resultado en 2 minutos")), 120_000)),
    ]);
    const steps = ((await client.listWorkflowSteps(workflowID)) ?? []).map((step) => step.name);
    report({ workflowID, result, steps });

    if (result.timedOut) fail("el workflow no recibió el mensaje", result);
    // Con un sondeo de 5 minutos, despertar en menos de 10 s solo es posible
    // si llegó el NOTIFY a través del pooler (regla 8).
    if (result.wakeLatencyMs === null || result.wakeLatencyMs > 10_000) fail("no despertó por NOTIFY", result);
    if (steps.filter((name) => name === "first").length !== 1) fail("el primer paso se repitió", steps);
    if (expectRestart && result.first.boot === result.second.boot) {
      fail("se esperaba un reinicio entre los dos pasos y los ejecutó el mismo proceso", result);
    }
  });
}

switch (command) {
  case "connect":
    await connect();
    break;
  case "lease":
    await lease();
    break;
  case "lease-hold":
    await leaseHold(arg ?? fail("falta el executorId"));
    break;
  case "smoke-enqueue":
    await smokeEnqueue(arg ?? fail("falta el workflowId"));
    break;
  case "smoke-finish":
    await smokeFinish(arg ?? fail("falta el workflowId"));
    break;
  default:
    fail("uso: staging-check.ts connect|lease|smoke-enqueue <id>|smoke-finish <id>");
}
process.exit(0);
