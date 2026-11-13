import { createHash } from "node:crypto";
import {
  AUTONOMY_LEVELS,
  EFFECT_CLASSES,
  HAND_OFF_TEXTS,
  MAX_PROMPT_PENDING,
  REQUEST_HUMAN_SKILL_KEY,
  composeSystemPromptParts,
  decide,
  policyAllows,
  policyFromSettings,
  runAgentTurn,
} from "@repo/agent-core";
import type {
  AutonomyLevel,
  BookableService,
  HistoryMessage,
  ModelRouter,
  PendingRequest,
  RouteOrigin,
  SkillDefinition,
  SkillSettings,
  Target,
  TurnExecution,
  TurnModelCall,
  TurnResult,
} from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import type { Embedder } from "@repo/knowledge";
import {
  APPOINTMENT_REMINDER_SKILL_KEY,
  FIND_SLOTS_SKILL_KEY,
  SEARCH_KNOWLEDGE_SKILL_KEY,
  WAITLIST_OFFER_SKILL_KEY,
  createJoinWaitlistSkill,
  createReceptionSkills,
  createReplySkill,
  createRequestHumanSkill,
  createSearchKnowledgeSkill,
} from "@repo/skills";
import type { Logger } from "pino";
import { z } from "zod";
import { createMoodlyCalendar } from "../booking/moodly-calendar.ts";
import { createMoodlyWaitlist } from "../booking/moodly-waitlist.ts";
import { createKnowledgeRetriever } from "../knowledge/retriever.ts";
import { handleOptOut } from "../reminders/consent.ts";
import { BOOK_SKILL_KEY, acceptanceKey, acceptanceText, findAcceptance, holdOffer, holdUntil } from "../waitlist/accept.ts";
import type { AcceptanceOutcome } from "../waitlist/accept.ts";
import { DB_STEP, type DomainEvent, type EventContext, type EventHandler } from "../events/handlers.ts";
import { AWAITING_PERSON, HELD_NOT_AGENT_MODE, requestApproval } from "./approvals.ts";
import { createConversationSender, isNotAgentMode } from "./conversation-sender.ts";
import { createReceptionCatalog } from "./reception-catalog.ts";
import { bookSummaryUsage, loadSummary, saveSummary, summarizeStep } from "./summary.ts";
import { checkBudgetSafely } from "../usage/budget-check.ts";
import { meteredSearchEmbedder, type SearchUsageContext } from "../usage/embedding-usage.ts";
import type { SummaryStep } from "./summary.ts";

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
// - Si una persona toma el control a mitad del turno, el agente ya no escribe
//   (R-02): la base de datos rechaza su mensaje (conversation-sender.ts), y un
//   mensaje que iba a esperar aprobación no la pide (nadie la aprobaría para
//   que el agente hable en una conversación de una persona).
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
  /**
   * Los embeddings de las consultas de search_knowledge (B20-2, ADR 0048) y por
   * dónde van. Sin ellos, el agente no busca en el conocimiento.
   */
  knowledge?: { embedder: Embedder; route: RouteOrigin };
  /** Enrutado por intención (PL-T3, WorkerConfig.intentRouting): apagado si no se dice. */
  intentRouting?: boolean;
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

export interface Conversation {
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
      /** El resumen de lo anterior a `history` (PL-T3), y hasta dónde llega. */
      summary: { summary: string; coveredUntil: string } | null;
      /** Si no se pudo leer el resumen: el turno va con la historia entera. */
      summaryError: string | null;
      location: { name: string; timezone: string } | null;
      modelSettings: unknown;
      /** Lo gastado hoy y este mes (UTC), del libro de consumo: lo compara el enrutador con los topes. */
      dayEur: number;
      monthEur: number;
      /** Solo si el agente busca huecos: lo que se puede reservar en el local. */
      services: BookableService[] | null;
      servicesTruncated: boolean;
      /** Lo que el agente ya pidió en esta conversación y espera al equipo (CU3), lo más reciente primero. */
      pendingRequests: PendingRequest[];
      /** La hora del turno, fijada dentro del paso: al reanudar es la misma. */
      now: string;
    };

// Las lecturas del turno van por SQL bajo RLS, con el rol moodly_worker (ADR
// 0049, PL-T1): la organización la fija forOrganization y Postgres no deja ver
// filas de otra aunque una consulta se olvide de filtrar. El resumen en una
// transacción corta y lo demás en otra; el contexto del agente sale de
// private.worker_agent_turn_context (paso 3), que toma la organización de la
// transacción.
interface ConversationRow extends Conversation {
  mode: string;
  channel_account_id: string;
}

type Loaded =
  | { kind: "skip"; reason: string }
  | {
      kind: "turn";
      conversation: ConversationRow;
      context: TurnContext;
      books: boolean;
      messages: { author: string; content: string }[];
      location: { name: string; timezone: string } | null;
      modelSettings: unknown;
      serviceRows: ServiceRow[];
      spent: { dayEur: number; monthEur: number };
      pending: { skill_key: string; summary: string }[];
    };

// Exportada para el test de integración que comprueba que no lee conversaciones de otra organización.
export async function prepare(db: TenantDb, conversationId: string, messageId: string): Promise<Prepared> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Con resumen (PL-T3), solo lo que no cubre: lo anterior va resumido. Va en su
  // propia transacción de moodly_worker, antes: si no se puede leer, el turno
  // sigue sin resumen y con la historia entera (nunca un turno sin contestar), y
  // un error dentro de la transacción del turno la abortaría entera.
  const { summary, error: summaryError } = await loadSummary(db, conversationId);
  const loaded = await db.transaction(async (sql): Promise<Loaded> => {
    const [conversation] = await sql.query<ConversationRow>(
      "select id, location_id, contact_id, agent_id, mode, channel_account_id from public.conversations where id = $1",
      [conversationId],
    );
    if (!conversation) return { kind: "skip", reason: "conversation_missing" };
    if (conversation.mode !== "agent") return { kind: "skip", reason: "not_agent_mode" };
    const [latest] = await sql.query<{ id: string }>(
      "select id from public.messages where conversation_id = $1 and author = 'contact' order by created_at desc limit 1",
      [conversationId],
    );
    if (latest?.id !== messageId) return { kind: "skip", reason: "newer_message" };

    const [turn] = await sql.query<{ context: unknown }>("select private.worker_agent_turn_context($1) as context", [conversation.agent_id]);
    if (!turn?.context) return { kind: "skip", reason: "agent_missing" };
    const context = contextSchema.parse(turn.context);
    if (!ANSWERING.has(context.agent.status)) {
      const [account] = await sql.query<{ channel: string }>("select channel from public.channel_accounts where id = $1", [
        conversation.channel_account_id,
      ]);
      if (!agentAnswers(context.agent.status, account?.channel ?? null)) return { kind: "skip", reason: "agent_not_answering" };
    }

    const messages = await sql.query<{ author: string; content: string }>(
      `select author, content from public.messages
       where conversation_id = $1 and ($3::timestamptz is null or created_at > $3)
       order by created_at desc limit $2`,
      [conversationId, HISTORY_LIMIT, summary?.coveredUntil ?? null],
    );
    const [location] = conversation.location_id
      ? await sql.query<{ name: string; timezone: string }>("select name, timezone from public.locations where id = $1", [
          conversation.location_id,
        ])
      : [];
    const [modelSettings] = await sql.query(
      `select residency, allowed_providers, model_by_task, connection, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur
       from public.org_model_settings limit 1`,
    );
    // Un modelo real no sabe el service_id que pide find_slots: va en el prompt.
    const books = context.skills.some((skill) => skill.key === FIND_SLOTS_SKILL_KEY && skill.enabled);
    const serviceRows =
      books && conversation.location_id
        ? await sql.query<ServiceRow>(
            `select id, name, duration_minutes, location_id from public.services
             where active and (location_id is null or location_id = $1)
             order by name limit $2`,
            [conversation.location_id, MAX_PROMPT_SERVICES + 1],
          )
        : [];
    // Lo que el agente ya pidió en esta conversación y espera al equipo (CU3):
    // las ejecuciones de turnos anteriores en borrador o pendientes de
    // aprobación, con el resumen de su vista previa. La conversación es la de
    // la fila; el run, el del mensaje que lo lanzó (trigger_ref); la
    // organización, la de la transacción (RLS). Sin las respuestas al cliente
    // ni las lecturas, y sin las que el equipo ya rechazó o dejó caducar.
    const pending = await sql.query<{ skill_key: string; summary: string }>(
      `select e.skill_key, e.preview->>'summary' as summary
       from public.executions e
       join public.agent_runs r on r.id = e.run_id
       join public.messages m on m.id::text = r.trigger_ref
       where r.trigger = 'inbound_message'
         and m.conversation_id = $1
         and e.status in ('drafted', 'needs_approval')
         and e.effect_class not in ('read', 'external_message')
         and jsonb_typeof(e.preview->'summary') = 'string'
         and not exists (
           select 1 from public.approvals a
           where a.execution_id = e.id and (a.status in ('rejected', 'expired') or a.expires_at <= now())
         )
       order by e.created_at desc
       limit $2`,
      [conversationId, MAX_PROMPT_PENDING + 1],
    );
    // El gasto del día y del mes, del libro de consumo (PL-ledger): la misma
    // suma que public.usage_spend, aquí bajo RLS (solo las filas de esta
    // organización, usage_records_worker, 20261112120000).
    const [spent] = await sql.query<{ day_eur: number; month_eur: number }>(
      `select coalesce(sum(cost_eur) filter (where occurred_at >= $1), 0)::float8 as day_eur,
              coalesce(sum(cost_eur) filter (where occurred_at >= $2), 0)::float8 as month_eur
       from public.usage_records
       where occurred_at >= least($1::timestamptz, $2::timestamptz)`,
      [dayStart.toISOString(), monthStart.toISOString()],
    );
    return {
      kind: "turn",
      conversation,
      context,
      books,
      messages,
      location: location ?? null,
      modelSettings: modelSettings ?? null,
      serviceRows,
      spent: { dayEur: spent?.day_eur ?? 0, monthEur: spent?.month_eur ?? 0 },
      pending,
    };
  });
  if (loaded.kind === "skip") return loaded;
  const { conversation, context, books, messages, location, modelSettings, serviceRows, spent, pending } = loaded;
  const bookable = books ? bookableServices(serviceRows, conversation.location_id) : null;

  return {
    kind: "turn",
    conversation: { id: conversation.id, location_id: conversation.location_id, contact_id: conversation.contact_id, agent_id: conversation.agent_id },
    context,
    history: [...messages].reverse().map((message) => ({ author: message.author as HistoryMessage["author"], content: message.content })),
    summary,
    summaryError,
    location,
    modelSettings,
    dayEur: spent.dayEur,
    monthEur: spent.monthEur,
    services: bookable?.services ?? null,
    servicesTruncated: bookable?.truncated ?? false,
    pendingRequests: pending.map((row) => ({ skillKey: row.skill_key, summary: row.summary })),
    now: now.toISOString(),
  };
}

/**
 * Las skills de código que el worker sabe ejecutar, sobre los datos de esta
 * organización. search_knowledge solo con un embedder (que la política de la
 * organización deje usar): sin él no existe y no se ofrece.
 */
export function codeSkills(
  db: TenantDb,
  options: { embedder?: Embedder | null; searchUsage?: SearchUsageContext } = {},
): Map<string, SkillDefinition<unknown>> {
  const reception = createReceptionSkills({ booking: createMoodlyCalendar(db), catalog: createReceptionCatalog(db) });
  const reply = createReplySkill({ sender: createConversationSender(db) });
  const joinWaitlist = createJoinWaitlistSkill({ store: createMoodlyWaitlist(db) });
  // En un turno, cada consulta va al libro de consumo con su run (PL-ledger).
  const embedder = options.embedder && options.searchUsage ? meteredSearchEmbedder(db, options.embedder, options.searchUsage) : options.embedder;
  const knowledge = embedder ? [createSearchKnowledgeSkill({ retriever: createKnowledgeRetriever(db, embedder) })] : [];
  // Pasar a una persona (CU3): solo el motivo; el turno se acaba y finishRun pasa la conversación.
  const requestHuman = createRequestHumanSkill();
  const all = [...Object.values(reception), reply, joinWaitlist, ...knowledge, requestHuman] as unknown as SkillDefinition<unknown>[];
  return new Map(all.map((skill) => [skill.key, skill]));
}

/** El texto del paso a una persona en el idioma de la organización: inglés si es «en», si no, español. */
export function handOffTextFor(locale: string | null | undefined): string {
  return locale?.toLowerCase().startsWith("en") ? HAND_OFF_TEXTS.en : HAND_OFF_TEXTS.es;
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

// Las escrituras del run y del consumo van por SQL bajo RLS como moodly_worker
// (ADR 0049, PL-T1 3c-1, 20261112130000): solo de esta organización, solo las
// columnas que concede la migración y, por guard_worker_agent_run, el run nace
// «running» y su estado solo sale de «running».
async function startRun(db: TenantDb, runId: string, conversation: Conversation, messageId: string): Promise<void> {
  // on conflict: el run ya existía (la entrega se reanudó después de crearlo).
  await db.transaction((sql) =>
    sql.query(
      `insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, trigger_ref, status)
       values ($1, $2, $3, $4, 'inbound_message', $5, 'running')
       on conflict (id) do nothing`,
      [runId, db.organizationId, conversation.location_id, conversation.agent_id, messageId],
    ),
  );
}

/**
 * Un mensaje del agente a su conversación (external_message con destino la
 * conversación) que iba a esperar aprobación, con la conversación ya en manos
 * de una persona: no la pide.
 */
export function holdsForPerson(effectClass: string, target: Target | undefined, mode: string | null): boolean {
  return effectClass === "external_message" && target?.kind === "conversation" && mode !== "agent";
}

/** Guarda la ejecución y, si espera a una persona, pide su aprobación. Devuelve si se retuvo (R-02). */
async function recordExecution(
  db: TenantDb,
  runId: string,
  locationId: string | null,
  skill: SkillDefinition<unknown>,
  execution: TurnExecution,
  now: Date,
): Promise<boolean> {
  if (execution.status === "rejected" || execution.inputHash === undefined || execution.autonomy === undefined) return false;
  // Como moodly_worker, bajo RLS (PL-T1 3c-2, 20261112140000): guardar,
  // encontrar y, si hace falta, retener la ejecución, en una transacción.
  const target = execution.target;
  const saved = await db.transaction(async (sql) => {
    // on conflict: ya guardada (la entrega se reanudó después de guardarla).
    await sql.query(
      `insert into public.executions (organization_id, run_id, location_id, skill_key, skill_version, effect_class,
                                      autonomy_applied, input, target, input_hash, preview, output, status, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       on conflict do nothing`,
      [
        db.organizationId,
        runId,
        locationId,
        execution.skillKey,
        skill.version,
        skill.effectClass,
        execution.autonomy,
        JSON.stringify(execution.input),
        JSON.stringify(target),
        execution.inputHash,
        // Sin vista previa ni salida, NULL de SQL (no el jsonb 'null', que preview no admite).
        execution.preview == null ? null : JSON.stringify(execution.preview),
        execution.output == null ? null : JSON.stringify(execution.output),
        execution.status,
        execution.idempotencyKey,
      ],
    );
    if (!AWAITING_PERSON.has(execution.status)) return { executionId: null, held: false };
    // Lo que espera a una persona nace con su aprobación (paso 4d-3d).
    const [row] = await sql.query<{ id: string }>("select id from public.executions where idempotency_key = $1", [execution.idempotencyKey]);
    if (!row) throw new Error("no se encontró la ejecución guardada");
    // Si la conversación ya la lleva una persona, el mensaje del agente no pide
    // aprobación: se cierra sin enviarse. Si la toma llega justo después, el
    // mensaje aprobado tampoco saldría (lo rechaza la base de datos al enviarlo).
    if (target?.kind === "conversation") {
      const [conversation] = await sql.query<{ mode: string }>("select mode from public.conversations where id = $1", [
        target.conversationId,
      ]);
      if (holdsForPerson(skill.effectClass, target, conversation?.mode ?? null)) {
        await sql.query(
          `update public.executions set status = 'failed', output = $2
           where id = $1 and status = any($3::text[])`,
          [row.id, JSON.stringify({ held: HELD_NOT_AGENT_MODE }), [...AWAITING_PERSON]],
        );
        return { executionId: row.id, held: true };
      }
    }
    return { executionId: row.id, held: false };
  });
  if (!saved.executionId) return false;
  if (saved.held) return true;
  const executionId = saved.executionId;
  await requestApproval(db, {
    executionId,
    locationId,
    effectClass: skill.effectClass,
    inputHash: execution.inputHash,
    summary: execution.preview?.summary ?? null,
    now,
  });
  return false;
}

/**
 * Una llamada al modelo, al libro de consumo (PL-ledger), en su propio paso
 * justo después de hacerla. Si el paso se repite, no se anota dos veces: run,
 * orden y hora de la llamada son únicos (23505: ya estaba).
 *
 * Nunca lanza: un fallo del libro no puede dejar al cliente sin respuesta ni el
 * run en «running». Lo registra como error (con el run) y devuelve false; el
 * cierre del run lo vuelve a intentar, y el run guarda los totales igualmente.
 */
export async function recordUsageSafely(
  db: TenantDb,
  logger: Pick<Logger, "error">,
  runId: string,
  conversation: Conversation,
  call: TurnModelCall,
): Promise<boolean> {
  try {
    await recordUsage(db, runId, conversation, call);
    return true;
  } catch (err) {
    logger.error({ runId, callIndex: call.index, err: err instanceof Error ? err.name : "Error" }, "no se pudo anotar una llamada al modelo en el libro de consumo");
    return false;
  }
}

async function recordUsage(db: TenantDb, runId: string, conversation: Conversation, call: TurnModelCall): Promise<void> {
  // on conflict: la llamada ya estaba anotada (run, orden y hora la hacen única).
  await db.transaction((sql) =>
    sql.query(
      `insert into public.usage_records (organization_id, location_id, run_id, agent_id, source, metric, quantity,
                                         tokens_in, tokens_out, cost_eur, provider, via, region, model, model_key,
                                         call_index, occurred_at)
       values ($1, $2, $3, $4, 'agent_turn', 'llm_tokens', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       on conflict do nothing`,
      [
        db.organizationId,
        conversation.location_id,
        runId,
        conversation.agent_id,
        call.tokensIn + call.tokensOut,
        call.tokensIn,
        call.tokensOut,
        call.costEur,
        call.provider,
        call.via,
        call.region,
        call.model,
        call.modelKey,
        call.index,
        call.startedAt,
      ],
    ),
  );
}

/**
 * Cómo queda el run, también si algo se retuvo (R-02): si lo que iba a esperar
 * a una persona no espera nada porque la conversación ya la lleva una persona,
 * el run no queda esperando aprobación para siempre: queda en sus manos.
 */
export function finalRunStatus(result: TurnResult, heldAny: boolean, stillAwaiting: boolean): ReturnType<typeof runStatusFor> {
  const status = runStatusFor(result);
  if (status === "awaiting_approval" && heldAny && !stillAwaiting) return "handed_off";
  return status;
}

async function finishRun(db: TenantDb, runId: string, conversationId: string, result: TurnResult, heldAny: boolean): Promise<void> {
  // Como moodly_worker, bajo RLS (PL-T1 3c-3, 20261112150000): lo que queda del
  // run, el paso a una persona y el cierre del run, en una transacción.
  await db.transaction(async (sql) => {
    let stillAwaiting = false;
    if (heldAny) {
      const pending = await sql.query("select 1 from public.executions where run_id = $1 and status = any($2::text[]) limit 1", [
        runId,
        [...AWAITING_PERSON],
      ]);
      stillAwaiting = pending.length > 0;
    }
    const status = finalRunStatus(result, heldAny, stillAwaiting);
    if (status === "handed_off") {
      // Paso a una persona (§5.10): el agente deja de contestar hasta que se la devuelvan.
      // Antes de cerrar el run: quien vea el run cerrado ve ya la conversación en manos de
      // una persona. Si el paso se repite, no cambia nada (solo de agent a human;
      // guard_worker_conversation no deja otra cosa).
      await sql.query("update public.conversations set mode = 'human' where id = $1 and mode = 'agent'", [conversationId]);
    }
    // Estado y modelo solo cambian si el run sigue en marcha: si el paso se repite
    // cuando otra cosa ya lo movió (una aprobación), no los pisa. Tokens y coste,
    // fuera de «running», solo suben (guard_worker_agent_run): el uso se apunta igual.
    await sql.query(
      `update public.agent_runs
       set status = case when status = 'running' then $2 else status end,
           model = case when status = 'running' then $3 else model end,
           tokens_in = case when status = 'running' then $4 else greatest(tokens_in, $4) end,
           tokens_out = case when status = 'running' then $5 else greatest(tokens_out, $5) end,
           cost_eur = case when status = 'running' then $6 else greatest(cost_eur, $6) end
       where id = $1`,
      [runId, status, result.usage.model, result.usage.tokensIn, result.usage.tokensOut, result.usage.costEur],
    );
  });
}

/** Lo que decidió el motor para la reserva al aceptar una oferta. Serializable: es el resultado de un paso. */
interface AcceptDecision {
  outcome: string;
  reason?: string;
  input?: unknown;
  target?: Target;
  inputHash?: string;
  autonomy?: AutonomyLevel;
}

/**
 * Aceptar una oferta de la lista de espera contestando SÍ (paso 4f-3): sin
 * modelo, la reserva del hueco ofrecido por el motor de políticas, con la
 * autonomía del agente (de serie, a la bandeja de aprobaciones). Devuelve si
 * el mensaje era eso; si no, el turno sigue como siempre.
 */
async function acceptOffer(event: DomainEvent, ctx: EventContext, conversationId: string, messageId: string): Promise<boolean> {
  const found = await ctx.step("waitlist-accept:find", () => findAcceptance(ctx.db, conversationId, messageId, new Date()));
  if (found.kind === "none") return false;
  const book = codeSkills(ctx.db).get(BOOK_SKILL_KEY);
  const row = found.book;
  if (!book || !row || row.kind !== "code" || row.version !== book.version || row.effectClass !== book.effectClass) return false;
  if (!agentAnswers(found.agentStatus, found.channel)) return false;

  const { conversation } = found;
  const runId = runIdFor(event.id);
  const key = acceptanceKey(found.entryId, messageId);
  const args = { service_id: found.serviceId, resource_id: found.resourceId, starts_at: found.startsAt };
  const decided = await ctx.step("waitlist-accept:decide", async (): Promise<AcceptDecision> => {
    const decision = await decide({
      proposal: { skillKey: BOOK_SKILL_KEY, args },
      scope: { organizationId: event.organizationId, locationId: conversation.locationId, runId, conversation: { id: conversation.id, contactId: conversation.contactId } },
      skills: new Map([[BOOK_SKILL_KEY, book]]),
      settings: new Map([[BOOK_SKILL_KEY, { enabled: row.enabled, autonomy: row.autonomy }]]),
    });
    if (decision.outcome === "reject") return { outcome: "reject", reason: decision.reason };
    return { outcome: decision.outcome, input: decision.input, target: decision.target, inputHash: decision.inputHash, autonomy: decision.autonomy };
  });
  // Si el motor no la deja (la skill desactivada, por ejemplo), el «sí» lo contesta el agente.
  if (decided.outcome === "reject" || !decided.target || !decided.inputHash || !decided.autonomy) {
    ctx.logger.info({ conversationId, entryId: found.entryId, reason: decided.reason }, "aceptación de la oferta que no se reserva");
    return false;
  }
  await ctx.step("run:start", () =>
    startRun(ctx.db, runId, { id: conversation.id, location_id: conversation.locationId, contact_id: conversation.contactId, agent_id: conversation.agentId }, messageId),
  );
  const skillCtx = {
    organizationId: event.organizationId,
    locationId: conversation.locationId,
    runId,
    contactId: conversation.contactId,
    conversationId: conversation.id,
    target: decided.target,
    idempotencyKey: key,
  };
  const input = book.input.parse(decided.input);
  let status: TurnExecution["status"];
  let output: unknown;
  let preview: TurnExecution["preview"];
  if (decided.outcome === "execute") {
    try {
      output = await ctx.step("waitlist-accept:execute", () => book.execute(skillCtx, input));
      status = "executed";
    } catch (error) {
      status = "failed";
      ctx.logger.warn({ conversationId, entryId: found.entryId, error: (error as Error).name }, "la reserva de la oferta no se pudo hacer");
    }
  } else {
    preview = await ctx.step("waitlist-accept:preview", () => book.preview(skillCtx, input));
    status = decided.outcome === "draft" ? "drafted" : decided.outcome === "suggest" ? "suggested" : "needs_approval";
  }
  const execution: TurnExecution = {
    step: 0,
    callId: "waitlist-accept",
    skillKey: BOOK_SKILL_KEY,
    status,
    idempotencyKey: key,
    input: decided.input,
    target: decided.target,
    inputHash: decided.inputHash,
    autonomy: decided.autonomy,
    ...(preview ? { preview } : {}),
    ...(output === undefined ? {} : { output }),
  };
  await ctx.step(`record:${key}`, () => recordExecution(ctx.db, runId, conversation.locationId, book, execution, new Date()));
  const outcome: AcceptanceOutcome = status === "executed" ? "booked" : status === "failed" ? "failed" : "pending";
  if (outcome === "pending") {
    // Mientras espera a una persona, nadie más ve el hueco y la oferta no caduca.
    await ctx.step("waitlist-accept:hold", () => holdOffer(ctx.db, found.entryId, found.expiresAt, holdUntil(new Date(), new Date(found.startsAt))));
  }
  const text = acceptanceText(outcome, { ...found.text, startsAt: new Date(found.startsAt) });
  // Si una persona tomó el control entretanto, la respuesta no sale (R-02); la reserva ya está hecha o esperando.
  const replied = await ctx.step("waitlist-accept:reply", async () => {
    try {
      await createConversationSender(ctx.db).send({ conversationId: conversation.id, text, idempotencyKey: `${key}:reply` });
      return true;
    } catch (error) {
      if (isNotAgentMode(error)) return false;
      throw error;
    }
  });
  if (!replied) ctx.logger.info({ conversationId, entryId: found.entryId, reason: HELD_NOT_AGENT_MODE }, "la respuesta a la oferta no sale: la conversación la lleva una persona");
  await ctx.step("run:finish", async () => {
    const runStatus = outcome === "booked" ? "completed" : outcome === "pending" ? "awaiting_approval" : "failed";
    const { error } = await ctx.db.from("agent_runs").update({ status: runStatus }).eq("id", runId).eq("status", "running");
    if (error) throw new Error(`no se pudo cerrar el run (${error.code})`);
  });
  ctx.logger.info({ runId, conversationId, entryId: found.entryId, outcome }, "oferta de la lista de espera aceptada");
  return true;
}

/** El run cuenta también lo que costó el resumen: así el gasto del día y los topes lo ven. */
export function withSummaryUsage(result: TurnResult, summarized: SummaryStep): TurnResult {
  if (summarized.kind !== "updated") return result;
  return {
    ...result,
    usage: {
      ...result.usage,
      tokensIn: result.usage.tokensIn + summarized.usage.tokensIn,
      tokensOut: result.usage.tokensOut + summarized.usage.tokensOut,
      costEur: result.usage.costEur + summarized.usage.costEur,
    },
  };
}

export function createConverseHandler({ router, knowledge, intentRouting = false }: ConverseOptions): EventHandler {
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
      // Un «sí» a una oferta viva de la lista de espera: la reserva, sin modelo (4f-3).
      if (await acceptOffer(event, ctx, conversationId, messageId)) return;
      // Con reintentos: si moodly_worker no entra un momento (el pooler, un
      // reinicio), el mensaje no se pierde; si no entra nunca, el worker no
      // habría arrancado (worker.ts, verifyWorkerConnection).
      const prepared = await ctx.step("load", () => prepare(ctx.db, conversationId, messageId), DB_STEP);
      if (prepared.kind === "skip") {
        ctx.logger.info({ conversationId, reason: prepared.reason }, "el agente no contesta este mensaje");
        return;
      }
      const { conversation, context } = prepared;
      const runId = runIdFor(event.id);
      await ctx.step("run:start", () => startRun(ctx.db, runId, conversation, messageId));

      const policy = policyFromSettings(prepared.modelSettings);
      // La consulta sale hacia el proveedor de embeddings: solo si la política de la organización deja usar esa vía (ADR 0048).
      const knowledgeAllowed = knowledge !== undefined && policyAllows(policy, knowledge.route);
      if (knowledge && !knowledgeAllowed) ctx.logger.info({ runId }, "la política de modelos de la organización no deja buscar en el conocimiento");
      const searchUsage = knowledgeAllowed
        ? { route: knowledge.route, runId, agentId: conversation.agent_id, locationId: conversation.location_id, logger: ctx.logger }
        : undefined;
      const { skills, settings } = agentSkills(
        codeSkills(ctx.db, { embedder: knowledgeAllowed ? knowledge.embedder : null, ...(searchUsage ? { searchUsage } : {}) }),
        context.skills,
        ctx.logger,
      );
      const searchesKnowledge = skills.has(SEARCH_KNOWLEDGE_SKILL_KEY) && settings.get(SEARCH_KNOWLEDGE_SKILL_KEY)?.enabled === true;
      const handsOff = skills.has(REQUEST_HUMAN_SKILL_KEY) && settings.get(REQUEST_HUMAN_SKILL_KEY)?.enabled === true;
      let heldAny = false;
      const prompt = composeSystemPromptParts({
        agentName: context.agent.display_name ?? context.agent.type_name,
        businessName: context.organization.name,
        locationName: prepared.location?.name ?? null,
        timezone: prepared.location?.timezone ?? "UTC",
        now: new Date(prepared.now),
        ...(prepared.services ? { services: prepared.services, servicesTruncated: prepared.servicesTruncated } : {}),
        knowledge: searchesKnowledge,
        handOff: handsOff,
        pendingRequests: prepared.pendingRequests,
      });
      // Las llamadas que el libro de consumo no pudo anotar durante el turno: se reintentan al cerrar el run.
      const unrecorded: TurnModelCall[] = [];
      // La bandera se guarda en un paso: si cambia con un turno a medias, al reanudarlo
      // se usa la que tenía (DBOS repite los pasos guardados, no la configuración nueva).
      const routing = await ctx.step("intent-routing", () => Promise.resolve(intentRouting));
      const result = await runAgentTurn({
        // El tipo del agente sale de su fila (worker_agent_turn_context), nunca del LLM: elige
        // con qué modelo conversa (MANUAL §5.11); uno sin clave propia usa el de la tarea.
        agentType: context.agent.type_key,
        scope: {
          organizationId: event.organizationId,
          locationId: conversation.location_id,
          runId,
          conversation: { id: conversation.id, contactId: conversation.contact_id },
        },
        // El prompt estable va a la caché de prompt; la hora, aparte (PL-T3).
        systemPrompt: prompt.stable,
        systemContext: prompt.volatile,
        history: prepared.history,
        summary: prepared.summary?.summary ?? null,
        skills,
        settings,
        router,
        policy,
        spend: { runEur: 0, dayEur: prepared.dayEur, monthEur: prepared.monthEur },
        // Lo que se le dice al cliente si el modelo la pasa a una persona (CU3, opción b).
        handOffText: handOffTextFor(context.organization.default_locale),
        intentRouting: routing,
        step: (name, fn) => ctx.step(name, fn),
        recordModelCall: async (call) => {
          const ok = await ctx.step(`usage:${call.index}`, () => recordUsageSafely(ctx.db, ctx.logger, runId, conversation, call));
          if (!ok) unrecorded.push(call);
        },
        record: async (execution) => {
          if (execution.status === "rejected") {
            ctx.logger.warn({ runId, skillKey: execution.skillKey, reason: execution.rejectReason }, "el motor de políticas rechazó una herramienta");
            return;
          }
          const skill = skills.get(execution.skillKey);
          if (!skill) return;
          const held = await ctx.step(`record:${execution.idempotencyKey}`, () =>
            recordExecution(ctx.db, runId, conversation.location_id, skill, execution, new Date()),
          );
          if (held) {
            heldAny = true;
            ctx.logger.info({ runId, skillKey: execution.skillKey, reason: HELD_NOT_AGENT_MODE }, "la conversación la lleva una persona: el mensaje del agente no pide aprobación");
          }
        },
      });
      // El mensaje del agente lo rechazó la base de datos: alguien tomó el control a mitad del turno (R-02).
      const notAgentMode = result.executions.some((execution) => execution.status === "failed" && execution.error === "ConversationNotAgentModeError");
      // El run se cierra antes de resumir: pase lo que pase con el resumen, queda con su estado y su coste.
      await ctx.step("run:finish", async () => {
        // Lo que no se pudo anotar durante el turno, otra vez (sin lanzar tampoco).
        for (const call of unrecorded) await recordUsageSafely(ctx.db, ctx.logger, runId, conversation, call);
        await finishRun(ctx.db, runId, conversation.id, result, heldAny);
      });
      if (prepared.summaryError) ctx.logger.warn({ runId, error: prepared.summaryError }, "no se pudo leer el resumen: el turno fue con la historia entera");
      // El resumen continuo (PL-T3): con el modelo barato, después del turno y con lo que quede de presupuesto.
      const summarized = await ctx.step("summary:model", () =>
        summarizeStep({
          db: ctx.db,
          organizationId: event.organizationId,
          runId,
          conversationId: conversation.id,
          previous: prepared.summary,
          router,
          policy,
          spend: { runEur: result.usage.costEur, dayEur: prepared.dayEur + result.usage.costEur, monthEur: prepared.monthEur + result.usage.costEur },
        }),
      );
      // La llamada del resumen, al libro de consumo (PL-ledger), también si no dio resumen: se pagó igual.
      const summaryCall = summarized.kind === "none" ? undefined : summarized.call;
      if (summaryCall) await ctx.step("summary:ledger", () => recordUsageSafely(ctx.db, ctx.logger, runId, conversation, summaryCall));
      const finished = withSummaryUsage(result, summarized);
      if (summarized.kind === "updated") {
        // Primero el coste (se gastó aunque no se guarde), después el resumen.
        const booked = await ctx.step("summary:usage", () => bookSummaryUsage(ctx.db, runId, finished.usage));
        if (booked) ctx.logger.warn({ runId, error: booked }, "no se pudo apuntar el coste del resumen en el run");
        const saved = await ctx.step("summary:save", () => saveSummary(ctx.db, conversation.id, summarized));
        if (saved) ctx.logger.warn({ runId, error: saved }, "no se pudo guardar el resumen");
      } else if (summarized.kind === "skipped") {
        ctx.logger.warn({ runId, reason: summarized.reason, error: summarized.error }, "no se pudo poner al día el resumen");
      }
      // Con todo lo del turno ya anotado (también el resumen): ¿se acaba de pasar el 80 % o el 100 % del tope del mes?
      await ctx.step("budget:check", () => checkBudgetSafely(ctx.db, ctx.logger, { runId }));
      ctx.logger.info(
        {
          runId,
          status: finished.status,
          reason: notAgentMode ? HELD_NOT_AGENT_MODE : finished.reason,
          error: finished.error,
          executions: finished.executions.length,
          costEur: finished.usage.costEur,
          summary: summarized.kind,
          intent: finished.intent?.intent,
        },
        "turno del agente terminado",
      );
    },
  };
}
