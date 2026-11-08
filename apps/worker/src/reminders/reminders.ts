import { createHash } from "node:crypto";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { AUTONOMY_LEVELS, EFFECT_CLASSES, decide } from "@repo/agent-core";
import type { AutonomyLevel, ConsentChecker, SkillContext, SkillDefinition, Target } from "@repo/agent-core";
import type { Json } from "@repo/db";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import { APPOINTMENT_REMINDER_SKILL_KEY, createAppointmentReminderSkill } from "@repo/skills";
import type { AppointmentReminderSkill, ReminderAppointment, ReminderKind, ReminderSource } from "@repo/skills";
import type { Logger } from "pino";
import { z } from "zod";
import { createConversationSender } from "../agents/conversation-sender.ts";
import { agentAnswers } from "../agents/converse.ts";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";

// Los recordatorios de las citas (paso 4e-2, MANUAL §5.1, decidido por
// producto el 2026-11-08).
//
// - Al reservar o mover una cita (appointment.created y .rescheduled),
//   reception.reminders arranca un workflow por cita y hora, con ID
//   determinista: reminders:<cita>:<hora>. No va en la cola de eventos (allí
//   ocuparía un hueco mientras duerme): duerme con DBOS.sleep, que guarda la
//   hora de despertar y sobrevive a reinicios y despliegues.
// - Cuándo: 24 h y 4 h antes. Si se reserva con menos de 24 h, el de 24 h sale
//   al reservar si aún faltan más de 4 h; con menos de 4 h, solo el de 4 h si
//   todavía no ha pasado su hora (reminderPlan).
// - Al despertar se relee todo: si la cita ya no está reservada a esa hora, no
//   tiene conversación, el contacto se dio de baja, la conversación está
//   cerrada, el agente no contesta en ese canal o tiene la skill desactivada,
//   no sale nada. Mover una cita deja el workflow viejo sin nada que hacer y
//   arranca uno nuevo para la hora nueva.
// - Sale por el motor de políticas (decide): la skill appointment_reminder,
//   con el contacto de la cita filtrado por su permiso. Solo se envía si la
//   decisión es execute; con menos autonomía, no (es un aviso con hora: no
//   espera a una persona). Queda un run (trigger schedule) con su ejecución,
//   y el mensaje en la conversación, con una clave por cita, hora y
//   recordatorio: un reintento no envía dos veces.

export const REMINDERS_HANDLER_KEY = "reception.reminders";
export const REMINDERS_WORKFLOW = "appointment.reminders";
/** Clave en contacts.consents: quien contesta BAJA o STOP deja de recibir recordatorios. */
export const REMINDER_CONSENT_KEY = "appointment_reminders";

const HOUR_MS = 3_600_000;
export type ReminderOffsets = Readonly<Record<ReminderKind, number>>;
/** Cuánto antes de la cita sale cada recordatorio. */
export const REMINDER_OFFSETS: ReminderOffsets = { "24h": 24 * HOUR_MS, "4h": 4 * HOUR_MS };

export interface PlannedReminder {
  kind: ReminderKind;
  /** Cuándo sale (epoch ms). */
  at: number;
}

/** Cuándo sale cada recordatorio de una cita que empieza en startsAt, visto en now. */
export function reminderPlan(startsAt: number, now: number, offsets: ReminderOffsets = REMINDER_OFFSETS): PlannedReminder[] {
  const first = startsAt - offsets["24h"];
  const second = startsAt - offsets["4h"];
  const plan: PlannedReminder[] = [];
  if (now <= first) plan.push({ kind: "24h", at: first });
  // Reservada con menos de 24 h: sale ya, si aún faltan más de 4 h.
  else if (now < second) plan.push({ kind: "24h", at: now });
  if (now <= second) plan.push({ kind: "4h", at: second });
  return plan;
}

/** El workflow de los recordatorios de una cita a una hora: el mismo para el mismo evento. */
export function reminderWorkflowId(appointmentId: string, startsAt: string): string {
  return `reminders:${appointmentId}:${new Date(startsAt).toISOString()}`;
}

/** La clave de idempotencia del recordatorio: la de su ejecución y la de su mensaje. */
export function reminderKey(appointmentId: string, startsAt: string, kind: ReminderKind): string {
  return `reminder:${appointmentId}:${new Date(startsAt).toISOString()}:${kind}`;
}

/** El run de un recordatorio: siempre el mismo id para la misma cita, hora y recordatorio. */
export function reminderRunId(key: string): string {
  const hex = createHash("sha256").update(`${REMINDERS_HANDLER_KEY}:${key}`).digest("hex");
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Si el contacto se dio de baja de los recordatorios. */
export function optedOut(consents: unknown): boolean {
  if (typeof consents !== "object" || consents === null) return false;
  const entry = (consents as Record<string, unknown>)[REMINDER_CONSENT_KEY];
  return typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>)["opted_out_at"] === "string";
}

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

/** El permiso para los recordatorios: todos menos quien se dio de baja. Reservar por el agente es el permiso (la audiencia ya lo exige). */
export function createReminderConsent(db: TenantDb): ConsentChecker {
  return {
    async allowed({ contactIds, skillKey }) {
      if (skillKey !== APPOINTMENT_REMINDER_SKILL_KEY || contactIds.length === 0) return [];
      const rows = check(await db.from("contacts").select("id, consents").in("id", [...contactIds]), "los permisos de los contactos");
      return (rows ?? []).filter((row) => !optedOut(row.consents)).map((row) => row.id);
    },
  };
}

/** La cita y lo que pide el texto, de esta organización. */
export function createReminderSource(db: TenantDb, fallbackLocale: string): ReminderSource {
  return {
    async load(appointmentId) {
      const appointment = check(
        await db
          .from("appointments")
          .select("id, status, starts_at, contact_id, conversation_id, service_id, location_id")
          .eq("id", appointmentId)
          .maybeSingle(),
        "la cita",
      );
      if (!appointment) return null;
      const [service, location, contact] = await Promise.all([
        db.from("services").select("name").eq("id", appointment.service_id).maybeSingle(),
        db.from("locations").select("name, timezone").eq("id", appointment.location_id).maybeSingle(),
        db.from("contacts").select("locale").eq("id", appointment.contact_id).maybeSingle(),
      ]);
      const found: ReminderAppointment = {
        id: appointment.id,
        status: appointment.status,
        startsAt: new Date(appointment.starts_at),
        contactId: appointment.contact_id,
        conversationId: appointment.conversation_id,
        service: check(service, "el servicio")?.name ?? "",
        location: check(location, "el local")?.name ?? "",
        timezone: check(location, "el local")?.timezone ?? "UTC",
        locale: check(contact, "el contacto")?.locale ?? fallbackLocale,
      };
      return found;
    },
  };
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

/** Lo que hace falta para decidir, leído al despertar. Serializable: es el resultado de un paso. */
type Loaded =
  | { kind: "skip"; reason: string }
  | {
      kind: "ready";
      locationId: string;
      contactId: string;
      conversationId: string;
      agentId: string;
      defaultLocale: string;
      settings: { enabled: boolean; autonomy: AutonomyLevel };
    };

async function load(db: TenantDb, appointmentId: string, startsAt: string, skill: AppointmentReminderSkill): Promise<Loaded> {
  const appointment = check(
    await db.from("appointments").select("status, starts_at, location_id, contact_id, conversation_id").eq("id", appointmentId).maybeSingle(),
    "la cita",
  );
  if (!appointment) return { kind: "skip", reason: "appointment_missing" };
  if (appointment.status !== "booked") return { kind: "skip", reason: "not_booked" };
  if (Date.parse(appointment.starts_at) !== Date.parse(startsAt)) return { kind: "skip", reason: "moved" };
  if (!appointment.conversation_id) return { kind: "skip", reason: "not_booked_by_agent" };
  const conversation = check(
    await db.from("conversations").select("id, agent_id, mode, channel_account_id").eq("id", appointment.conversation_id).maybeSingle(),
    "la conversación",
  );
  if (!conversation) return { kind: "skip", reason: "conversation_missing" };
  if (conversation.mode === "closed") return { kind: "skip", reason: "conversation_closed" };
  const raw = await db.agentTurnContext(conversation.agent_id);
  if (!raw) return { kind: "skip", reason: "agent_missing" };
  const context = contextSchema.parse(raw);
  const account = check(await db.from("channel_accounts").select("channel").eq("id", conversation.channel_account_id).maybeSingle(), "el canal");
  if (!agentAnswers(context.agent.status, account?.channel ?? null)) return { kind: "skip", reason: "agent_not_answering" };
  const row = context.skills.find((candidate) => candidate.key === APPOINTMENT_REMINDER_SKILL_KEY);
  if (!row || row.kind !== "code" || row.version !== skill.version || row.effect_class !== skill.effectClass) {
    return { kind: "skip", reason: "skill_not_configured" };
  }
  return {
    kind: "ready",
    locationId: appointment.location_id,
    contactId: appointment.contact_id,
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

async function startRun(db: TenantDb, runId: string, ready: Extract<Loaded, { kind: "ready" }>, ref: string): Promise<void> {
  const { error } = await db.from("agent_runs").insert({
    id: runId,
    location_id: ready.locationId,
    agent_id: ready.agentId,
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

export interface ReminderInput {
  /** La organización de la fila del evento (control 3.7), nunca del payload. */
  organizationId: string;
  appointmentId: string;
  /** La hora de la cita según el evento: si la cita se mueve, este workflow ya no envía nada. */
  startsAt: string;
}

export interface RemindersOptions {
  db: ServiceDb;
  logger: Logger;
  /** Solo para los tests: cuánto antes sale cada recordatorio. */
  offsets?: ReminderOffsets;
}

/** Registra el workflow (antes de DBOS.launch) y devuelve el consumidor que lo arranca. */
export function registerReminders({ db, logger, offsets = REMINDER_OFFSETS }: RemindersOptions): EventHandler {
  const log = logger.child({ component: "reminders" });

  function skillFor(tenant: TenantDb, fallbackLocale: string): AppointmentReminderSkill {
    return createAppointmentReminderSkill({ source: createReminderSource(tenant, fallbackLocale), sender: createConversationSender(tenant) });
  }

  async function sendOne(input: ReminderInput, kind: ReminderKind): Promise<void> {
    const tenant = db.forOrganization(input.organizationId);
    const fields = { organizationId: input.organizationId, appointmentId: input.appointmentId, kind };
    const probe = skillFor(tenant, "en");
    const loaded = await DBOS.runStep(() => load(tenant, input.appointmentId, input.startsAt, probe), { name: `${kind}:load` });
    if (loaded.kind === "skip") {
      log.info({ ...fields, reason: loaded.reason }, "recordatorio que no sale");
      return;
    }
    const skill = skillFor(tenant, loaded.defaultLocale);
    const key = reminderKey(input.appointmentId, input.startsAt, kind);
    const runId = reminderRunId(key);
    const args = { appointment_id: input.appointmentId, kind, starts_at: input.startsAt };
    const decided = await DBOS.runStep(
      async (): Promise<Decided> => {
        const decision = await decide({
          proposal: { skillKey: skill.key, args },
          scope: {
            organizationId: input.organizationId,
            locationId: loaded.locationId,
            runId,
            conversation: { id: loaded.conversationId, contactId: loaded.contactId },
          },
          skills: new Map([[skill.key, skill as unknown as SkillDefinition<unknown>]]),
          settings: new Map([[skill.key, loaded.settings]]),
          consent: createReminderConsent(tenant),
        });
        if (decision.outcome === "reject") return { outcome: "reject", reason: decision.reason };
        return { outcome: decision.outcome, input: decision.input, target: decision.target, inputHash: decision.inputHash, autonomy: decision.autonomy };
      },
      { name: `${kind}:decide` },
    );
    if (decided.outcome !== "execute" || !decided.target || !decided.inputHash || !decided.autonomy) {
      log.info({ ...fields, outcome: decided.outcome, reason: decided.reason }, "recordatorio que no sale");
      return;
    }
    const executable = { input: decided.input, target: decided.target, inputHash: decided.inputHash, autonomy: decided.autonomy };
    await DBOS.runStep(() => startRun(tenant, runId, loaded, `${input.appointmentId}:${kind}`), { name: `${kind}:run:start` });
    const ctx: SkillContext = {
      organizationId: input.organizationId,
      locationId: loaded.locationId,
      runId,
      contactId: loaded.contactId,
      conversationId: loaded.conversationId,
      target: decided.target,
      idempotencyKey: key,
    };
    let output: unknown = null;
    let status: "executed" | "failed" = "executed";
    try {
      output = await DBOS.runStep(() => skill.execute(ctx, skill.input.parse(decided.input)), { name: `${kind}:execute` });
    } catch (error) {
      status = "failed";
      log.warn({ ...fields, error: (error as Error).name }, "el recordatorio no se pudo enviar");
    }
    await DBOS.runStep(
      () => recordExecution(tenant, runId, loaded.locationId, skill as unknown as SkillDefinition<unknown>, executable, key, status, output),
      { name: `${kind}:record` },
    );
    await DBOS.runStep(() => finishRun(tenant, runId, status === "executed" ? "completed" : "failed"), { name: `${kind}:run:finish` });
    if (status === "executed") log.info({ ...fields, runId }, "recordatorio enviado");
  }

  // Entre paso y paso, solo lógica determinista: la hora sale de DBOS.now (un
  // paso) y DBOS.sleep guarda cuándo despertar.
  async function remind(input: ReminderInput): Promise<void> {
    const startsAt = Date.parse(input.startsAt);
    const plan = reminderPlan(startsAt, await DBOS.now(), offsets);
    for (const reminder of plan) {
      const now = await DBOS.now();
      if (reminder.at > now) await DBOS.sleep(reminder.at - now);
      await sendOne(input, reminder.kind);
    }
  }

  const workflow = DBOS.registerWorkflow(remind, { name: REMINDERS_WORKFLOW });

  return {
    key: REMINDERS_HANDLER_KEY,
    eventTypes: ["appointment.created", "appointment.rescheduled"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const input: ReminderInput = {
        organizationId: event.organizationId,
        appointmentId: String(event.payload["appointment_id"]),
        startsAt: String(event.payload["starts_at"]),
      };
      // Desde la entrega (un workflow): DBOS guarda que la arrancó y, si la
      // entrega se repite, devuelve el mismo en vez de arrancar otro.
      await DBOS.startWorkflow(workflow, { workflowID: reminderWorkflowId(input.appointmentId, input.startsAt) })(input);
      ctx.logger.info({ appointmentId: input.appointmentId }, "recordatorios programados");
    },
  };
}
