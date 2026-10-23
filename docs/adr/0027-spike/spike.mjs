// Spike del ADR 0027: DBOS Transact 5.2.11 contra un Postgres local (no forma
// parte de ningún workspace; instrucciones en el README de esta carpeta).
// Cada efecto de un paso se apunta en la tabla effects, fuera de DBOS, para
// contar cuántas veces se ejecutó de verdad.
import { DBOS, DBOSClient } from "@dbos-inc/dbos-sdk";
import pg from "pg";

// SPIKE_DATABASE_URL: una base de datos de usar y tirar en el Postgres local.
// SYS_URL / SYS_SCHEMA: la de DBOS, si es otra (p. ej. con el rol sin DDL).
const EFFECTS_URL = process.env.SPIKE_DATABASE_URL;
if (!EFFECTS_URL) throw new Error("Falta SPIKE_DATABASE_URL");
const URL = process.env.SYS_URL ?? EFFECTS_URL;
const SCHEMA = process.env.SYS_SCHEMA ?? "dbos";
const pool = new pg.Pool({ connectionString: EFFECTS_URL, max: 4 });
const [cmd, arg] = process.argv.slice(2);
console.log(`pid ${process.pid} ${cmd}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function effect(run, step, extra = null) {
  await pool.query("insert into effects (run, step, pid, extra) values ($1, $2, $3, $4)", [run, step, process.pid, extra]);
}

// 1) Tres pasos; con CRASH=1 el proceso muere (SIGKILL) entre el paso 2 y el 3.
async function threeStepsFn(run) {
  await DBOS.runStep(() => effect(run, "step1"), { name: "step1" });
  await DBOS.runStep(() => effect(run, "step2"), { name: "step2" });
  if (process.env.CRASH === "1") process.kill(process.pid, "SIGKILL");
  await DBOS.runStep(() => effect(run, "step3"), { name: "step3" });
  return "ok";
}
const threeSteps = DBOS.registerWorkflow(threeStepsFn, { name: "threeSteps" });

// 2) Un webhook: un paso lento para que dos llegadas se solapen.
async function inboundFn(eventId) {
  await DBOS.runStep(async () => { await sleep(300); await effect(eventId, "process"); }, { name: "process" });
  return eventId;
}
const inbound = DBOS.registerWorkflow(inboundFn, { name: "inbound" });

// 3) Un mensaje de una conversación: apunta inicio y fin.
async function messageFn(conversation, message) {
  await DBOS.runStep(async () => {
    await effect(conversation, "start", message);
    if (process.env.KILL_ON === `${conversation}:${message}`) process.kill(process.pid, "SIGKILL");
    await sleep(400);
    await effect(conversation, "end", message);
  }, { name: "handle" });
}
const handleMessage = DBOS.registerWorkflow(messageFn, { name: "handleMessage" });

// 4) Espera una aprobación (recv con caducidad) y después ejecuta.
async function approvalFn(run) {
  await DBOS.runStep(() => effect(run, "draft"), { name: "draft" });
  await DBOS.setEvent("state", "awaiting_approval");
  const decision = await DBOS.recv("approval.decided", { timeoutSeconds: 3600 });
  await DBOS.runStep(() => effect(run, "execute", JSON.stringify(decision)), { name: "execute" });
  return decision;
}
const awaitApproval = DBOS.registerWorkflow(approvalFn, { name: "awaitApproval" });

// Solapamiento: un paso largo para matar o duplicar el proceso a mitad.
async function longStepFn(run) {
  await DBOS.runStep(async () => { await effect(run, "long:start"); await sleep(4000); await effect(run, "long:end"); }, { name: "long" });
  await DBOS.runStep(() => effect(run, "after"), { name: "after" });
}
const longStep = DBOS.registerWorkflow(longStepFn, { name: "longStep" });

async function launch() {
  DBOS.setConfig({
    name: "moodly-spike",
    systemDatabaseUrl: URL,
    systemDatabaseSchemaName: SCHEMA,
    runMigrations: process.env.RUN_MIGRATIONS !== "0",
    applicationVersion: "spike-1",
    executorID: process.env.EXECUTOR ?? "local",
    logLevel: "warn",
  });
  await DBOS.launch();
  await DBOS.registerQueue("conversations", { partitionConcurrency: 1, workerConcurrency: 20, minPollingIntervalMs: 100 });
}

async function main() {
  await pool.query(`create table if not exists effects (
    id bigserial primary key, run text, step text, pid int, extra text, at timestamptz default clock_timestamp())`);
  switch (cmd) {
    case "crash": {
      await launch();
      const h = await DBOS.startWorkflow(threeSteps, { workflowID: arg })(arg);
      console.log("result", await h.getResult());
      break;
    }
    case "worker": {
      // Solo arranca (recupera lo pendiente de su executor y atiende la cola) durante N segundos.
      await launch();
      if (process.env.KILL_AFTER_MS) setTimeout(() => process.kill(process.pid, "SIGKILL"), Number(process.env.KILL_AFTER_MS));
      await sleep(Number(process.env.SECONDS ?? 8) * 1000);
      break;
    }
    case "adopt": {
      // Otro proceso recoge lo que dejó a medias un executor muerto (arg).
      await launch();
      const pending = await DBOS.listWorkflows({ executorId: arg, status: "PENDING" });
      console.log("pending of", arg, pending.map((w) => w.workflowID).join(","));
      // Cada uno vuelve a SU cola (con su partición y su created_at), no a la interna.
      for (const w of pending) await DBOS.resumeWorkflow(w.workflowID, w.queueName ? { queueName: w.queueName } : {});
      await sleep(Number(process.env.SECONDS ?? 6) * 1000);
      break;
    }
    case "result": {
      await launch();
      console.log("result", JSON.stringify(await DBOS.retrieveWorkflow(arg).getResult()));
      break;
    }
    case "dup": {
      await launch();
      const [a, b] = await Promise.all([
        DBOS.startWorkflow(inbound, { workflowID: `inbound:${arg}` })(arg),
        DBOS.startWorkflow(inbound, { workflowID: `inbound:${arg}` })(arg),
      ]);
      console.log("ids", a.workflowID, b.workflowID, await a.getResult(), await b.getResult());
      break;
    }
    case "enqueue": {
      // Desde fuera del worker (como la web o el receptor de webhooks), con DBOSClient.
      const client = await DBOSClient.create({ systemDatabaseUrl: URL, systemDatabaseSchemaName: SCHEMA, applicationName: "moodly-spike" });
      const plan = arg.split(","); // p. ej. A:1,B:1,A:2,...
      for (const item of plan) {
        const [conversation, n] = item.split(":");
        await client.enqueue(
          { queueName: "conversations", workflowName: "handleMessage", workflowID: `msg:${conversation}:${n}`, queuePartitionKey: conversation, appVersion: "spike-1" },
          conversation, n,
        );
      }
      await client.destroy();
      break;
    }
    case "approve": {
      const client = await DBOSClient.create({ systemDatabaseUrl: URL, systemDatabaseSchemaName: SCHEMA, applicationName: "moodly-spike" });
      await client.send(arg, { decision: "approved", by: "u1" }, "approval.decided", `approval:${arg}`);
      await client.destroy();
      console.log("sent");
      break;
    }
    case "approval": {
      await launch();
      const h = await DBOS.startWorkflow(awaitApproval, { workflowID: arg })(arg);
      console.log("state", await DBOS.getEvent(arg, "state", 10));
      if (process.env.CRASH === "1") process.kill(process.pid, "SIGKILL");
      console.log("result", JSON.stringify(await h.getResult()));
      break;
    }
    case "long": {
      await launch();
      const h = await DBOS.startWorkflow(longStep, { workflowID: arg })(arg);
      await h.getResult();
      console.log("done");
      break;
    }
    default:
      throw new Error(`comando desconocido: ${cmd}`);
  }
  await DBOS.shutdown();
  await pool.end();
}

main().catch(async (e) => { console.error("ERROR", e?.name, e?.message); process.exit(1); });
