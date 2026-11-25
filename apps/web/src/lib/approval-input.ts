// Lo que propone una aprobación, leído de la entrada de su ejecución
// (executions.input), por skill. Puro: lo usan el detalle de la bandeja (OA02)
// y la acción de aprobar. Una entrada que no tiene la forma esperada no se
// adivina: queda como «other» y el detalle enseña solo el resumen.

import { z } from "zod";

export type ApprovalInput =
  | { kind: "reply"; text: string }
  | { kind: "booking"; serviceId: string; resourceId: string | null; startsAt: string }
  | { kind: "reschedule"; appointmentId: string; resourceId: string | null; startsAt: string }
  | { kind: "cancel"; appointmentId: string }
  | { kind: "other" };

const instant = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const replyInput = z.object({ text: z.string().min(1) });
const bookingInput = z.object({ service_id: z.string(), resource_id: z.string().optional(), starts_at: instant });
const rescheduleInput = z.object({ appointment_id: z.string(), resource_id: z.string().optional(), starts_at: instant });
const cancelInput = z.object({ appointment_id: z.string() });

export function parseApprovalInput(skillKey: string, input: unknown): ApprovalInput {
  switch (skillKey) {
    case "reply": {
      const parsed = replyInput.safeParse(input);
      return parsed.success ? { kind: "reply", text: parsed.data.text } : { kind: "other" };
    }
    case "book_appointment": {
      const parsed = bookingInput.safeParse(input);
      return parsed.success
        ? { kind: "booking", serviceId: parsed.data.service_id, resourceId: parsed.data.resource_id ?? null, startsAt: parsed.data.starts_at }
        : { kind: "other" };
    }
    case "reschedule_appointment": {
      const parsed = rescheduleInput.safeParse(input);
      return parsed.success
        ? { kind: "reschedule", appointmentId: parsed.data.appointment_id, resourceId: parsed.data.resource_id ?? null, startsAt: parsed.data.starts_at }
        : { kind: "other" };
    }
    case "cancel_appointment": {
      const parsed = cancelInput.safeParse(input);
      return parsed.success ? { kind: "cancel", appointmentId: parsed.data.appointment_id } : { kind: "other" };
    }
    default:
      return { kind: "other" };
  }
}

/**
 * Una reserva o un cambio de cita cuya hora ya pasó (revisión de V10 sobre
 * #312): aprobarla no tiene sentido y al ejecutarla fallaría (la skill y la
 * base de datos rechazan el pasado). Lo demás no tiene hora que pasar.
 */
export function slotHasPassed(input: ApprovalInput, now: Date): boolean {
  if (input.kind !== "booking" && input.kind !== "reschedule") return false;
  return Date.parse(input.startsAt) <= now.getTime();
}
