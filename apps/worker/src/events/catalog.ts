import { z } from "zod";

// Payload de cada tipo de evento de dominio (ADR 0009). Solo ids y datos
// mínimos, nunca datos personales en claro: quien consume un evento lee lo que
// necesite, acotado a la organización de la fila. El tenant tampoco va aquí:
// organization_id y location_id son columnas de domain_events (control 3.7), y
// Zod quita del payload cualquier clave que no esté en su esquema, así que un
// organization_id metido en el payload no llega a ningún consumidor.

/** Igual que el check de domain_events.chain_depth (protección contra bucles, MANUAL §5.8). */
export const MAX_CHAIN_DEPTH = 5;

const memberRole = z.enum(["org_admin", "region_manager", "location_manager", "staff"]);

export const eventPayloads = {
  // private.emit_invitation_created, en la misma transacción que el alta.
  "invitation.created": z.object({
    invitation_id: z.uuid(),
    role: memberRole,
    invited_by: z.uuid(),
  }),
  // private.emit_approval_decided, en la misma transacción que la decisión
  // (ADR 0047). Despertará al run que espera la aprobación (MANUAL §5.7).
  "approval.decided": z.object({
    approval_id: z.uuid(),
    execution_id: z.uuid(),
    run_id: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
  }),
  // private.emit_approval_created, en la misma transacción que la aprobación
  // (M-02). Lo consume notify.approval_email: el aviso a quien puede decidirla.
  "approval.created": z.object({
    approval_id: z.uuid(),
    execution_id: z.uuid(),
    run_id: z.uuid(),
  }),
  // private.emit_message_received, en la misma transacción que el mensaje de un
  // cliente (paso 4d-2). Lo consume agent.converse: el turno del agente.
  "message.received": z.object({
    conversation_id: z.uuid(),
    message_id: z.uuid(),
  }),
  // private.emit_appointment_event, en la misma transacción que el cambio de la
  // cita (paso 4e-0). Los consumirán el recordatorio de 24 h y la lista de
  // espera. Solo el id y las horas: el contacto se lee de la cita.
  "appointment.created": z.object({
    appointment_id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
  }),
  "appointment.rescheduled": z.object({
    appointment_id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
    previous_starts_at: z.iso.datetime({ offset: true }),
  }),
  "appointment.cancelled": z.object({
    appointment_id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
  }),
  // Paso B20-1: una fuente de conocimiento que hay que (re)indexar.
  "knowledge_source.pending": z.object({
    source_id: z.uuid(),
  }),
  // public.check_budget_thresholds, una sola vez por organización, mes (UTC) y
  // umbral (PL-ledger). Lo consume notify.budget_email: el aviso a los org_admin.
  // Sin importes: se leen del aviso guardado.
  "usage.budget_threshold": z.object({
    month: z.string().regex(/^\d{4}-\d{2}-01$/),
    threshold: z.union([z.literal(80), z.literal(100)]),
  }),
} satisfies Record<string, z.ZodType<Record<string, unknown>>>;

export type EventType = keyof typeof eventPayloads;
export type EventPayload<T extends EventType> = z.infer<(typeof eventPayloads)[T]>;

export function isEventType(type: string): type is EventType {
  return Object.hasOwn(eventPayloads, type);
}

/** El payload validado con el esquema de su tipo (sin claves de más). Lanza si no lo cumple. */
export function parsePayload(type: EventType, payload: unknown): Record<string, unknown> {
  return eventPayloads[type].parse(payload);
}
