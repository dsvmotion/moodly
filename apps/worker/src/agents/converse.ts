import { createHash } from "node:crypto";
import { AUTONOMY_LEVELS, EFFECT_CLASSES, composeSystemPrompt, policyFromSettings, runAgentTurn } from "@repo/agent-core";
import type { BookableService, HistoryMessage, ModelRouter, SkillDefinition, SkillSettings, TurnExecution, TurnResult } from "@repo/agent-core";
import type { Json } from "@repo/db";
import type { TenantDb } from "@repo/db/service";
import {
  APPOINTMENT_REMINDER_SKILL_KEY,
  FIND_SLOTS_SKILL_KEY,
  WAITLIST_OFFER_SKILL_KEY,
  createJoinWaitlistSkill,
  createReceptionSkills,
  createReplySkill,
} from "@repo/skills";
import type { Logger } from "pino";
import { z } from "zod";
import { createMoodlyCalendar } from "../booking/moodly-calendar.ts";
import { createMoodlyWaitlist } from "../booking/moodly-waitlist.ts";
import { handleOptOut } from "../reminders/consent.ts";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";
import { AWAITING_PERSON, requestApproval } from "./approvals.ts";
import { createConversationSender } from "./conversation-sender.ts";
import { createReceptionCatalog } from "./reception-catalog.ts";

// El turno del agente en el worker (paso 4d-2, MANUAL §5.1): consume
// message.received y ejecuta runAgentTurn con pasos de DBOS.
//
// - El tenant es el de la fila del evento (control 3.7): ctx.db solo llega a
//   esa organización, y la conversación, el contacto y el local salen de sus
//   filas, nunca del mensaje ni de lo que diga el modelo.
// - No contesta si la conversación la lleva una persona (mode = 'human'), si
//   ya hay un mensaje del cliente más nuevo (lo contestará su propio turno) o
//   si el agente no está en live ni en testing. En el chat de pruebas de la
//   app (canal 'test', paso 4d-3e), también en draft: se prueba antes de
//   publicarlo. En pausa, nunca.
// - El run tiene un id que sale del evento: si la entrega se reanuda, es el
//   mismo run y las mismas claves de idempotencia.
// - Cada ejecución decidida se guarda en executions en cuanto se decide; las
//   rechazadas por el motor no tienen hash ni entrada válida y van al log (sin
//   sus argumentos, que son lo que dijo el modelo).

export const CONVERSE_HANDLER_KEY = "agent.converse";
const HISTORY_LIMIT = 20;
const ANSWERING = new Set(["live", "testing"]);
/** El canal del chat de pruebas de la app (paso 4d-3e). */
export const TEST_CHANNEL = "test";

/** Si el agente contesta en una conversación: en live y testing; en el chat de pruebas, también en draft. */
export function agentAnswers(agentStatus: string, channel: string | null): boolean {
  if (ANSWERING.has(agentStatus)) return true;
  return agentStatus === "draft" && channel === TEST_CHANNEL;
}
/** Los servicios que van en el prompt, como mucho (4d-3c). Si hay más, el prompt lo dice. */
export const MAX_PROMPT_SERVICES = 50;

export interface ConverseOptions {
  router: ModelRouter;
}

/** El id del run de un evento: siempre el mismo para la misma entrega (UUID de 128 bits del SHA-256). */
export function runIdFor(eventId: string): string {
  const hex = createHash("sha256").update(`${CONVERSE_HANDLER_KEY}:${eventId}`).digest("hex");
  // Versión 8 (RFC 9562: derivado a medida) y variante RFC.
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  location_id: string | null;
}

/**
 * Lo que se puede reservar en el local de la conversación: los servicios de
 * toda la organización y los de ese local, por nombre y como mucho `max`. Sin
 * local no se puede buscar hueco (find_slots lo exige), así que no hay nada.
 */
export function bookableServices(
  rows: readonly ServiceRow[],
  locationId: string | null,
  max = MAX_PROMPT_SERVICES,
): { services: BookableService[]; truncated: boolean } {
  if (!locationId) return { services: [], truncated: false };
  const here = rows
    .filter((row) => row.location_id === null || row.location_id === locationId)
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
  return {
    services: here.slice(0, max).map((row) => ({ id: row.id, name: row.name, durationMinutes: row.duration_minutes })),
    truncated: here.length > max,
  };
}


/**
 * Cómo queda el run según cómo acabó el turno: si algo espera a una persona
 * (la respuesta o una cita en borrador), espera aprobación aunque el agente ya
 * haya contestado (MANUAL §5.1).
 */
export function runStatusFor(result: TurnResult): "completed" | "awaiting_approval" | "handed_off" {
  if (result.status === "handed_off") return "handed_off";
  if (result.status !== "replied" || result.executions.some((execution) => AWAITING_PERSON.has(execution.status))) return "awaiting_approval";
  return "completed";
}

const contextSchema = z.object({
  agent: z.object({ id: z.uuid(), status: z.string(), display_name: z.string().nullable(), type_key: z.string(), type_name: z.string() }),
  organization: z.object({ name: z.string(), default_locale: z.string() }),
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
export type TurnContext = z.infer<typeof contextSchema>;

interface Conversation {
  id: string;
  location_id: string | null;
  contact_id: string;
  agent_id: string;
}

type Prepared =
  | { kind: "skip"; reason: string }
  | {
      kind: "turn";
      conversation: Conversation;
      context: TurnContext;
      history: HistoryMessage[];
      location: { name: string; timezone: string } | null;
      modelSettings: unknown;
      dayEur: number;
      /** Solo si el agente busca huecos: lo que se puede reservar en el local. */
      services: BookableService[] | null;
      servicesTruncated: boolean;
      /** La hora del turno, fijada dentro del paso: al reanudar es la misma. */
      now: string;
    };

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

async function prepare(db: TenantDb, conversationId: string, messageId: string): Promise<Prepared> {
  const conversation = check(
    await db.from("conversations").select("id, location_id, contact_id, agent_id, mode, channel_account_id").eq("id", conversationId).maybeSingle(),
    "la conversación",
  );
  if (!conversation) return { kind: "skip", reason: "conversation_missing" };
  if (conversation.mode !== "agent") return { kind: "skip", reason: "not_agent_mode" };

  const latest = check(
    await db
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("author", "contact")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "el último mensaje",
  );
  if (latest?.id !== messageId) return { kind: "skip", reason: "newer_message" };

  const raw = await db.agentTurnContext(conversation.agent_id);
  if (!raw) return { kind: "skip", reason: "agent_missing" };
  const context = contextSchema.parse(raw);
  if (!ANSWERING.has(context.agent.status)) {
    const account = check(
      await db.from("channel_accounts").select("channel").eq("id", conversation.channel_account_id).maybeSingle(),
      "el canal de la conversación",
    );
    if (!agentAnswers(context.agent.status, account?.channel ?? null)) return { kind: "skip", reason: "agent_not_answering" };
  }

  const messages = check(
    await db
      .from("messages")
      .select("author, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    "el historial",
  );
  const location = conversation.location_id
    ? check(await db.from("locations").select("name, timezone").eq("id", conversation.location_id).maybeSingle(), "el local")
    : null;
  const modelSettings = check(
    await db
      .from("org_model_settings")
      .select("residency, allowed_providers, model_by_task, connection, budget_per_run_eur, budget_per_day_eur")
      .maybeSingle(),
    "la política de modelos",
  );
  // Un modelo real no sabe el service_id que pide find_slots: va en el prompt.
  const books = context.skills.some((skill) => skill.key === FIND_SLOTS_SKILL_KEY && skill.enabled);
  const serviceRows =
    books && conversation.location_id
      ? check(
          await db
            .from("services")
            .select("id, name, duration_minutes, location_id")
            .eq("active", true)
            .or(`location_id.is.null,location_id.eq.${conversation.location_id}`)
            .order("name")
            .limit(MAX_PROMPT_SERVICES + 1),
          "los servicios",
        )
      : [];
  const bookable = books ? bookableServices(serviceRows ?? [], conversation.location_id) : null;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const today = check(await db.from("agent_runs").select("cost_eur").gte("created_at", startOfDay).limit(10_000), "el gasto del día");

  return {
    kind: "turn",
    conversation: { id: conversation.id, location_id: conversation.location_id, contact_id: conversation.contact_id, agent_id: conversation.agent_id },
    context,
    history: (messages ?? []).reverse().map((message) => ({ author: message.author as HistoryMessage["author"], content: message.content })),
    location,
    modelSettings,
    dayEur: (today ?? []).reduce((sum, run) => sum + Number(run.cost_eur), 0),
    services: bookable?.services ?? null,
    servicesTruncated: bookable?.truncated ?? false,
    now: now.toISOString(),
  };
}

/** Las skills de código que el worker sabe ejecutar, sobre los datos de esta organización. */
export function codeSkills(db: TenantDb): Map<string, SkillDefinition<unknown>> {
  const reception = createReceptionSkills({ booking: createMoodlyCalendar(db), catalog: createReceptionCatalog(db) });
  const reply = createReplySkill({ sender: createConversationSender(db) });
  const joinWaitlist = createJoinWaitlistSkill({ store: createMoodlyWaitlist(db) });
  const all = [...Object.values(reception), reply, joinWaitlist] as unknown as SkillDefinition<unknown>[];
  return new Map(all.map((skill) => [skill.key, skill]));
}

/** Las que lanza la plataforma y no el modelo (los recordatorios, 4e, y las ofertas de la lista de espera, 4f-2): nunca se le ofrecen como herramienta. */
export const PLATFORM_TRIGGERED_SKILLS: ReadonlySet<string> = new Set([APPOINTMENT_REMINDER_SKILL_KEY, WAITLIST_OFFER_SKILL_KEY]);

/** Las del agente que existen en el código con la misma versión que en el catálogo; las demás no se le ofrecen. */
export function agentSkills(available: Map<string, SkillDefinition<unknown>>, configured: TurnContext["skills"], log: Logger) {
  const skills = new Map<string, SkillDefinition<unknown>>();
  const settings = new Map<string, SkillSettings>();
  for (const row of configured) {
    if (PLATFORM_TRIGGERED_SKILLS.has(row.key)) continue;
    const skill = available.get(row.key);
    if (row.kind !== "code" || !skill || skill.version !== row.version || skill.effectClass !== row.effect_class) {
      log.warn({ skillKey: row.key, version: row.version }, "skill del agente sin implementación que coincida: no se ofrece");
      continue;
    }
    skills.set(row.key, skill);
    settings.set(row.key, { enabled: row.enabled, autonomy: row.autonomy_level });
  }
  return { skills, settings };
}

async function startRun(db: TenantDb, runId: string, conversation: Conversation, messageId: string): Promise<void> {
  const { error } = await db.from("agent_runs").insert({
    id: runId,
    location_id: conversation.location_id,
    agent_id: conversation.agent_id,
    trigger: "inbound_message",
    trigger_ref: messageId,
    status: "running",
  });
  // 23505: el run ya existía (la entrega se reanudó después de crearlo).
  if (error && error.code !== "23505") throw new Error(`no se pudo crear el run (${error.code})`);
}

async function recordExecution(
  db: TenantDb,
  runId: string,
  locationId: string | null,
  skill: SkillDefinition<unknown>,
  execution: TurnExecution,
  now: Date,
): Promise<void> {
  if (execution.status === "rejected" || execution.inputHash === undefined || execution.autonomy === undefined) return;
  const { data, error } = await db.from("executions").insert({
    run_id: runId,
    location_id: locationId,
    skill_key: execution.skillKey,
    skill_version: skill.version,
    effect_class: skill.effectClass,
    autonomy_applied: execution.autonomy,
    input: execution.input as NonNullable<Json>,
    target: execution.target as unknown as NonNullable<Json>,
    input_hash: execution.inputHash,
    preview: (execution.preview ?? null) as unknown as Json,
    output: (execution.output ?? null) as Json,
    status: execution.status,
    idempotency_key: execution.idempotencyKey,
  }).select("id").single();
  // 23505: ya guardada (la entrega se reanudó después de guardarla).
  if (error && error.code !== "23505") throw new Error(`no se pudo guardar la ejecución (${error.code})`);
  if (!AWAITING_PERSON.has(execution.status)) return;
  // Lo que espera a una persona nace con su aprobación (paso 4d-3d).
  let executionId = data?.id;
  if (!executionId) {
    const existing = await db.from("executions").select("id").eq("idempotency_key", execution.idempotencyKey).maybeSingle();
    if (existing.error || !existing.data) throw new Error(`no se encontró la ejecución guardada (${existing.error?.code ?? "sin fila"})`);
    executionId = existing.data.id;
  }
  await requestApproval(db, {
    executionId,
    locationId,
    effectClass: skill.effectClass,
    inputHash: execution.inputHash,
    summary: execution.preview?.summary ?? null,
    now,
  });
}

async function finishRun(db: TenantDb, runId: string, conversationId: string, result: TurnResult): Promise<void> {
  const status = runStatusFor(result);
  const { error } = await db
    .from("agent_runs")
    .update({
      status,
      model: result.usage.model,
      tokens_in: result.usage.tokensIn,
      tokens_out: result.usage.tokensOut,
      cost_eur: result.usage.costEur,
    })
    .eq("id", runId);
  if (error) throw new Error(`no se pudo cerrar el run (${error.code})`);
  if (status === "handed_off") {
    // Paso a una persona (§5.10): el agente deja de contestar hasta que se la devuelvan.
    const handed = await db.from("conversations").update({ mode: "human" }).eq("id", conversationId).eq("mode", "agent");
    if (handed.error) throw new Error(`no se pudo pasar la conversación a una persona (${handed.error.code})`);
  }
}

export function createConverseHandler({ router }: ConverseOptions): EventHandler {
  return {
    key: CONVERSE_HANDLER_KEY,
    eventTypes: ["message.received"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const conversationId = String(event.payload["conversation_id"]);
      const messageId = String(event.payload["message_id"]);
      // La baja de los recordatorios (BAJA o STOP) va antes que el turno, también
      // con la conversación en manos de una persona: no llama al modelo (4e-3).
      const optOut = await ctx.step("opt-out", () => handleOptOut(ctx.db, conversationId, messageId, new Date()));
      if (optOut.handled) {
        ctx.logger.info({ conversationId, alreadyOptedOut: optOut.alreadyOptedOut }, "baja de los recordatorios");
        return;
      }
      const prepared = await ctx.step("load", () => prepare(ctx.db, conversationId, messageId));
      if (prepared.kind === "skip") {
        ctx.logger.info({ conversationId, reason: prepared.reason }, "el agente no contesta este mensaje");
        return;
      }
      const { conversation, context } = prepared;
      const runId = runIdFor(event.id);
      await ctx.step("run:start", () => startRun(ctx.db, runId, conversation, messageId));

      const { skills, settings } = agentSkills(codeSkills(ctx.db), context.skills, ctx.logger);
      const result = await runAgentTurn({
        scope: {
          organizationId: event.organizationId,
          locationId: conversation.location_id,
          runId,
          conversation: { id: conversation.id, contactId: conversation.contact_id },
        },
        systemPrompt: composeSystemPrompt({
          agentName: context.agent.display_name ?? context.agent.type_name,
          businessName: context.organization.name,
          locationName: prepared.location?.name ?? null,
          timezone: prepared.location?.timezone ?? "UTC",
          now: new Date(prepared.now),
          ...(prepared.services ? { services: prepared.services, servicesTruncated: prepared.servicesTruncated } : {}),
        }),
        history: prepared.history,
        skills,
        settings,
        router,
        policy: policyFromSettings(prepared.modelSettings),
        spend: { runEur: 0, dayEur: prepared.dayEur },
        step: (name, fn) => ctx.step(name, fn),
        record: async (execution) => {
          if (execution.status === "rejected") {
            ctx.logger.warn({ runId, skillKey: execution.skillKey, reason: execution.rejectReason }, "el motor de políticas rechazó una herramienta");
            return;
          }
          const skill = skills.get(execution.skillKey);
          if (skill) await ctx.step(`record:${execution.idempotencyKey}`, () => recordExecution(ctx.db, runId, conversation.location_id, skill, execution, new Date()));
        },
      });
      await ctx.step("run:finish", () => finishRun(ctx.db, runId, conversation.id, result));
      ctx.logger.info(
        { runId, status: result.status, reason: result.reason, error: result.error, executions: result.executions.length, costEur: result.usage.costEur },
        "turno del agente terminado",
      );
    },
  };
}
