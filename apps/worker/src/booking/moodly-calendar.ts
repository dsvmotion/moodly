import type { TenantDb } from "@repo/db/service";
import {
  AppointmentNotChangeableError,
  AppointmentNotFoundError,
  InvalidBookingError,
  SlotTakenError,
  SlotUnavailableError,
} from "@repo/integrations";
import type { Appointment, AppointmentStatus, BookingProvider } from "@repo/integrations";

// El calendario propio de Moodly (paso 4b): la fuente de las citas cuando el
// negocio no tiene una herramienta de reservas conectada (ADR 0023). Las
// reglas las impone la base de datos (sin solapes por recurso, una cita por
// petición, la hora de fin por la duración, cancelar es definitivo); aquí se
// traducen sus errores y se comprueba que la cita es del contacto del runtime.

const COLUMNS = "id, location_id, service_id, resource_id, contact_id, conversation_id, starts_at, ends_at, status";

interface AppointmentRow {
  id: string;
  location_id: string;
  service_id: string;
  resource_id: string;
  contact_id: string;
  conversation_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
}

interface PgError {
  code?: string;
  message: string;
}

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    locationId: row.location_id,
    serviceId: row.service_id,
    resourceId: row.resource_id,
    contactId: row.contact_id,
    conversationId: row.conversation_id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    status: row.status as AppointmentStatus,
  };
}

/** Los errores de Postgres que significan algo para quien reserva; el resto, tal cual. */
function bookingError(error: PgError): Error {
  if (error.code === "23P01") return new SlotTakenError("ese hueco ya está ocupado");
  if (error.code === "BK001") return new SlotUnavailableError("esa hora no es un hueco libre");
  if (error.code === "23514") return new InvalidBookingError("el servicio no se ofrece en ese local o el recurso no lo hace");
  if (error.code === "42501") return new AppointmentNotChangeableError("esa cita ya no se puede cambiar");
  return new Error(`appointments: ${error.message}`);
}

export function createMoodlyCalendar(db: TenantDb): BookingProvider {
  async function ownedBy(appointmentId: string, contactId: string): Promise<AppointmentRow> {
    const { data, error } = await db
      .from("appointments")
      .select(COLUMNS)
      .eq("id", appointmentId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (error) throw bookingError(error);
    if (!data) throw new AppointmentNotFoundError("no hay ninguna cita así para este contacto");
    return data as AppointmentRow;
  }

  return {
    async findSlots({ locationId, serviceId, from, to, limit }) {
      const rows = await db.findBookingSlots({ locationId, serviceId, from, to, limit });
      return rows.map((row) => ({ resourceId: row.resource_id, startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }));
    },

    async book({ locationId, serviceId, resourceId, contactId, conversationId, startsAt, idempotencyKey }) {
      const { data, error } = await db
        .from("appointments")
        .insert({
          location_id: locationId,
          service_id: serviceId,
          resource_id: resourceId,
          contact_id: contactId,
          conversation_id: conversationId,
          starts_at: startsAt.toISOString(),
          // La recalcula la base de datos con la duración del servicio.
          ends_at: startsAt.toISOString(),
          idempotency_key: idempotencyKey,
          booked_by: "agent",
        })
        .select(COLUMNS)
        .single();
      if (!error) return toAppointment(data as AppointmentRow);
      // La misma petición otra vez (un reintento): la cita que ya creó.
      if (error.code === "23505" && error.message.includes("appointments_idempotency_key")) {
        const existing = await db.from("appointments").select(COLUMNS).eq("idempotency_key", idempotencyKey).single();
        if (existing.error) throw bookingError(existing.error);
        return toAppointment(existing.data as AppointmentRow);
      }
      throw bookingError(error);
    },

    async reschedule({ appointmentId, contactId, startsAt, resourceId }) {
      const current = await ownedBy(appointmentId, contactId);
      if (current.status !== "booked") throw new AppointmentNotChangeableError("esa cita ya no se puede mover");
      const { data, error } = await db
        .from("appointments")
        .update({ starts_at: startsAt.toISOString(), resource_id: resourceId ?? current.resource_id })
        .eq("id", appointmentId)
        .eq("contact_id", contactId)
        .select(COLUMNS)
        .single();
      if (error) throw bookingError(error);
      return toAppointment(data as AppointmentRow);
    },

    async cancel({ appointmentId, contactId }) {
      const current = await ownedBy(appointmentId, contactId);
      if (current.status === "cancelled") return toAppointment(current);
      if (current.status !== "booked") throw new AppointmentNotChangeableError("esa cita ya no se puede cancelar");
      const { data, error } = await db
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId)
        .eq("contact_id", contactId)
        .select(COLUMNS)
        .single();
      if (error) throw bookingError(error);
      return toAppointment(data as AppointmentRow);
    },

    async upcomingForContact({ contactId, from, limit }) {
      const { data, error } = await db
        .from("appointments")
        .select(COLUMNS)
        .eq("contact_id", contactId)
        .eq("status", "booked")
        .gte("starts_at", from.toISOString())
        .order("starts_at")
        .limit(limit);
      if (error) throw bookingError(error);
      return (data as AppointmentRow[]).map(toAppointment);
    },
  };
}
