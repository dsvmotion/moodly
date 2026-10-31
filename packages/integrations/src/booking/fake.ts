import { randomUUID } from "node:crypto";
import {
  AppointmentNotChangeableError,
  AppointmentNotFoundError,
  InvalidBookingError,
  SlotTakenError,
} from "./types.js";
import type { Appointment, BookingProvider, BookingSlot } from "./types.js";

// Un calendario en memoria con las mismas reglas que el de Moodly (sin
// solapes por recurso, idempotencia, citas de otro contacto invisibles), para
// los tests de las skills y las evals (MANUAL §7.1, modo sandbox). Abre todos
// los días de openHour a closeHour en UTC, con huecos cada 15 minutos.

export interface FakeBookingOptions {
  services: readonly { id: string; durationMinutes: number; locationId: string | null }[];
  resources: readonly { id: string; locationId: string; serviceIds: readonly string[] }[];
  openHour?: number;
  closeHour?: number;
  now?: () => Date;
}

const STEP_MS = 15 * 60_000;

export interface FakeBookingProvider extends BookingProvider {
  readonly appointments: Appointment[];
}

export function createFakeBookingProvider(options: FakeBookingOptions): FakeBookingProvider {
  const appointments: Appointment[] = [];
  const byKey = new Map<string, Appointment>();
  const openHour = options.openHour ?? 9;
  const closeHour = options.closeHour ?? 14;
  const now = options.now ?? (() => new Date());

  const serviceAt = (serviceId: string, locationId: string) => {
    const service = options.services.find((s) => s.id === serviceId);
    return service && (service.locationId === null || service.locationId === locationId) ? service : undefined;
  };
  const canDo = (resourceId: string, serviceId: string, locationId: string) =>
    options.resources.some((r) => r.id === resourceId && r.locationId === locationId && r.serviceIds.includes(serviceId));
  const overlaps = (resourceId: string, start: Date, end: Date, ignoreId?: string) =>
    appointments.some(
      (a) => a.status === "booked" && a.resourceId === resourceId && a.id !== ignoreId && a.startsAt < end && start < a.endsAt,
    );
  const ownedBy = (appointmentId: string, contactId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId && a.contactId === contactId);
    if (!appointment) throw new AppointmentNotFoundError("no hay ninguna cita así para este contacto");
    return appointment;
  };

  return {
    appointments,
    findSlots({ locationId, serviceId, from, to, limit }) {
      const service = serviceAt(serviceId, locationId);
      if (!service) return Promise.resolve([]);
      const duration = service.durationMinutes * 60_000;
      const resources = options.resources.filter((r) => r.locationId === locationId && r.serviceIds.includes(serviceId));
      const slots: BookingSlot[] = [];
      const start = new Date(Math.max(from.getTime(), now().getTime()));
      for (let day = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); day < to.getTime(); day += 86_400_000) {
        for (let t = day + openHour * 3_600_000; t + duration <= day + closeHour * 3_600_000; t += STEP_MS) {
          const startsAt = new Date(t);
          const endsAt = new Date(t + duration);
          if (startsAt < start || endsAt > to) continue;
          for (const resource of resources) {
            if (!overlaps(resource.id, startsAt, endsAt)) slots.push({ resourceId: resource.id, startsAt, endsAt });
          }
        }
      }
      return Promise.resolve(slots.slice(0, Math.min(Math.max(limit, 1), 50)));
    },
    book({ locationId, serviceId, resourceId, contactId, startsAt, idempotencyKey }) {
      const existing = byKey.get(idempotencyKey);
      if (existing) return Promise.resolve(existing);
      const service = serviceAt(serviceId, locationId);
      if (!service || !canDo(resourceId, serviceId, locationId)) {
        return Promise.reject(new InvalidBookingError("el servicio no se ofrece en ese local o el recurso no lo hace"));
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      if (overlaps(resourceId, startsAt, endsAt)) return Promise.reject(new SlotTakenError("ese hueco ya está ocupado"));
      const appointment: Appointment = {
        id: randomUUID(),
        locationId,
        serviceId,
        resourceId,
        contactId,
        startsAt,
        endsAt,
        status: "booked",
      };
      appointments.push(appointment);
      byKey.set(idempotencyKey, appointment);
      return Promise.resolve(appointment);
    },
    reschedule({ appointmentId, contactId, startsAt, resourceId }) {
      try {
        const appointment = ownedBy(appointmentId, contactId);
        if (appointment.status !== "booked") throw new AppointmentNotChangeableError("esa cita ya no se puede mover");
        const target = resourceId ?? appointment.resourceId;
        const service = serviceAt(appointment.serviceId, appointment.locationId);
        if (!service || !canDo(target, appointment.serviceId, appointment.locationId)) {
          throw new InvalidBookingError("ese recurso no hace este servicio en este local");
        }
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
        if (overlaps(target, startsAt, endsAt, appointment.id)) throw new SlotTakenError("ese hueco ya está ocupado");
        Object.assign(appointment, { startsAt, endsAt, resourceId: target });
        return Promise.resolve(appointment);
      } catch (error) {
        return Promise.reject(error as Error);
      }
    },
    cancel({ appointmentId, contactId }) {
      try {
        const appointment = ownedBy(appointmentId, contactId);
        if (appointment.status === "cancelled") return Promise.resolve(appointment);
        if (appointment.status !== "booked") throw new AppointmentNotChangeableError("esa cita ya no se puede cancelar");
        appointment.status = "cancelled";
        return Promise.resolve(appointment);
      } catch (error) {
        return Promise.reject(error as Error);
      }
    },
    upcomingForContact({ contactId, from, limit }) {
      return Promise.resolve(
        appointments
          .filter((a) => a.contactId === contactId && a.status === "booked" && a.startsAt >= from)
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          .slice(0, limit),
      );
    },
  };
}
