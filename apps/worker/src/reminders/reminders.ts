import { DBOS } from "@dbos-inc/dbos-sdk";
import type { ConsentChecker, SkillDefinition } from "@repo/agent-core";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import { APPOINTMENT_REMINDER_SKILL_KEY, createAppointmentReminderSkill } from "@repo/skills";
import type { AppointmentReminderSkill, ReminderAppointment, ReminderKind, ReminderSource } from "@repo/skills";
import type { Logger } from "pino";
import { createConversationSender } from "../agents/conversation-sender.ts";
import { check, conversationAgent, scheduledRunId, sendScheduled } from "../agents/scheduled-skill.ts";
import type { ConversationAgent } from "../agents/scheduled-skill.ts";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";
import { optedOut } from "./consent.ts";

// Los recordatorios de las citas (paso 4e-2, MANUAL §5.1, decidido por
// producto el 2026-11-08).
//
// - Al reservar o mover una cita (appointment.created y .rescheduled),
//   reception.reminders arranca un workflow por cita y hora, con ID
//   determinista: reminders:<cita>:<hora>. No va en la cola de eventos (allí
//   ocuparía un hueco mientras duerme): duerme con DBOS.sleep, que guarda la
//   hora de despertar y sobrevive a reinicios y despliegues.
// - Cuándo (reminderPlan): 24 h y 4 h antes. Si se reserva con menos de 24 h,
//   el de 24 h sale al reservar si aún faltan más de 4 h; con menos de 4 h,
//   solo el de 4 h si todavía no ha pasado su hora. Nunca entre las 22:00 y
//   las 07:00 del local: el que caería ahí sale a las 07:00, y si para
//   entonces la cita ya ha empezado, no sale. Entre dos recordatorios, al
//   menos 1 h: si no, solo sale el primero (producto, 2026-11-08).
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

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
export type ReminderOffsets = Readonly<Record<ReminderKind, number>>;

export interface ReminderRules {
  /** Cuánto antes de la cita sale cada recordatorio. */
  offsets: ReminderOffsets;
  /** Horas del local en las que no se envía (minutos desde las 00:00): desde start hasta end, cruzando la medianoche. */
  quietHours: { startMinute: number; endMinute: number } | null;
  /** Lo mínimo entre dos recordatorios de la misma cita. */
  minGapMs: number;
}

/** Producto, 2026-11-08: 24 h y 4 h antes, nunca de 22:00 a 07:00 y al menos 1 h entre los dos. */
export const REMINDER_RULES: ReminderRules = {
  offsets: { "24h": 24 * HOUR_MS, "4h": 4 * HOUR_MS },
  quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 },
  minGapMs: HOUR_MS,
};

export interface PlannedReminder {
  kind: ReminderKind;
  /** Cuándo sale (epoch ms). */
  at: number;
}

export interface ReminderPlan {
  reminders: PlannedReminder[];
  /** Los que tocaban y no salen, y por qué (para el log). */
  dropped: { kind: ReminderKind; reason: "quiet_hours" | "gap" }[];
}

/** La hora del día en el local (minutos desde las 00:00). */
export function localMinutes(at: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return value("hour") * 60 + value("minute");
}

/** Si at cae en las horas de silencio del local, la primera hora en que se puede enviar; si no, at. */
export function outOfQuietHours(at: number, timezone: string, quiet: ReminderRules["quietHours"] = REMINDER_RULES.quietHours): number {
  if (!quiet) return at;
  const local = localMinutes(at, timezone);
  const crossesMidnight = quiet.startMinute > quiet.endMinute;
  const quietNow = crossesMidnight ? local >= quiet.startMinute || local < quiet.endMinute : local >= quiet.startMinute && local < quiet.endMinute;
  if (!quietNow) return at;
  // Al minuto en punto del final, contado en hora local.
  let result = at - (at % MINUTE_MS) + (((quiet.endMinute - local + 1440) % 1440) * MINUTE_MS);
  // Si esa noche cambia la hora (horario de verano), se corrige la diferencia.
  const drift = quiet.endMinute - localMinutes(result, timezone);
  if (drift !== 0 && Math.abs(drift) <= 120) result += drift * MINUTE_MS;
  return result;
}

/** Cuándo sale cada recordatorio de una cita que empieza en startsAt, visto en now, en la zona horaria del local. */
export function reminderPlan(startsAt: number, now: number, timezone: string, rules: ReminderRules = REMINDER_RULES): ReminderPlan {
  const first = startsAt - rules.offsets["24h"];
  const second = startsAt - rules.offsets["4h"];
  const candidates: PlannedReminder[] = [];
  if (now <= first) candidates.push({ kind: "24h", at: first });
  // Reservada con menos de 24 h: sale ya, si aún faltan más de 4 h.
  else if (now < second) candidates.push({ kind: "24h", at: now });
  if (now <= second) candidates.push({ kind: "4h", at: second });

  const plan: ReminderPlan = { reminders: [], dropped: [] };
  for (const candidate of candidates) {
    const at = outOfQuietHours(candidate.at, timezone, rules.quietHours);
    // Pasadas las horas de silencio, la cita ya ha empezado: ya no sirve.
    if (at >= startsAt) {
      plan.dropped.push({ kind: candidate.kind, reason: "quiet_hours" });
      continue;
    }
    const previous = plan.reminders.at(-1);
    if (previous && at - previous.at < rules.minGapMs) {
      plan.dropped.push({ kind: candidate.kind, reason: "gap" });
      continue;
    }
    plan.reminders.push({ kind: candidate.kind, at });
  }
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
  return scheduledRunId(REMINDERS_HANDLER_KEY, key);
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

/**
 * Lo que hace falta para decidir, leído al despertar. Serializable: es el
 * resultado de un paso, y con la misma forma que antes de 4f-2 (los
 * recordatorios que ya duermen la reciben así al reanudarse).
 */
type Loaded = { kind: "skip"; reason: string } | ({ locationId: string; contactId: string } & ConversationAgent);

async function load(db: TenantDb, appointmentId: string, startsAt: string, skill: AppointmentReminderSkill): Promise<Loaded> {
  const appointment = check(
    await db.from("appointments").select("status, starts_at, location_id, contact_id, conversation_id").eq("id", appointmentId).maybeSingle(),
    "la cita",
  );
  if (!appointment) return { kind: "skip", reason: "appointment_missing" };
  if (appointment.status !== "booked") return { kind: "skip", reason: "not_booked" };
  if (Date.parse(appointment.starts_at) !== Date.parse(startsAt)) return { kind: "skip", reason: "moved" };
  if (!appointment.conversation_id) return { kind: "skip", reason: "not_booked_by_agent" };
  const agent = await conversationAgent(db, appointment.conversation_id, skill as unknown as SkillDefinition<unknown>);
  if (agent.kind === "skip") return agent;
  return { ...agent, locationId: appointment.location_id, contactId: appointment.contact_id };
}

/** La zona horaria del local de la cita (UTC si la cita ya no existe: sin cita no sale nada). */
async function locationTimezone(db: TenantDb, appointmentId: string): Promise<string> {
  const appointment = check(await db.from("appointments").select("location_id").eq("id", appointmentId).maybeSingle(), "la cita");
  if (!appointment) return "UTC";
  const location = check(await db.from("locations").select("timezone").eq("id", appointment.location_id).maybeSingle(), "el local");
  return location?.timezone ?? "UTC";
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
  /** Solo para los tests: cuándo sale cada recordatorio. */
  rules?: ReminderRules;
}

/** Registra el workflow (antes de DBOS.launch) y devuelve el consumidor que lo arranca. */
export function registerReminders({ db, logger, rules = REMINDER_RULES }: RemindersOptions): EventHandler {
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
    const result = await sendScheduled({
      db: tenant,
      organizationId: input.organizationId,
      locationId: loaded.locationId,
      contactId: loaded.contactId,
      agent: loaded,
      skill: skill as unknown as SkillDefinition<unknown>,
      args: { appointment_id: input.appointmentId, kind, starts_at: input.startsAt },
      consent: createReminderConsent(tenant),
      key,
      runId,
      ref: `${input.appointmentId}:${kind}`,
      step: kind,
    });
    if (result.sent) log.info({ ...fields, runId }, "recordatorio enviado");
    else if ("status" in result) log.warn({ ...fields, error: result.error }, "el recordatorio no se pudo enviar");
    else log.info({ ...fields, outcome: result.outcome, reason: result.reason }, "recordatorio que no sale");
  }

  // Entre paso y paso, solo lógica determinista: la hora sale de DBOS.now (un
  // paso) y DBOS.sleep guarda cuándo despertar.
  async function remind(input: ReminderInput): Promise<void> {
    const startsAt = Date.parse(input.startsAt);
    const tenant = db.forOrganization(input.organizationId);
    // Las horas de silencio son las del local de la cita.
    const timezone = await DBOS.runStep(() => locationTimezone(tenant, input.appointmentId), { name: "timezone" });
    const plan = reminderPlan(startsAt, await DBOS.now(), timezone, rules);
    if (plan.dropped.length > 0) {
      for (const dropped of plan.dropped) {
        log.info({ organizationId: input.organizationId, appointmentId: input.appointmentId, kind: dropped.kind, reason: dropped.reason }, "recordatorio que no sale");
      }
    }
    for (const reminder of plan.reminders) {
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
