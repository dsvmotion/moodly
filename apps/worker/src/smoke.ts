import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { DBOS } from "@dbos-inc/dbos-sdk";

// Workflow de comprobación del worker desplegado (W2). Sin datos de clientes:
// solo dice qué proceso ejecutó cada paso y cuánto tardó en despertar.
//
//   1. paso «first»: apunta el proceso que lo ejecuta;
//   2. espera el mensaje «continue» (DBOS.recv) con un sondeo de 5 minutos, así
//      que si despierta enseguida es porque llegó el NOTIFY a través del pooler
//      (regla 8);
//   3. paso «second»: apunta el proceso y el tiempo desde que se envió el mensaje.
//
// Entre 1 y 3 se puede reiniciar el contenedor: el proceso nuevo, con el mismo
// executorID, recupera el workflow y el paso 1 no se repite (reglas 1 y 3).
// Lo encola y lo despierta `scripts/smoke.ts` con DBOSClient.

export const SMOKE_QUEUE = "smoke";
export const SMOKE_WORKFLOW = "smoke.durability";
export const SMOKE_TOPIC = "continue";

/** Lo que manda el script para despertar el workflow. */
export interface SmokeMessage {
  sentAtEpochMs: number;
}

export interface SmokeStep {
  /** Distinto en cada arranque del proceso: en un contenedor el pid se repite. */
  boot: string;
  pid: number;
  host: string;
  /** Despliegue de Railway, si lo hay: cambia con cada despliegue, no al reiniciar. */
  deployment: string | null;
  atEpochMs: number;
}

export interface SmokeResult {
  first: SmokeStep;
  second: SmokeStep;
  /** Del envío del mensaje a que el workflow lo recibió. */
  wakeLatencyMs: number | null;
  timedOut: boolean;
}

const BOOT_ID = randomUUID();

function whoAmI(): SmokeStep {
  return {
    boot: BOOT_ID,
    pid: process.pid,
    host: hostname(),
    deployment: process.env["RAILWAY_DEPLOYMENT_ID"] ?? null,
    atEpochMs: Date.now(),
  };
}

async function smokeDurability(maxWaitSeconds: number): Promise<SmokeResult> {
  const first = await DBOS.runStep(async () => whoAmI(), { name: "first" });
  const message = await DBOS.recv<SmokeMessage>(SMOKE_TOPIC, {
    timeoutSeconds: maxWaitSeconds,
    // Sondeo largo a propósito: sin NOTIFY, el workflow tardaría minutos.
    pollingIntervalMs: 300_000,
  });
  const receivedAt = await DBOS.runStep(async () => Date.now(), { name: "received" });
  const second = await DBOS.runStep(async () => whoAmI(), { name: "second" });
  return {
    first,
    second,
    wakeLatencyMs: message ? receivedAt - message.sentAtEpochMs : null,
    timedOut: message === null,
  };
}

/** Registra el workflow. Va antes de DBOS.launch(): DBOS solo recupera lo que conoce. */
export function registerSmokeWorkflow(): void {
  DBOS.registerWorkflow(smokeDurability, { name: SMOKE_WORKFLOW });
}

/** La cola vive en la base de datos: se registra después de DBOS.launch(). */
export async function registerSmokeQueue(): Promise<void> {
  await DBOS.registerQueue(SMOKE_QUEUE, { workerConcurrency: 1 });
}
