import { BUSY_MAX, type BusyInterval, type CalendarReader } from "../calendar/common.js";
import { CalendarUnavailableError, SlotUnavailableError, type BookingProvider, type BookingSlot } from "./types.js";

// El calendario conectado (Google/Outlook) cuenta al ofrecer huecos (O-02): sus
// horas ocupadas restan huecos del calendario propio de Moodly, y una reserva se
// vuelve a comprobar contra ellas justo antes de escribir. Esto es lógica de
// dominio (no sabe de base de datos ni de Nango): el worker le pasa una fuente
// ya resuelta para la organización y el local de la conversación.
//
// Fail-closed: si no se pueden leer las horas ocupadas, no se ofrece ni se
// reserva nada (CalendarUnavailableError); vale más pasar a una persona que
// arriesgar una doble reserva.

export const BUSY_TIMEOUT_MS = 3_000;
/** Candidatos por página (× limit) y páginas como mucho al quitar los ocupados. */
const PAGE_FACTOR = 3;
const MAX_PAGES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BusySource {
  /** Los tramos ocupados en [from, to). Lanza CalendarUnavailableError si no se puede leer. */
  list(from: Date, to: Date): Promise<BusyInterval[]>;
}

export interface BusySourceOptions {
  timeoutMs?: number;
  /** Para registrar el fallo (ids, nunca el detalle del proveedor). */
  onError?: (err: unknown) => void;
}

/**
 * Una fuente de tramos ocupados a partir de un lector de calendario, con memo
 * por ventana (una lectura por (from, to) mientras viva la fuente) y un tope de
 * tiempo. Cualquier fallo se convierte en CalendarUnavailableError.
 */
export function busySourceFromReader(reader: CalendarReader, options: BusySourceOptions = {}): BusySource {
  const timeoutMs = options.timeoutMs ?? BUSY_TIMEOUT_MS;
  const cache = new Map<string, Promise<BusyInterval[]>>();
  return {
    list(from, to) {
      const key = `${from.toISOString()}|${to.toISOString()}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const pending = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new CalendarUnavailableError("el calendario conectado no respondió a tiempo")), timeoutMs);
          });
          return await Promise.race([reader.listBusy({ from, to, limit: BUSY_MAX }), timeout]);
        } catch (err) {
          options.onError?.(err);
          throw err instanceof CalendarUnavailableError ? err : new CalendarUnavailableError("no se pudo leer el calendario conectado");
        } finally {
          if (timer) clearTimeout(timer);
        }
      })();
      cache.set(key, pending);
      return pending;
    },
  };
}

function overlapsBusy(start: Date, end: Date, busy: readonly BusyInterval[]): boolean {
  return busy.some((interval) => interval.startsAt < end && start < interval.endsAt);
}

/**
 * Envuelve un BookingProvider para que el calendario conectado cuente: findSlots
 * quita los huecos que pisan un tramo ocupado, y book/reschedule lo comprueban
 * otra vez antes de escribir (SlotUnavailableError si choca, para que el modelo
 * vuelva a buscar). Las demás operaciones pasan tal cual.
 */
export function withExternalBusy(provider: BookingProvider, busy: BusySource): BookingProvider {
  return {
    async findSlots(request) {
      const first = await provider.findSlots({ ...request, limit: request.limit * PAGE_FACTOR });
      if (first.length === 0) return first;
      // Una sola lectura del calendario conectado para toda la ventana (más un
      // día: un hueco que empieza antes de `to` puede acabar después).
      const occupied = await busy.list(request.from, new Date(request.to.getTime() + DAY_MS));
      // Por páginas: si los ocupados se comen los candidatos, se piden más, para
      // que sigan saliendo los primeros `limit` libres (y la skill sepa si hay más).
      const free: BookingSlot[] = [];
      const seen = new Set<string>();
      let batch = first;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        let added = false;
        for (const slot of batch) {
          const key = `${slot.resourceId}|${slot.startsAt.getTime()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          added = true;
          if (!overlapsBusy(slot.startsAt, slot.endsAt, occupied)) free.push(slot);
          if (free.length >= request.limit) return free;
        }
        const last = batch[batch.length - 1];
        if (!added || !last || batch.length < request.limit * PAGE_FACTOR) break;
        batch = await provider.findSlots({ ...request, from: last.startsAt, limit: request.limit * PAGE_FACTOR });
      }
      return free;
    },
    async book(request) {
      const end = await slotEnd(provider, request.locationId, request.serviceId, request.resourceId, request.startsAt, 60_000);
      const occupied = await busy.list(request.startsAt, end);
      if (overlapsBusy(request.startsAt, end, occupied)) throw unavailable();
      return provider.book(request);
    },
    async reschedule(request) {
      // El servicio y el local salen de la cita del contacto (la del runtime); si
      // no es suya, el calendario propio la rechaza igual (AppointmentNotFoundError).
      const current = (await provider.upcomingForContact({ contactId: request.contactId, from: new Date(0), limit: 50 })).find(
        (appointment) => appointment.id === request.appointmentId,
      );
      if (current) {
        const duration = current.endsAt.getTime() - current.startsAt.getTime();
        const resourceId = request.resourceId ?? current.resourceId;
        const end = await slotEnd(provider, current.locationId, current.serviceId, resourceId, request.startsAt, duration);
        const occupied = await busy.list(request.startsAt, end);
        if (overlapsBusy(request.startsAt, end, occupied)) throw unavailable();
      }
      return provider.reschedule(request);
    },
    cancel: (request) => provider.cancel(request),
    upcomingForContact: (request) => provider.upcomingForContact(request),
  };
}

async function slotEnd(
  provider: BookingProvider,
  locationId: string,
  serviceId: string,
  resourceId: string,
  startsAt: Date,
  fallbackMs: number,
): Promise<Date> {
  // La duración sale del propio calendario: el hueco que empieza a esa hora para
  // ese recurso. Si no está (al mover, la propia cita puede taparlo), se usa la
  // duración conocida; si la hora no es un hueco, el calendario propio la rechaza.
  const slots = await provider.findSlots({ locationId, serviceId, from: startsAt, to: new Date(startsAt.getTime() + 60_000), limit: 10 });
  const match = slots.find((slot) => slot.resourceId === resourceId && slot.startsAt.getTime() === startsAt.getTime());
  return match ? match.endsAt : new Date(startsAt.getTime() + Math.max(fallbackMs, 60_000));
}

function unavailable(): Error {
  // Mismo error que una hora que ya no es hueco: el modelo vuelve a buscar.
  return new SlotUnavailableError("esa hora está ocupada en el calendario conectado");
}
