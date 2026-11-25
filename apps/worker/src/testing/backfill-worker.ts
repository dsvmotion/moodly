// Proceso de prueba para outbox-backfill.integration.ts (W3): el worker real en
// dos momentos.
//
//   BACKFILL_PHASE=before  solo el consumidor log: así estaba el worker antes
//                          de que existiera agent.approval.
//   BACKFILL_PHASE=after   además agent.approval (con su relleno de 24 h y una
//                          skill de prueba, backfill_probe, que apunta cada
//                          ejecución) y test.late, que llega a la vez pero sin
//                          relleno: lo de antes no le debe llegar.
//
//   BACKFILL_PHASE=… node backfill-worker.ts <archivo>
import { appendFileSync } from "node:fs";
import type { SkillDefinition } from "@repo/agent-core";
import { z } from "zod";
import { createApprovalHandler } from "../agents/approvals.ts";
import { codeSkills } from "../agents/converse.ts";
import { loadConfig } from "../config.ts";
import type { EventHandler } from "../events/handlers.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [effectsFile] = process.argv.slice(2);
if (!effectsFile) throw new Error("uso: backfill-worker.ts <archivo>");
const phase = process.env["BACKFILL_PHASE"];
if (phase !== "before" && phase !== "after") throw new Error("BACKFILL_PHASE: before o after");

function effect(record: Record<string, unknown>): void {
  appendFileSync(effectsFile as string, `${JSON.stringify(record)}\n`);
}

export const PROBE_SKILL_KEY = "backfill_probe";

const probe: SkillDefinition<{ n: number }, { ok: true }> = {
  key: PROBE_SKILL_KEY,
  version: 1,
  description: "Prueba del relleno: apunta que se ejecutó.",
  effectClass: "internal_write",
  defaultAutonomy: "draft",
  input: z.object({ n: z.number().int() }),
  output: z.object({ ok: z.literal(true) }),
  async preview() {
    return { summary: "prueba" };
  },
  async execute(ctx) {
    effect({ step: "execute", idempotencyKey: ctx.idempotencyKey });
    return { ok: true };
  },
};

const late: EventHandler = {
  key: "test.late",
  eventTypes: ["approval.decided"],
  async handle(event, ctx) {
    await ctx.step("seen", async () => effect({ step: "late", eventId: event.id }));
  },
};

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const handlers: EventHandler[] = [logHandler];
if (phase === "after") {
  handlers.push(
    // Las de verdad más la de prueba: si el relleno recoge una decisión vieja de
    // otro test, le pasa lo mismo que le pasaría en producción.
    createApprovalHandler({ skills: (db, options) => new Map([...codeSkills(db, options), [probe.key, probe as SkillDefinition<unknown>]]) }),
    late,
  );
}
const worker = createWorker(config, logger, {
  eventHandlers: handlers,
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
