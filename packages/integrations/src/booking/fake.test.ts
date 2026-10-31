import { describe, expect, it } from "vitest";
import { createFakeBookingProvider } from "./fake.js";
import { AppointmentNotChangeableError, AppointmentNotFoundError, InvalidBookingError, SlotTakenError } from "./types.js";

// El calendario falso tiene que comportarse como el de Moodly: si no, los tests
// de las skills probarían otra cosa.
const LOC = "loc-1";
const OTHER_LOC = "loc-2";
const setup = () =>
  createFakeBookingProvider({
    services: [
      { id: "laser", durationMinutes: 30, locationId: null },
      { id: "masaje", durationMinutes: 60, locationId: OTHER_LOC },
    ],
    resources: [
      { id: "cab1", locationId: LOC, serviceIds: ["laser"] },
      { id: "cab2", locationId: LOC, serviceIds: ["laser"] },
    ],
    now: () => new Date("2030-06-01T00:00:00Z"),
  });
const day = { from: new Date("2030-06-03T00:00:00Z"), to: new Date("2030-06-04T00:00:00Z") };
const at = (iso: string) => new Date(iso);

describe("createFakeBookingProvider", () => {
  it("da huecos cada 15 minutos dentro del horario, por recurso", async () => {
    const slots = await setup().findSlots({ locationId: LOC, serviceId: "laser", ...day, limit: 50 });
    expect(slots).toHaveLength(38);
    expect(slots[0]).toEqual({ resourceId: "cab1", startsAt: at("2030-06-03T09:00:00Z"), endsAt: at("2030-06-03T09:30:00Z") });
  });

  it("no da huecos de un servicio que no se ofrece en ese local", async () => {
    expect(await setup().findSlots({ locationId: LOC, serviceId: "masaje", ...day, limit: 50 })).toEqual([]);
  });

  it("reserva, y la misma petición devuelve la misma cita", async () => {
    const calendar = setup();
    const request = { locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "ana", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-1" };
    const first = await calendar.book(request);
    const again = await calendar.book(request);
    expect(again).toBe(first);
    expect(calendar.appointments).toHaveLength(1);
    expect(first.endsAt).toEqual(at("2030-06-03T09:30:00Z"));
  });

  it("nunca dos citas solapadas del mismo recurso", async () => {
    const calendar = setup();
    await calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "ana", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-1" });
    await expect(
      calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "luis", startsAt: at("2030-06-03T09:15:00Z"), idempotencyKey: "k-2" }),
    ).rejects.toThrow(SlotTakenError);
    const slots = await calendar.findSlots({ locationId: LOC, serviceId: "laser", ...day, limit: 50 });
    expect(slots).toHaveLength(36);
  });

  it("rechaza un recurso que no hace el servicio", async () => {
    await expect(
      setup().book({ locationId: LOC, serviceId: "masaje", resourceId: "cab1", contactId: "ana", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-1" }),
    ).rejects.toThrow(InvalidBookingError);
  });

  it("solo mueve o cancela las citas del contacto, y cancelar es idempotente y definitivo", async () => {
    const calendar = setup();
    const appointment = await calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "ana", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-1" });
    await expect(calendar.cancel({ appointmentId: appointment.id, contactId: "luis" })).rejects.toThrow(AppointmentNotFoundError);
    const moved = await calendar.reschedule({ appointmentId: appointment.id, contactId: "ana", startsAt: at("2030-06-03T10:00:00Z") });
    expect(moved.endsAt).toEqual(at("2030-06-03T10:30:00Z"));
    expect((await calendar.cancel({ appointmentId: appointment.id, contactId: "ana" })).status).toBe("cancelled");
    expect((await calendar.cancel({ appointmentId: appointment.id, contactId: "ana" })).status).toBe("cancelled");
    await expect(calendar.reschedule({ appointmentId: appointment.id, contactId: "ana", startsAt: at("2030-06-03T11:00:00Z") })).rejects.toThrow(
      AppointmentNotChangeableError,
    );
  });

  it("lista las próximas citas vivas del contacto", async () => {
    const calendar = setup();
    await calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "ana", startsAt: at("2030-06-03T11:00:00Z"), idempotencyKey: "k-1" });
    await calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab2", contactId: "ana", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-2" });
    await calendar.book({ locationId: LOC, serviceId: "laser", resourceId: "cab1", contactId: "luis", startsAt: at("2030-06-03T09:00:00Z"), idempotencyKey: "k-3" });
    const upcoming = await calendar.upcomingForContact({ contactId: "ana", from: at("2030-06-01T00:00:00Z"), limit: 5 });
    expect(upcoming.map((a) => a.startsAt.toISOString())).toEqual(["2030-06-03T09:00:00.000Z", "2030-06-03T11:00:00.000Z"]);
  });
});
