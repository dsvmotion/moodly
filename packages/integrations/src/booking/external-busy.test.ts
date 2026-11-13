import { describe, expect, it, vi } from "vitest";
import type { BusyInterval, CalendarReader } from "../calendar/common.js";
import { busySourceFromReader, withExternalBusy, type BusySource } from "./external-busy.js";
import { createFakeBookingProvider } from "./fake.js";
import { AppointmentNotFoundError, CalendarUnavailableError, SlotUnavailableError, type BookingProvider } from "./types.js";

// El calendario conectado cuenta al ofrecer huecos (O-02): el decorador y la
// fuente de tramos ocupados, lógica de dominio sin base de datos ni Nango.

const LOCATION = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const RESOURCE = "33333333-3333-4333-8333-333333333333";
const CONTACT = "44444444-4444-4444-8444-444444444444";
const FROM = new Date("2026-11-14T09:00:00Z");
const TO = new Date("2026-11-14T11:00:00Z");

function moodly(): BookingProvider {
  // Abre 9–14 UTC, huecos de 15 min; un servicio de 30 min y un recurso.
  return createFakeBookingProvider({
    services: [{ id: SERVICE, durationMinutes: 30, locationId: LOCATION }],
    resources: [{ id: RESOURCE, locationId: LOCATION, serviceIds: [SERVICE] }],
    now: () => new Date("2026-11-13T00:00:00Z"),
  });
}

function fixedBusy(intervals: BusyInterval[]): BusySource {
  return { list: () => Promise.resolve(intervals) };
}

describe("withExternalBusy.findSlots", () => {
  it("quita los huecos que pisan un tramo ocupado", async () => {
    const booking = withExternalBusy(moodly(), fixedBusy([{ startsAt: new Date("2026-11-14T09:00:00Z"), endsAt: new Date("2026-11-14T10:00:00Z") }]));
    const slots = await booking.findSlots({ locationId: LOCATION, serviceId: SERVICE, from: FROM, to: TO, limit: 10 });
    expect(slots.every((slot) => slot.startsAt >= new Date("2026-11-14T10:00:00Z"))).toBe(true);
    expect(slots[0]?.startsAt).toEqual(new Date("2026-11-14T10:00:00Z"));
  });

  it("sin tramos ocupados devuelve los mismos huecos que el calendario propio", async () => {
    const plain = await moodly().findSlots({ locationId: LOCATION, serviceId: SERVICE, from: FROM, to: TO, limit: 5 });
    const booking = withExternalBusy(moodly(), fixedBusy([]));
    expect(await booking.findSlots({ locationId: LOCATION, serviceId: SERVICE, from: FROM, to: TO, limit: 5 })).toEqual(plain);
  });

  it("si los ocupados se comen la primera página de candidatos, pide más y sigue devolviendo los primeros libres", async () => {
    // limit 2 → páginas de 6 candidatos (09:00…10:15); de 09:00 a 10:30 todo ocupado.
    const booking = withExternalBusy(moodly(), fixedBusy([{ startsAt: new Date("2026-11-14T09:00:00Z"), endsAt: new Date("2026-11-14T10:30:00Z") }]));
    const slots = await booking.findSlots({ locationId: LOCATION, serviceId: SERVICE, from: FROM, to: new Date("2026-11-14T14:00:00Z"), limit: 2 });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual(["2026-11-14T10:30:00.000Z", "2026-11-14T10:45:00.000Z"]);
  });

  it("si el calendario conectado falla, no ofrece nada (fail-closed)", async () => {
    const booking = withExternalBusy(moodly(), { list: () => Promise.reject(new CalendarUnavailableError("x")) });
    await expect(booking.findSlots({ locationId: LOCATION, serviceId: SERVICE, from: FROM, to: TO, limit: 5 })).rejects.toBeInstanceOf(
      CalendarUnavailableError,
    );
  });
});

describe("withExternalBusy.book", () => {
  it("rechaza con SlotUnavailableError una hora ocupada, sin escribir", async () => {
    const base = moodly();
    const booking = withExternalBusy(base, fixedBusy([{ startsAt: new Date("2026-11-14T09:00:00Z"), endsAt: new Date("2026-11-14T09:30:00Z") }]));
    await expect(
      booking.book({ locationId: LOCATION, serviceId: SERVICE, resourceId: RESOURCE, contactId: CONTACT, conversationId: null, startsAt: new Date("2026-11-14T09:00:00Z"), idempotencyKey: "k1" }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    expect(await base.upcomingForContact({ contactId: CONTACT, from: new Date(0), limit: 10 })).toHaveLength(0);
  });

  it("reserva una hora libre en el calendario conectado", async () => {
    const booking = withExternalBusy(moodly(), fixedBusy([{ startsAt: new Date("2026-11-14T09:00:00Z"), endsAt: new Date("2026-11-14T09:30:00Z") }]));
    const appointment = await booking.book({ locationId: LOCATION, serviceId: SERVICE, resourceId: RESOURCE, contactId: CONTACT, conversationId: null, startsAt: new Date("2026-11-14T10:00:00Z"), idempotencyKey: "k2" });
    expect(appointment.startsAt).toEqual(new Date("2026-11-14T10:00:00Z"));
  });
});

describe("withExternalBusy.reschedule", () => {
  async function bookedAt(base: BookingProvider, iso: string) {
    return base.book({ locationId: LOCATION, serviceId: SERVICE, resourceId: RESOURCE, contactId: CONTACT, conversationId: null, startsAt: new Date(iso), idempotencyKey: iso });
  }

  it("no mueve a una hora cuyo tramo entero (la duración de la cita) pisa algo ocupado", async () => {
    const base = moodly();
    const appointment = await bookedAt(base, "2026-11-14T09:00:00Z");
    // Ocupado de 11:15 a 11:30: el inicio (11:00) está libre, pero la cita de 30 min lo pisa.
    const booking = withExternalBusy(base, fixedBusy([{ startsAt: new Date("2026-11-14T11:15:00Z"), endsAt: new Date("2026-11-14T11:30:00Z") }]));
    await expect(booking.reschedule({ appointmentId: appointment.id, contactId: CONTACT, startsAt: new Date("2026-11-14T11:00:00Z") })).rejects.toBeInstanceOf(
      SlotUnavailableError,
    );
    const [still] = await base.upcomingForContact({ contactId: CONTACT, from: new Date(0), limit: 10 });
    expect(still?.startsAt).toEqual(new Date("2026-11-14T09:00:00Z"));
  });

  it("una cita que no es del contacto no se mueve y no se salta la comprobación (fail-closed)", async () => {
    const base = moodly();
    const appointment = await bookedAt(base, "2026-11-14T09:00:00Z");
    let reads = 0;
    const booking = withExternalBusy(base, { list: () => ((reads += 1), Promise.resolve([])) });
    await expect(
      booking.reschedule({ appointmentId: appointment.id, contactId: "55555555-5555-4555-8555-555555555555", startsAt: new Date("2026-11-14T12:00:00Z") }),
    ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    expect(reads).toBe(0);
    const [still] = await base.upcomingForContact({ contactId: CONTACT, from: new Date(0), limit: 10 });
    expect(still?.startsAt).toEqual(new Date("2026-11-14T09:00:00Z"));
  });

  it("mueve a una hora libre en el calendario conectado", async () => {
    const base = moodly();
    const appointment = await bookedAt(base, "2026-11-14T09:00:00Z");
    const booking = withExternalBusy(base, fixedBusy([{ startsAt: new Date("2026-11-14T11:15:00Z"), endsAt: new Date("2026-11-14T11:30:00Z") }]));
    const moved = await booking.reschedule({ appointmentId: appointment.id, contactId: CONTACT, startsAt: new Date("2026-11-14T12:00:00Z") });
    expect(moved.startsAt).toEqual(new Date("2026-11-14T12:00:00Z"));
  });
});

describe("busySourceFromReader", () => {
  function readerReturning(intervals: BusyInterval[], calls: { n: number }): CalendarReader {
    return {
      listUpcomingEvents: () => Promise.resolve([]),
      listBusy: () => {
        calls.n += 1;
        return Promise.resolve(intervals);
      },
    };
  }

  it("lee una sola vez por ventana (memo)", async () => {
    const calls = { n: 0 };
    const source = busySourceFromReader(readerReturning([], calls));
    await source.list(FROM, TO);
    await source.list(FROM, TO);
    expect(calls.n).toBe(1);
  });

  it("un fallo del lector se convierte en CalendarUnavailableError y se registra", async () => {
    const onError = vi.fn();
    const source = busySourceFromReader({ listUpcomingEvents: () => Promise.resolve([]), listBusy: () => Promise.reject(new Error("boom")) }, { onError });
    await expect(source.list(FROM, TO)).rejects.toBeInstanceOf(CalendarUnavailableError);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("si el lector tarda más que el tope, CalendarUnavailableError", async () => {
    vi.useFakeTimers();
    try {
      const source = busySourceFromReader({ listUpcomingEvents: () => Promise.resolve([]), listBusy: () => new Promise(() => {}) }, { timeoutMs: 3_000 });
      const assertion = expect(source.list(FROM, TO)).rejects.toBeInstanceOf(CalendarUnavailableError);
      await vi.advanceTimersByTimeAsync(3_001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
