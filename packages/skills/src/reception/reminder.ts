import { defineSkill } from "@repo/agent-core";
import type { SkillContext, SkillDefinition } from "@repo/agent-core";
import { z } from "zod";
import type { ConversationSender } from "../conversation/reply.js";

// Los recordatorios de las citas (paso 4e, MANUAL §5.1, decidido por producto
// el 2026-11-08): 24 h y 4 h antes, por la conversación en la que el agente
// hizo la reserva. No los propone el modelo: los lanza la plataforma cuando
// llega la hora, así que el modelo nunca los ve como herramienta.
//
// - Envío a un cliente (external_outreach) con autonomía execute: salen solos.
// - El destinatario no sale de la entrada: es el contacto de la cita, si la
//   cita sigue siendo la que se recuerda (reservada, a la misma hora y con su
//   conversación), y el motor de políticas lo filtra por su permiso.
// - El texto es fijo por idioma (sin modelo, sin coste de IA) y lleva cómo
//   darse de baja.

export const APPOINTMENT_REMINDER_SKILL_KEY = "appointment_reminder";

export const REMINDER_KINDS = ["24h", "4h"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Lo que el recordatorio necesita de la cita, de la organización del run. */
export interface ReminderAppointment {
  id: string;
  status: string;
  startsAt: Date;
  contactId: string;
  /** La conversación en la que la reservó el agente; sin ella no hay recordatorio. */
  conversationId: string | null;
  service: string;
  location: string;
  timezone: string;
  /** El idioma del contacto o, si no lo tiene, el de la organización. */
  locale: string;
}

export interface ReminderSource {
  /** La cita, o null si no existe en esta organización. */
  load(appointmentId: string): Promise<ReminderAppointment | null>;
}

export class ReminderNotApplicableError extends Error {
  override name = "ReminderNotApplicableError";
}

/** Si la cita sigue siendo la que se recuerda: reservada, a la misma hora y reservada por el agente en una conversación. */
export function stillApplies(appointment: ReminderAppointment, startsAt: string): appointment is ReminderAppointment & { conversationId: string } {
  return appointment.status === "booked" && appointment.startsAt.getTime() === Date.parse(startsAt) && appointment.conversationId !== null;
}

type Texts = { reminder: (a: { service: string; location: string; when: string }) => string };
const TEXTS: Record<"es" | "en", Texts> = {
  es: {
    reminder: ({ service, location, when }) =>
      `Recordatorio: tienes cita de ${service} en ${location} el ${when}. Si no puedes venir, contesta a este mensaje. Para no recibir más recordatorios, responde BAJA.`,
  },
  en: {
    reminder: ({ service, location, when }) =>
      `Reminder: you have a ${service} appointment at ${location} on ${when}. If you can't make it, reply to this message. To stop reminders, reply STOP.`,
  },
};

function language(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

/** El texto del recordatorio, con la fecha y la hora en la zona del local. */
export function reminderText(appointment: Pick<ReminderAppointment, "service" | "location" | "timezone" | "locale" | "startsAt">): string {
  const lang = language(appointment.locale);
  const when = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    timeZone: appointment.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(appointment.startsAt);
  return TEXTS[lang].reminder({ service: appointment.service, location: appointment.location, when });
}

const input = z.object({
  appointment_id: z.uuid(),
  kind: z.enum(REMINDER_KINDS),
  // La hora para la que se programó: si la cita se movió, este ya no vale.
  starts_at: z.iso.datetime({ offset: true }),
});
type ReminderInput = z.infer<typeof input>;
const output = z.object({ message_id: z.string(), conversation_id: z.string() });
type ReminderOutput = z.infer<typeof output>;

export type AppointmentReminderSkill = SkillDefinition<ReminderInput, ReminderOutput>;

export function createAppointmentReminderSkill({ source, sender }: { source: ReminderSource; sender: ConversationSender }): AppointmentReminderSkill {
  async function applicable(appointmentId: string, startsAt: string) {
    const appointment = await source.load(appointmentId);
    return appointment && stillApplies(appointment, startsAt) ? appointment : null;
  }

  return defineSkill({
    key: APPOINTMENT_REMINDER_SKILL_KEY,
    version: 1,
    description: "Recuerda su cita al cliente 24 y 4 horas antes, en la conversación en la que la reservó.",
    effectClass: "external_outreach",
    defaultAutonomy: "execute",
    input,
    output,
    // El contacto de la cita, solo si sigue siendo la que se recuerda.
    async audience(_ctx, args) {
      const appointment = await applicable(args.appointment_id, args.starts_at);
      return appointment ? [appointment.contactId] : [];
    },
    async preview(_ctx, args) {
      const appointment = await applicable(args.appointment_id, args.starts_at);
      return { summary: appointment ? reminderText(appointment) : "Recordar una cita que ya no está como se reservó (no se enviará)" };
    },
    async execute(ctx: SkillContext, args) {
      const appointment = await applicable(args.appointment_id, args.starts_at);
      if (!appointment) throw new ReminderNotApplicableError("la cita ya no está como se reservó");
      if (ctx.target.kind !== "audience" || !ctx.target.contactIds.includes(appointment.contactId)) {
        throw new ReminderNotApplicableError("el contacto de la cita no está en la audiencia que resolvió el runtime");
      }
      const sent = await sender.send({ conversationId: appointment.conversationId, text: reminderText(appointment), idempotencyKey: ctx.idempotencyKey });
      return { message_id: sent.messageId, conversation_id: appointment.conversationId };
    },
  });
}
