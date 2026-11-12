import { createHash } from "node:crypto";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { AUTONOMY_LEVELS, EFFECT_CLASSES, decide } from "@repo/agent-core";
import type { AutonomyLevel, ConsentChecker, SkillContext, SkillDefinition, Target } from "@repo/agent-core";
import type { Json } from "@repo/db";
import type { TenantDb } from "@repo/db/service";
import { z } from "zod";
import { agentAnswers } from "./converse.ts";

// Las skills que lanza la plataforma y no el modelo: los recordatorios de las
// citas (4e-2) y las ofertas de la lista de espera (4f-2). Las dos salen por la
// conversación de un cliente, con el agente de esa conversación, por el motor
// de políticas, y dejan un run (trigger schedule) con su ejecución. Lo común
// vive aquí; cada workflow pone sus pasos con su propio prefijo.

export function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

/** El run de un envío programado: siempre el mismo id para la misma clave (un UUID v8 derivado). */
export function scheduledRunId(handlerKey: string, key: string): string {
  const hex = createHash("sha256").update(`${handlerKey}:${key}`).digest("hex");
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const contextSchema = z.object({
  agent: z.object({ id: z.uuid(), status: z.string() }),
  organization: z.object({ default_locale: z.string() }),
  skills: z.array(
    z.object({
      key: z.string(),
      version: z.number().int(),
      kind: z.string(),
      effect_class: z.enum(EFFECT_CLASSES),
      enabled: z.boolean(),
      autonomy_level: z.enum(AUTONOMY_LEVELS),
    }),
  ),
});

/** El agente que contesta en una conversación, listo para enviar por ella. Serializable: es el resultado de un paso. */
export interface ConversationAgent {
  kind: "ready";
  conversationId: string;
  agentId: string;
  defaultLocale: string;
  settings: { enabled: boolean; autonomy: AutonomyLevel };
}

/**
 * Si se puede enviar por esta conversación con esta skill: existe, la lleva el
 * agente (ni cerrada ni en manos de una persona), su agente contesta en ese canal y tiene la skill con la versión y la
 * clase del código. Si no, por qué.
 */
export async function conversationAgent(
  db: TenantDb,
  conversationId: string,
  skill: Pick<SkillDefinition<unknown>, "key" | "version" | "effectClass">,
): Promise<ConversationAgent | { kind: "skip"; reason: string }> {
  const conversation = check(
    await db.from("conversations").select("id, agent_id, mode, channel_account_id").eq("id", conversationId).maybeSingle(),
    "la conversación",
  );
  if (!conversation) return { kind: "skip", reason: "conversation_missing" };
  if (conversation.mode === "closed") return { kind: "skip", reason: "conversation_closed" };
  // Con la conversación en manos de una persona, el agente no escribe (R-02): ni recordatorios ni ofertas.
  if (conversation.mode !== "agent") return { kind: "skip", reason: "not_agent_mode" };
  const raw = await db.agentTurnContext(conversation.agent_id);
  if (!raw) return { kind: "skip", reason: "agent_missing" };
  const context = contextSchema.parse(raw);
  const account = check(await db.from("channel_accounts").select("channel").eq("id", conversation.channel_account_id).maybeSingle(), "el canal");
  if (!agentAnswers(context.agent.status, account?.channel ?? null)) return { kind: "skip", reason: "agent_not_answering" };
  const row = context.skills.find((candidate) => candidate.key === skill.key);
  if (!row || row.kind !== "code" || row.version !== skill.version || row.effect_class !== skill.effectClass) {
    return { kind: "skip", reason: "skill_not_configured" };
  }
  return {
    kind: "ready",
    conversationId: conversation.id,
    agentId: conversation.agent_id,
    defaultLocale: context.organization.default_locale,
    settings: { enabled: row.enabled, autonomy: row.autonomy_level },
  };
}

interface Decided {
  outcome: string;
  reason?: string;
  input?: unknown;
  target?: Target;
  inputHash?: string;
  autonomy?: AutonomyLevel;
}

async function startRun(db: TenantDb, runId: string, locationId: string, agentId: string, ref: string): Promise<void> {
  const { error } = await db.from("agent_runs").insert({
    id: runId,
    location_id: locationId,
    agent_id: agentId,
    trigger: "schedule",
    trigger_ref: ref,
    status: "running",
  });
  // 23505: ya existía (el workflow se reanudó después de crearlo).
  if (error && error.code !== "23505") throw new Error(`no se pudo crear el run (${error.code})`);
}

async function recordExecution(
  db: TenantDb,
  runId: string,
  locationId: string,
  skill: SkillDefinition<unknown>,
  decided: Required<Pick<Decided, "input" | "target" | "inputHash" | "autonomy">>,
  key: string,
  status: "executed" | "failed",
  output: unknown,
): Promise<void> {
  const { error } = await db.from("executions").insert({
    run_id: runId,
    location_id: locationId,
    skill_key: skill.key,
    skill_version: skill.version,
    effect_class: skill.effectClass,
    autonomy_applied: decided.autonomy,
    input: decided.input as NonNullable<Json>,
    target: decided.target as unknown as NonNullable<Json>,
    input_hash: decided.inputHash,
    preview: null,
    output: (output ?? null) as Json,
    status,
    idempotency_key: key,
  });
  if (error && error.code !== "23505") throw new Error(`no se pudo guardar la ejecución (${error.code})`);
}

async function finishRun(db: TenantDb, runId: string, status: "completed" | "failed"): Promise<void> {
  const { error } = await db.from("agent_runs").update({ status }).eq("id", runId).eq("status", "running");
  if (error) throw new Error(`no se pudo cerrar el run (${error.code})`);
}

export interface ScheduledSend {
  db: TenantDb;
  organizationId: string;
  locationId: string;
  contactId: string;
  agent: ConversationAgent;
  skill: SkillDefinition<unknown>;
  args: Record<string, unknown>;
  consent: ConsentChecker;
  /** La clave de idempotencia: la de la ejecución y la del mensaje. */
  key: string;
  runId: string;
  /** Lo que se guarda en agent_runs.trigger_ref. */
  ref: string;
  /** El prefijo de los pasos de DBOS: no cambia mientras haya workflows pendientes (ADR 0027, regla 7). */
  step: string;
}

/** Cómo terminó: si no se ejecutó, la decisión y por qué; si se ejecutó y falló, el nombre del error. */
export type ScheduledResult =
  | { sent: false; outcome: string; reason?: string }
  | { sent: true; status: "executed" }
  | { sent: false; outcome: "execute"; status: "failed"; error: string };

/**
 * Decide, y solo con execute: abre el run, ejecuta la skill, guarda la
 * ejecución y cierra el run. Cada cosa, un paso de DBOS: un reintento no envía
 * dos veces (la clave del mensaje y la de la ejecución son la misma).
 */
export async function sendScheduled(send: ScheduledSend): Promise<ScheduledResult> {
  const { db, skill, agent, step } = send;
  const decided = await DBOS.runStep(
    async (): Promise<Decided> => {
      const decision = await decide({
        proposal: { skillKey: skill.key, args: send.args },
        scope: {
          organizationId: send.organizationId,
          locationId: send.locationId,
          runId: send.runId,
          conversation: { id: agent.conversationId, contactId: send.contactId },
        },
        skills: new Map([[skill.key, skill]]),
        settings: new Map([[skill.key, agent.settings]]),
        consent: send.consent,
      });
      if (decision.outcome === "reject") return { outcome: "reject", reason: decision.reason };
      return { outcome: decision.outcome, input: decision.input, target: decision.target, inputHash: decision.inputHash, autonomy: decision.autonomy };
    },
    { name: `${step}:decide` },
  );
  if (decided.outcome !== "execute" || !decided.target || !decided.inputHash || !decided.autonomy) {
    return { sent: false, outcome: decided.outcome, ...(decided.reason ? { reason: decided.reason } : {}) };
  }
  const executable = { input: decided.input, target: decided.target, inputHash: decided.inputHash, autonomy: decided.autonomy };
  await DBOS.runStep(() => startRun(db, send.runId, send.locationId, agent.agentId, send.ref), { name: `${step}:run:start` });
  const ctx: SkillContext = {
    organizationId: send.organizationId,
    locationId: send.locationId,
    runId: send.runId,
    contactId: send.contactId,
    conversationId: agent.conversationId,
    target: decided.target,
    idempotencyKey: send.key,
  };
  let output: unknown = null;
  let status: "executed" | "failed" = "executed";
  let error = "";
  try {
    output = await DBOS.runStep(() => skill.execute(ctx, skill.input.parse(decided.input)), { name: `${step}:execute` });
  } catch (err) {
    // Si una persona tomó el control entre la carga y el envío, la base de datos
    // no guarda el mensaje (R-02): queda como fallida con ese nombre de error.
    status = "failed";
    error = (err as Error).name;
  }
  await DBOS.runStep(() => recordExecution(db, send.runId, send.locationId, skill, executable, send.key, status, output), { name: `${step}:record` });
  await DBOS.runStep(() => finishRun(db, send.runId, status === "executed" ? "completed" : "failed"), { name: `${step}:run:finish` });
  return status === "executed" ? { sent: true, status } : { sent: false, outcome: "execute", status, error };
}
