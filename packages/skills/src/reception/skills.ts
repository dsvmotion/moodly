import { defineSkill } from "@repo/agent-core";
import type { SkillContext, SkillDefinition } from "@repo/agent-core";
import type { Appointment, BookingProvider } from "@repo/integrations";
import { z } from "zod";

// Las skills de Recepción (paso 4c, roadmap B1/B19): buscar huecos, ver las
// citas del cliente, reservar, mover y cancelar. Hablan con BookingProvider
// (el calendario de Moodly o el del centro) y no saben cuál hay detrás.
//
// - La organización, el local y el contacto los pone el runtime (SkillContext).
//   El LLM solo propone el servicio, el recurso, la hora y la cita, que el
//   proveedor comprueba contra la organización y el contacto: una cita de
//   otro cliente es como si no existiera (control 3.1).
// - Reservar, mover y cancelar empiezan en draft (alguien del equipo aprueba)
//   hasta que el negocio suba la autonomía de su agente (B1: «en draft al
//   principio»). Buscar y listar son lectura.
// - Reservar es idempotente con la idempotency_key de la ejecución: un
//   reintento nunca crea dos citas.

/** Para que quien aprueba lea nombres y horas del local, no ids y UTC. */
export interface ReceptionCatalog {
  describe(input: { locationId: string; serviceId: string; resourceId?: string }): Promise<{
    service: string;
    resource: string | null;
    timezone: string;
  } | null>;
}

export class ReceptionScopeError extends Error {
  override name = "ReceptionScopeError";
}

/** Buscar huecos: si el agente la tiene, su prompt lleva los servicios que se pueden reservar (4d-3c). */
export const FIND_SLOTS_SKILL_KEY = "find_slots";

const MAX_WINDOW_MS = 14 * 86_400_000;
const SLOT_LIMIT = 10;

const uuid = z.uuid();
const instant = z.iso.datetime({ offset: true });

const appointmentOutput = z.object({
  id: z.string(),
  service_id: z.string(),
  resource_id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(["booked", "cancelled", "completed", "no_show"]),
});
type AppointmentOutput = z.infer<typeof appointmentOutput>;

function toOutput(appointment: Appointment): AppointmentOutput {
  return {
    id: appointment.id,
    service_id: appointment.serviceId,
    resource_id: appointment.resourceId,
    starts_at: appointment.startsAt.toISOString(),
    ends_at: appointment.endsAt.toISOString(),
    status: appointment.status,
  };
}

function requireLocation(ctx: SkillContext): string {
  if (!ctx.locationId) throw new ReceptionScopeError("este run no tiene local: las citas son de un local");
  return ctx.locationId;
}

function requireContact(ctx: SkillContext): string {
  if (!ctx.contactId) throw new ReceptionScopeError("este run no tiene contacto: las citas son de alguien");
  return ctx.contactId;
}

function localTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}

export interface ReceptionSkills {
  findSlots: SkillDefinition<
    { service_id: string; from: string; until?: string | undefined },
    { slots: { resource_id: string; starts_at: string; ends_at: string }[]; truncated: boolean }
  >;
  listAppointments: SkillDefinition<Record<string, never>, { appointments: AppointmentOutput[] }>;
  bookAppointment: SkillDefinition<{ service_id: string; resource_id: string; starts_at: string }, { appointment: AppointmentOutput }>;
  rescheduleAppointment: SkillDefinition<
    { appointment_id: string; starts_at: string; resource_id?: string | undefined },
    { appointment: AppointmentOutput }
  >;
  cancelAppointment: SkillDefinition<{ appointment_id: string }, { appointment: AppointmentOutput }>;
}

export function createReceptionSkills({ booking, catalog }: { booking: BookingProvider; catalog: ReceptionCatalog }): ReceptionSkills {
  const describe = async (ctx: SkillContext, serviceId: string, resourceId?: string) => {
    const described = await catalog.describe({ locationId: requireLocation(ctx), serviceId, ...(resourceId ? { resourceId } : {}) });
    return described ?? { service: "un servicio que este local no ofrece", resource: null, timezone: "UTC" };
  };

  const findSlots = defineSkill({
    key: FIND_SLOTS_SKILL_KEY,
    version: 1,
    // Devuelve los primeros 10: sin decirlo, un modelo leía la lista como completa
    // y daba por ocupada una hora libre que caía después (lo vio la eval
    // recepcion-mover, V4). truncated lo dice, y la descripción dice cómo mirar
    // una hora concreta.
    description:
      "Finds free slots for a service at this location, starting at `from` (at most 14 days). Returns at most 10, the earliest first. If `truncated` is true there are more free slots after the last one returned: never say a later time is taken; to check a specific time, search again with `from` at that time.",
    effectClass: "read",
    defaultAutonomy: "autonomous",
    // «until» y no «to»: «to» es un campo reservado (un destinatario, ADR 0047).
    input: z.object({ service_id: uuid, from: instant, until: instant.optional() }),
    output: z.object({
      slots: z.array(z.object({ resource_id: z.string(), starts_at: z.string(), ends_at: z.string() })),
      truncated: z.boolean(),
    }),
    preview: (_ctx, input) => Promise.resolve({ summary: `Buscar huecos desde ${input.from}` }),
    async execute(ctx, input) {
      const from = new Date(input.from);
      const to = new Date(Math.min(input.until ? new Date(input.until).getTime() : from.getTime() + 86_400_000, from.getTime() + MAX_WINDOW_MS));
      // Uno más que los que se devuelven: así se sabe si hay más.
      const slots = await booking.findSlots({ locationId: requireLocation(ctx), serviceId: input.service_id, from, to, limit: SLOT_LIMIT + 1 });
      return {
        slots: slots
          .slice(0, SLOT_LIMIT)
          .map((slot) => ({ resource_id: slot.resourceId, starts_at: slot.startsAt.toISOString(), ends_at: slot.endsAt.toISOString() })),
        truncated: slots.length > SLOT_LIMIT,
      };
    },
  });

  const listAppointments = defineSkill({
    key: "list_my_appointments",
    version: 1,
    description: "Lista las próximas citas de la persona con la que hablas.",
    effectClass: "read",
    defaultAutonomy: "autonomous",
    input: z.object({}).strict(),
    output: z.object({ appointments: z.array(appointmentOutput) }),
    preview: () => Promise.resolve({ summary: "Ver las próximas citas de esta persona" }),
    async execute(ctx) {
      const appointments = await booking.upcomingForContact({ contactId: requireContact(ctx), from: new Date(), limit: 10 });
      return { appointments: appointments.map(toOutput) };
    },
  });

  const bookAppointment = defineSkill({
    key: "book_appointment",
    version: 1,
    description: "Reserva una cita para la persona con la que hablas, en un hueco que devolvió find_slots.",
    effectClass: "internal_write",
    defaultAutonomy: "draft",
    input: z.object({ service_id: uuid, resource_id: uuid, starts_at: instant }),
    output: z.object({ appointment: appointmentOutput }),
    async preview(ctx, input) {
      const { service, resource, timezone } = await describe(ctx, input.service_id, input.resource_id);
      return { summary: `Reservar ${service}${resource ? ` con ${resource}` : ""} el ${localTime(input.starts_at, timezone)}` };
    },
    async execute(ctx, input) {
      const appointment = await booking.book({
        locationId: requireLocation(ctx),
        serviceId: input.service_id,
        resourceId: input.resource_id,
        contactId: requireContact(ctx),
        conversationId: ctx.conversationId,
        startsAt: new Date(input.starts_at),
        idempotencyKey: ctx.idempotencyKey,
      });
      return { appointment: toOutput(appointment) };
    },
  });

  const rescheduleAppointment = defineSkill({
    key: "reschedule_appointment",
    version: 1,
    description: "Mueve una cita de la persona con la que hablas a otro hueco libre.",
    effectClass: "internal_write",
    defaultAutonomy: "draft",
    input: z.object({ appointment_id: uuid, starts_at: instant, resource_id: uuid.optional() }),
    output: z.object({ appointment: appointmentOutput }),
    async preview(ctx, input) {
      const current = (await booking.upcomingForContact({ contactId: requireContact(ctx), from: new Date(0), limit: 50 })).find(
        (a) => a.id === input.appointment_id,
      );
      const timezone = current ? (await describe(ctx, current.serviceId)).timezone : "UTC";
      return {
        summary: current
          ? `Mover la cita del ${localTime(current.startsAt.toISOString(), timezone)} al ${localTime(input.starts_at, timezone)}`
          : "Mover una cita que esta persona no tiene (se rechazará)",
      };
    },
    async execute(ctx, input) {
      const appointment = await booking.reschedule({
        appointmentId: input.appointment_id,
        contactId: requireContact(ctx),
        startsAt: new Date(input.starts_at),
        ...(input.resource_id ? { resourceId: input.resource_id } : {}),
      });
      return { appointment: toOutput(appointment) };
    },
  });

  const cancelAppointment = defineSkill({
    key: "cancel_appointment",
    version: 1,
    description: "Cancela una cita de la persona con la que hablas.",
    effectClass: "internal_write",
    defaultAutonomy: "draft",
    input: z.object({ appointment_id: uuid }),
    output: z.object({ appointment: appointmentOutput }),
    async preview(ctx, input) {
      const current = (await booking.upcomingForContact({ contactId: requireContact(ctx), from: new Date(0), limit: 50 })).find(
        (a) => a.id === input.appointment_id,
      );
      const timezone = current ? (await describe(ctx, current.serviceId)).timezone : "UTC";
      return {
        summary: current
          ? `Cancelar la cita del ${localTime(current.startsAt.toISOString(), timezone)}`
          : "Cancelar una cita que esta persona no tiene (se rechazará)",
      };
    },
    async execute(ctx, input) {
      const appointment = await booking.cancel({ appointmentId: input.appointment_id, contactId: requireContact(ctx) });
      return { appointment: toOutput(appointment) };
    },
  });

  return { findSlots, listAppointments, bookAppointment, rescheduleAppointment, cancelAppointment };
}
