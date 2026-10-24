// Proceso de prueba para resume.integration.ts: el worker real con un workflow
// de tres pasos. Cada paso apunta su efecto en un archivo (una línea JSON) para
// contar cuántas veces se ejecutó de verdad.
//
//   node three-steps-worker.ts start <workflowId> <archivo>    lo lanza y espera
//   node three-steps-worker.ts recover <workflowId> <archivo>  arranca y espera
//
// Con CRASH_AFTER_STEP2=1 el proceso se mata (SIGKILL) entre el paso 2 y el 3.
// Con HANG_IN_STEP3=1 se queda colgado dentro del paso 3 (apunta «step3-begin»)
// hasta que lo matan: un proceso vivo con un paso en curso.
import { appendFileSync } from "node:fs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [mode, workflowId, effectsFile] = process.argv.slice(2);
if ((mode !== "start" && mode !== "recover") || !workflowId || !effectsFile) {
  throw new Error("uso: three-steps-worker.ts start|recover <workflowId> <archivo>");
}

function effect(step: string): void {
  appendFileSync(effectsFile as string, `${JSON.stringify({ step, pid: process.pid })}\n`);
}

async function threeSteps(): Promise<string> {
  await DBOS.runStep(async () => effect("step1"), { name: "step1" });
  await DBOS.runStep(async () => effect("step2"), { name: "step2" });
  if (process.env["CRASH_AFTER_STEP2"] === "1") process.kill(process.pid, "SIGKILL");
  await DBOS.runStep(
    async () => {
      if (process.env["HANG_IN_STEP3"] === "1") {
        effect("step3-begin");
        await new Promise(() => {});
      }
      effect("step3");
    },
    { name: "step3" },
  );
  return "ok";
}
const threeStepsWorkflow = DBOS.registerWorkflow(threeSteps, { name: "testing.threeSteps" });

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  eventHandlers: [logHandler],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
await worker.start();
if (mode === "start") {
  await (await DBOS.startWorkflow(threeStepsWorkflow, { workflowID: workflowId })()).getResult();
} else {
  // Al arrancar, DBOS ya ha vuelto a lanzar los workflows PENDING de este
  // executorID: aquí solo se espera a que termine.
  await DBOS.retrieveWorkflow(workflowId).getResult();
}
await worker.stop();
