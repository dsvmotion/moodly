import { DBOS } from "@dbos-inc/dbos-sdk";
import type { ConsentChecker, SkillDefinition } from "@repo/agent-core";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import { WAITLIST_OFFER_SKILL_KEY, createWaitlistOfferSkill } from "@repo/skills";
import type { OfferedEntry, WaitlistOfferSkill, WaitlistOfferSource } from "@repo/skills";
import type { Logger } from "pino";
import { createConversationSender } from "../agents/conversation-sender.ts";
import { check, conversationAgent, scheduledRunId, sendScheduled } from "../agents/scheduled-skill.ts";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";
import { REMINDER_RULES, outOfQuietHours } from "../reminders/reminders.ts";
import type { ReminderRules } from "../reminders/reminders.ts";

// La oferta de la lista de espera (paso 4f-2, MANUAL §5.1, decidido por
// producto el 2026-11-08).
//
// - Al cancelarse una cita (appointment.cancelled), reception.waitlist arranca
//   un workflow por cita con ID determinista (waitlist:<cita>), fuera de la
//   cola de eventos: duerme mientras dura cada oferta.
// - Ofrece el hueco al primero de la lista que encaje: mismo local y servicio,
//   que lo quiera en una franja que contenga el hueco y con una conversación
//   por la que avisarle, por orden de alta. La entrada pasa a «ofrecida», con el
//   hueco y su plazo (30 minutos): mientras tanto find_booking_slots no se lo da
//   a nadie más.
// - El aviso sale por el motor de políticas con la skill waitlist_offer, por la
//   conversación en la que se apuntó, solo con execute; queda un run (trigger
//   schedule) con su ejecución.
// - Al acabar el plazo: si el hueco lo ha reservado esa persona, la entrada
//   queda reservada y se acaba; si lo ha cogido otra, vuelve a esperar y se
//   acaba; si sigue libre, vuelve a esperar (en su sitio de la lista) y se
//   ofrece al siguiente. Cada persona, una vez por hueco.
// - No se ofrece de 22:00 a 07:00 del local (como los recordatorios), ni un
//   hueco que empieza antes de que acabe el plazo de la oferta. Las entradas
//   cuya franja ya pasó caducan.
// - Aceptar contestando SÍ va en 4f-3; mientras, la persona puede reservarlo
//   con el agente como cualquier otra cita.

export const WAITLIST_HANDLER_KEY = "reception.waitlist";
export const WAITLIST_WORKFLOW = "waitlist.offers";

const MINUTE_MS = 60_000;

export interface WaitlistRules {
  /** Cuánto se le guarda el hueco a cada persona. */
  offerMs: number;
  /** Las horas del local en las que no se ofrece nada (las de los recordatorios). */
  quietHours: ReminderRules["quietHours"];
  /** Como mucho, a cuántas personas se ofrece un mismo hueco. */
  maxOffers: number;
}

/** Producto, 2026-11-08: 30 minutos a cada uno, y después al siguiente. */
export const WAITLIST_RULES: WaitlistRules = { offerMs: 30 * MINUTE_MS, quietHours: REMINDER_RULES.quietHours, maxOffers: 20 };

/** El workflow de las ofertas del hueco que deja una cita cancelada: el mismo para el mismo evento. */
export function waitlistWorkflowId(appointmentId: string): string {
  return `waitlist:${appointmentId}`;
}

/** La clave de una oferta: la de su ejecución y la de su mensaje. */
export function offerKey(entryId: string, startsAt: string, expiresAt: string): string {
  return `waitlist-offer:${entryId}:${new Date(startsAt).toISOString()}:${new Date(expiresAt).toISOString()}`;
}

/** El run de una oferta: siempre el mismo id para la misma oferta. */
export function offerRunId(key: string): string {
  return scheduledRunId(WAITLIST_HANDLER_KEY, key);
}

/**
 * Cuándo puede salir la próxima oferta de un hueco que empieza en slotStartsAt,
 * vista en now: ya, o a la hora en que acaban las horas de silencio del local;
 * null si su plazo acabaría después de que empiece el hueco.
 */
export function nextOffer(now: number, slotStartsAt: number, timezone: string, rules: WaitlistRules = WAITLIST_RULES): { sendAt: number; expiresAt: number } | null {
  const sendAt = outOfQuietHours(now, timezone, rules.quietHours);
  const expiresAt = sendAt + rules.offerMs;
  return expiresAt <= slotStartsAt ? { sendAt, expiresAt } : null;
}

/** El hueco que deja libre la cita cancelada. Serializable: es el resultado de un paso. */
type Slot =
  | { kind: "skip"; reason: string }
  | { kind: "slot"; locationId: string; serviceId: string; resourceId: string; startsAt: string; endsAt: string; timezone: string };

async function loadSlot(db: TenantDb, appointmentId: string): Promise<Slot> {
  const appointment = check(
    await db.from("appointments").select("status, location_id, service_id, resource_id, starts_at, ends_at").eq("id", appointmentId).maybeSingle(),
    "la cita",
  );
  if (!appointment) return { kind: "skip", reason: "appointment_missing" };
  if (appointment.status !== "cancelled") return { kind: "skip", reason: "not_cancelled" };
  const location = check(await db.from("locations").select("timezone").eq("id", appointment.location_id).maybeSingle(), "el local");
  return {
    kind: "slot",
    locationId: appointment.location_id,
    serviceId: appointment.service_id,
    resourceId: appointment.resource_id,
    startsAt: new Date(appointment.starts_at).toISOString(),
    endsAt: new Date(appointment.ends_at).toISOString(),
    timezone: location?.timezone ?? "UTC",
  };
}

type FreeSlot = Extract<Slot, { kind: "slot" }>;
type Picked =
  | { kind: "none"; reason: "slot_taken" | "slot_offered" | "no_candidates" }
  | { kind: "offered"; entryId: string; contactId: string; conversationId: string };

/**
 * A quién se le ofrece ahora: la entrada pasa a ofrecida con el hueco y su
 * plazo, solo si sigue esperando (dos workflows no se la quitan). Si el paso
 * se repite tras un corte, la oferta que ya hizo (el mismo hueco con el mismo
 * plazo) es la suya.
 */
async function pickNext(db: TenantDb, slot: FreeSlot, tried: readonly string[], now: string, expiresAt: string): Promise<Picked> {
  const entries = () => db.from("waitlist_entries");
  const mine = check(
    await entries()
      .select("id, contact_id, conversation_id")
      .eq("status", "offered")
      .eq("offered_resource_id", slot.resourceId)
      .eq("offered_starts_at", slot.startsAt)
      .eq("offer_expires_at", expiresAt)
      .limit(1),
    "la oferta en curso",
  );
  const found = mine?.[0];
  if (found?.conversation_id) return { kind: "offered", entryId: found.id, contactId: found.contact_id, conversationId: found.conversation_id };

  // Las que ya no quieren nada que pueda salir: su franja ya pasó.
  const expired = await entries()
    .update({ status: "expired" })
    .eq("location_id", slot.locationId)
    .eq("service_id", slot.serviceId)
    .eq("status", "waiting")
    .lte("wanted_until", now);
  if (expired.error) throw new Error(`no se pudieron caducar las entradas (${expired.error.code})`);

  const booked = check(
    await db
      .from("appointments")
      .select("id")
      .eq("resource_id", slot.resourceId)
      .eq("status", "booked")
      .lt("starts_at", slot.endsAt)
      .gt("ends_at", slot.startsAt)
      .limit(1),
    "las citas del recurso",
  );
  if ((booked ?? []).length > 0) return { kind: "none", reason: "slot_taken" };
  const offered = check(
    await entries()
      .select("id")
      .eq("status", "offered")
      .eq("offered_resource_id", slot.resourceId)
      .gt("offer_expires_at", now)
      .lt("offered_starts_at", slot.endsAt)
      .gt("offered_ends_at", slot.startsAt)
      .limit(1),
    "las ofertas del recurso",
  );
  if ((offered ?? []).length > 0) return { kind: "none", reason: "slot_offered" };

  let query = entries()
    .select("id, contact_id, conversation_id")
    .eq("location_id", slot.locationId)
    .eq("service_id", slot.serviceId)
    .eq("status", "waiting")
    .lte("wanted_from", slot.startsAt)
    .gte("wanted_until", slot.endsAt)
    .not("conversation_id", "is", null);
  if (tried.length > 0) query = query.not("id", "in", `(${tried.join(",")})`);
  const candidates = check(await query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(50), "la lista de espera");
  for (const candidate of candidates ?? []) {
    if (!candidate.conversation_id) continue;
    const taken = await entries()
      .update({
        status: "offered",
        offered_resource_id: slot.resourceId,
        offered_starts_at: slot.startsAt,
        offered_ends_at: slot.endsAt,
        offer_expires_at: expiresAt,
      })
      .eq("id", candidate.id)
      .eq("status", "waiting")
      .select("id");
    if (taken.error) throw new Error(`no se pudo ofrecer el hueco (${taken.error.code})`);
    if ((taken.data ?? []).length > 0) {
      return { kind: "offered", entryId: candidate.id, contactId: candidate.contact_id, conversationId: candidate.conversation_id };
    }
  }
  return { kind: "none", reason: "no_candidates" };
}

/** Quita la oferta (vuelve a esperar, en su sitio de la lista), solo si sigue siendo esta. */
async function release(db: TenantDb, entryId: string, slot: FreeSlot, expiresAt: string): Promise<boolean> {
  const { data, error } = await db
    .from("waitlist_entries")
    .update({ status: "waiting", offered_resource_id: null, offered_starts_at: null, offered_ends_at: null, offer_expires_at: null })
    .eq("id", entryId)
    .eq("status", "offered")
    .eq("offered_starts_at", slot.startsAt)
    .eq("offer_expires_at", expiresAt)
    .select("id");
  if (error) throw new Error(`no se pudo quitar la oferta (${error.code})`);
  return (data ?? []).length > 0;
}

type Settled = "booked" | "taken" | "released" | "changed";

/** Al acabar el plazo: qué pasó con el hueco y con la entrada. */
async function settle(db: TenantDb, entryId: string, contactId: string, slot: FreeSlot, expiresAt: string): Promise<Settled> {
  const booked = check(
    await db
      .from("appointments")
      .select("contact_id")
      .eq("resource_id", slot.resourceId)
      .eq("status", "booked")
      .lt("starts_at", slot.endsAt)
      .gt("ends_at", slot.startsAt)
      .limit(1),
    "las citas del recurso",
  );
  const holder = booked?.[0];
  if (holder && holder.contact_id === contactId) {
    // Lo reservó quien lo tenía ofrecido: la entrada queda reservada, con su hueco.
    const { error } = await db
      .from("waitlist_entries")
      .update({ status: "booked" })
      .eq("id", entryId)
      .eq("status", "offered")
      .eq("offer_expires_at", expiresAt);
    if (error) throw new Error(`no se pudo cerrar la entrada (${error.code})`);
    return "booked";
  }
  const released = await release(db, entryId, slot, expiresAt);
  if (holder) return "taken";
  return released ? "released" : "changed";
}

/** La entrada y lo que pide el texto, de esta organización. */
export function createWaitlistOfferSource(db: TenantDb, fallbackLocale: string): WaitlistOfferSource {
  return {
    async load(entryId) {
      const entry = check(
        await db
          .from("waitlist_entries")
          .select("id, status, contact_id, conversation_id, service_id, location_id, offered_starts_at, offer_expires_at")
          .eq("id", entryId)
          .maybeSingle(),
        "la entrada de la lista",
      );
      if (!entry) return null;
      const [service, location, contact] = await Promise.all([
        db.from("services").select("name").eq("id", entry.service_id).maybeSingle(),
        db.from("locations").select("name, timezone").eq("id", entry.location_id).maybeSingle(),
        db.from("contacts").select("locale").eq("id", entry.contact_id).maybeSingle(),
      ]);
      const found: OfferedEntry = {
        id: entry.id,
        status: entry.status,
        contactId: entry.contact_id,
        conversationId: entry.conversation_id,
        offeredStartsAt: entry.offered_starts_at ? new Date(entry.offered_starts_at) : null,
        offerExpiresAt: entry.offer_expires_at ? new Date(entry.offer_expires_at) : null,
        service: check(service, "el servicio")?.name ?? "",
        location: check(location, "el local")?.name ?? "",
        timezone: check(location, "el local")?.timezone ?? "UTC",
        locale: check(contact, "el contacto")?.locale ?? fallbackLocale,
      };
      return found;
    },
  };
}

/** El permiso para la oferta: apuntarse a la lista es pedirla (la audiencia ya exige que siga apuntado con esta oferta). */
export const waitlistOfferConsent: ConsentChecker = {
  allowed: ({ contactIds, skillKey }) => Promise.resolve(skillKey === WAITLIST_OFFER_SKILL_KEY ? [...contactIds] : []),
};

export interface WaitlistInput {
  /** La organización de la fila del evento (control 3.7), nunca del payload. */
  organizationId: string;
  appointmentId: string;
}

export interface WaitlistOptions {
  db: ServiceDb;
  logger: Logger;
  /** Solo para los tests: el plazo de cada oferta. */
  rules?: WaitlistRules;
}

/** Registra el workflow (antes de DBOS.launch) y devuelve el consumidor que lo arranca. */
export function registerWaitlistOffers({ db, logger, rules = WAITLIST_RULES }: WaitlistOptions): EventHandler {
  const log = logger.child({ component: "waitlist" });

  function skillFor(tenant: TenantDb, fallbackLocale: string): WaitlistOfferSkill {
    return createWaitlistOfferSkill({ source: createWaitlistOfferSource(tenant, fallbackLocale), sender: createConversationSender(tenant) });
  }

  /** Envía la oferta ya guardada. Devuelve si salió. */
  async function sendOffer(input: WaitlistInput, slot: FreeSlot, picked: Extract<Picked, { kind: "offered" }>, expiresAt: string, round: number): Promise<boolean> {
    const tenant = db.forOrganization(input.organizationId);
    const fields = { organizationId: input.organizationId, appointmentId: input.appointmentId, entryId: picked.entryId, round };
    const step = `offer-${round}`;
    const probe = skillFor(tenant, "en");
    const agent = await DBOS.runStep(() => conversationAgent(tenant, picked.conversationId, probe as unknown as SkillDefinition<unknown>), {
      name: `${step}:load`,
    });
    if (agent.kind === "skip") {
      log.info({ ...fields, reason: agent.reason }, "oferta que no sale");
      return false;
    }
    const skill = skillFor(tenant, agent.defaultLocale);
    const key = offerKey(picked.entryId, slot.startsAt, expiresAt);
    const runId = offerRunId(key);
    const result = await sendScheduled({
      db: tenant,
      organizationId: input.organizationId,
      locationId: slot.locationId,
      contactId: picked.contactId,
      agent,
      skill: skill as unknown as SkillDefinition<unknown>,
      args: { entry_id: picked.entryId, starts_at: slot.startsAt, expires_at: expiresAt },
      consent: waitlistOfferConsent,
      key,
      runId,
      ref: `${input.appointmentId}:${picked.entryId}`,
      step,
    });
    if (result.sent) log.info({ ...fields, runId }, "hueco ofrecido");
    else if ("status" in result) log.warn({ ...fields, error: result.error }, "la oferta no se pudo enviar");
    else log.info({ ...fields, outcome: result.outcome, reason: result.reason }, "oferta que no sale");
    return result.sent;
  }

  // Entre paso y paso, solo lógica determinista: la hora sale de DBOS.now (un
  // paso) y DBOS.sleep guarda cuándo despertar.
  async function offerSlot(input: WaitlistInput): Promise<void> {
    const tenant = db.forOrganization(input.organizationId);
    const fields = { organizationId: input.organizationId, appointmentId: input.appointmentId };
    const slot = await DBOS.runStep(() => loadSlot(tenant, input.appointmentId), { name: "slot" });
    if (slot.kind === "skip") {
      log.info({ ...fields, reason: slot.reason }, "hueco que no se ofrece");
      return;
    }
    const startsAt = Date.parse(slot.startsAt);
    const tried: string[] = [];
    for (let round = 1; round <= rules.maxOffers; round += 1) {
      let now = await DBOS.now();
      const next = nextOffer(now, startsAt, slot.timezone, rules);
      if (!next) {
        log.info({ ...fields, reason: "too_late" }, "hueco que no se ofrece");
        return;
      }
      // De noche, espera a la hora en que acaban las horas de silencio del local.
      if (next.sendAt > now) {
        await DBOS.sleep(next.sendAt - now);
        now = await DBOS.now();
        if (now + rules.offerMs > startsAt) {
          log.info({ ...fields, reason: "too_late" }, "hueco que no se ofrece");
          return;
        }
      }
      const expiresAt = new Date(now + rules.offerMs).toISOString();
      const nowIso = new Date(now).toISOString();
      const picked = await DBOS.runStep(() => pickNext(tenant, slot, tried, nowIso, expiresAt), { name: `offer-${round}:pick` });
      if (picked.kind === "none") {
        log.info({ ...fields, reason: picked.reason }, "hueco que no se ofrece");
        return;
      }
      tried.push(picked.entryId);
      const sent = await sendOffer(input, slot, picked, expiresAt, round);
      if (!sent) {
        // No se le pudo avisar: no se le guarda el hueco y se ofrece al siguiente.
        await DBOS.runStep(() => release(tenant, picked.entryId, slot, expiresAt), { name: `offer-${round}:release` });
        continue;
      }
      const wait = Date.parse(expiresAt) - (await DBOS.now());
      if (wait > 0) await DBOS.sleep(wait);
      const settled = await DBOS.runStep(() => settle(tenant, picked.entryId, picked.contactId, slot, expiresAt), { name: `offer-${round}:settle` });
      log.info({ ...fields, entryId: picked.entryId, round, settled }, "plazo de la oferta cumplido");
      if (settled === "booked" || settled === "taken") return;
    }
    log.info({ ...fields, reason: "max_offers" }, "hueco que no se ofrece");
  }

  const workflow = DBOS.registerWorkflow(offerSlot, { name: WAITLIST_WORKFLOW });

  return {
    key: WAITLIST_HANDLER_KEY,
    eventTypes: ["appointment.cancelled"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const input: WaitlistInput = { organizationId: event.organizationId, appointmentId: String(event.payload["appointment_id"]) };
      // Desde la entrega (un workflow): DBOS guarda que la arrancó y, si la
      // entrega se repite, devuelve el mismo en vez de arrancar otro.
      await DBOS.startWorkflow(workflow, { workflowID: waitlistWorkflowId(input.appointmentId) })(input);
      ctx.logger.info({ appointmentId: input.appointmentId }, "ofertas de la lista de espera programadas");
    },
  };
}
