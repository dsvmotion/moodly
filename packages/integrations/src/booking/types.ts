// Reservas detrás de una interfaz por tipo (MANUAL §7.1, roadmap B1): las
// skills de Recepción hablan con BookingProvider y no saben si detrás está el
// calendario propio de Moodly, Google Calendar o el sistema del centro.
//
// Una instancia es de UNA organización (como la conexión MCP). El contacto lo
// pone siempre el runtime (el de la conversación), nunca lo que propone el
// LLM: una cita de otro contacto se trata como si no existiera.

export type AppointmentStatus = "booked" | "cancelled" | "completed" | "no_show";

export interface BookingSlot {
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface Appointment {
  id: string;
  locationId: string;
  serviceId: string;
  resourceId: string;
  contactId: string;
  /** La conversación en la que la reservó el agente, o null (la reservó el equipo o vino sincronizada). */
  conversationId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}

export interface FindSlotsRequest {
  locationId: string;
  serviceId: string;
  from: Date;
  to: Date;
  limit: number;
}

export interface BookRequest {
  locationId: string;
  serviceId: string;
  resourceId: string;
  contactId: string;
  /**
   * La conversación del run, la pone el runtime como el contacto: reservar a
   * través del agente es el permiso para los recordatorios de esa cita, que
   * salen por ella (producto, 2026-11-08). Null si el run no viene de una.
   */
  conversationId: string | null;
  startsAt: Date;
  /** La de la ejecución (ADR 0047): la misma petición crea una sola cita. */
  idempotencyKey: string;
}

export interface RescheduleRequest {
  appointmentId: string;
  contactId: string;
  startsAt: Date;
  /** Si cambia de recurso (otro profesional o cabina del mismo local). */
  resourceId?: string;
}

export interface CancelRequest {
  appointmentId: string;
  contactId: string;
}

export interface BookingProvider {
  findSlots(request: FindSlotsRequest): Promise<BookingSlot[]>;
  /** Idempotente: con la misma idempotencyKey devuelve la cita que ya creó. */
  book(request: BookRequest): Promise<Appointment>;
  reschedule(request: RescheduleRequest): Promise<Appointment>;
  /** Idempotente: cancelar una cita ya cancelada la devuelve tal cual. */
  cancel(request: CancelRequest): Promise<Appointment>;
  /** Las próximas citas vivas de un contacto. */
  upcomingForContact(request: { contactId: string; from: Date; limit: number }): Promise<Appointment[]>;
}

/** El hueco ya no está libre (otra cita lo ocupó entre la búsqueda y la reserva). */
export class SlotTakenError extends Error {
  override name = "SlotTakenError";
}
/** No existe, es de otra organización o de otro contacto: para quien pregunta, es lo mismo. */
export class AppointmentNotFoundError extends Error {
  override name = "AppointmentNotFoundError";
}
/** Está cancelada, completada o perdida: ya no se mueve. */
export class AppointmentNotChangeableError extends Error {
  override name = "AppointmentNotChangeableError";
}
/** El servicio no se ofrece en ese local, o el recurso no lo hace. */
export class InvalidBookingError extends Error {
  override name = "InvalidBookingError";
}
