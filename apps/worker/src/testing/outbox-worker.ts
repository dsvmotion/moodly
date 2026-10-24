// Proceso de prueba para outbox.integration.ts: el worker real con un
// consumidor de invitation.created que apunta cada paso en un archivo (una
// línea JSON) e intenta un efecto sobre la invitación del payload, con el
// acceso que le da la entrega (la organización de la fila del evento).
//
//   node outbox-worker.ts <archivo>    arranca y sigue hasta SIGTERM o SIGKILL
//
// Con HANG_IN_TOUCH=1 se queda colgado dentro del paso «touch» (apunta
// «touch-begin») hasta que lo matan: una entrega a medias. Con TRIGGER_PRUNE=1,
// al arrancar lanza la limpieza horaria del outbox y apunta «pruned».
import { appendFileSync } from "node:fs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { loadConfig } from "../config.ts";
import type { EventHandler } from "../events/handlers.ts";
import { logHandler } from "../events/log-handler.ts";
import { PRUNE_SCHEDULE_NAME } from "../events/outbox.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [effectsFile] = process.argv.slice(2);
if (!effectsFile) throw new Error("uso: outbox-worker.ts <archivo>");

function effect(record: Record<string, unknown>): void {
  appendFileSync(effectsFile as string, `${JSON.stringify({ ...record, pid: process.pid })}\n`);
}

const testHandler: EventHandler = {
  key: "test.effects",
  eventTypes: ["invitation.created"],
  async handle(event, ctx) {
    await ctx.step("seen", async () =>
      effect({ step: "seen", eventId: event.id, organizationId: event.organizationId, payloadKeys: Object.keys(event.payload).sort() }),
    );
    // El efecto: revocar la invitación del payload. Solo puede tocar las de la
    // organización de la fila, que es la única a la que llega ctx.db.
    const touched = await ctx.step("touch", async () => {
      if (process.env["HANG_IN_TOUCH"] === "1") {
        effect({ step: "touch-begin", eventId: event.id });
        await new Promise(() => {});
      }
      const { data, error } = await ctx.db
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", String(event.payload["invitation_id"]))
        .is("revoked_at", null)
        .select("id");
      if (error) throw new Error(`no se pudo revocar (${error.code})`);
      return data.length;
    });
    await ctx.step("done", async () => effect({ step: "done", eventId: event.id, touched }));
  },
};

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  eventHandlers: [logHandler, testHandler],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
effect({ step: "started" });
if (process.env["TRIGGER_PRUNE"] === "1") {
  await (await DBOS.triggerSchedule(PRUNE_SCHEDULE_NAME)).getResult();
  effect({ step: "pruned" });
}
