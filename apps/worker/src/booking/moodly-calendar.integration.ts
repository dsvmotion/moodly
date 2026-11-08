import { randomUUID } from "node:crypto";
import { createServiceDb } from "@repo/db/service";
import { AppointmentNotChangeableError, AppointmentNotFoundError, SlotTakenError } from "@repo/integrations";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi } from "../testing/local-system-db.ts";
import { createMoodlyCalendar } from "./moodly-calendar.ts";

// El calendario propio contra Supabase local (paso 4b): por PostgREST de
// verdad, con la clave secreta del worker y tenantDb. Los datos de prueba
// viven en un local temporal de Demo A que se borra al terminar.
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const api = localSupabaseApi();
const service = createServiceDb({ url: api.url, secretKey: api.secretKey });
const marker = `booking-${randomUUID().slice(0, 8)}`;
const ids: Record<string, string> = {};

async function one(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`sin id: ${sql}`);
  return id;
}

beforeAll(async () => {
  await admin.connect();
  ids.orgA = await one("select id from public.organizations where name = 'Demo A'", []);
  ids.orgB = await one("select id from public.organizations where name = 'Demo B'", []);
  ids.location = await one(
    `insert into public.locations (organization_id, name, timezone, opening_hours)
     values ($1, $2, 'Europe/Madrid', '{"mon": ["09:00", "14:00"]}') returning id`,
    [ids.orgA, marker],
  );
  ids.service = await one("insert into public.services (organization_id, name, duration_minutes) values ($1, $2, 30) returning id", [
    ids.orgA,
    `${marker}-laser`,
  ]);
  ids.resource = await one(
    "insert into public.booking_resources (organization_id, location_id, name, kind) values ($1, $2, $3, 'room') returning id",
    [ids.orgA, ids.location, `${marker}-cabina`],
  );
  await admin.query("insert into public.resource_services (organization_id, resource_id, service_id) values ($1, $2, $3)", [
    ids.orgA,
    ids.resource,
    ids.service,
  ]);
  ids.ana = await one("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [ids.orgA, `${marker}-ana`]);
  ids.luis = await one("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [ids.orgA, `${marker}-luis`]);
});

afterAll(async () => {
  await admin.query("delete from public.appointments where location_id = $1", [ids.location]);
  await admin.query("delete from public.booking_resources where id = $1", [ids.resource]);
  await admin.query("delete from public.services where id = $1", [ids.service]);
  await admin.query("delete from public.contacts where id = any($1)", [[ids.ana, ids.luis]]);
  await admin.query("delete from public.locations where id = $1", [ids.location]);
  await admin.end();
});

const monday = { from: new Date("2030-06-03T00:00:00+02:00"), to: new Date("2030-06-04T00:00:00+02:00") };

describe("calendario propio de Moodly (BookingProvider sobre tenantDb)", () => {
  it("da los huecos del local en su zona horaria", async () => {
    const calendar = createMoodlyCalendar(service.forOrganization(ids.orgA ?? ""));
    const slots = await calendar.findSlots({ locationId: ids.location ?? "", serviceId: ids.service ?? "", ...monday, limit: 50 });
    expect(slots).toHaveLength(19);
    expect(slots[0]?.startsAt.toISOString()).toBe("2030-06-03T07:00:00.000Z");
  });

  it("reserva una vez por petición, sin solapes, y solo para su organización y su contacto", async () => {
    const calendar = createMoodlyCalendar(service.forOrganization(ids.orgA ?? ""));
    const request = {
      locationId: ids.location ?? "",
      serviceId: ids.service ?? "",
      resourceId: ids.resource ?? "",
      contactId: ids.ana ?? "",
      conversationId: null,
      startsAt: new Date("2030-06-03T07:00:00Z"),
      idempotencyKey: `${marker}:run-1:book`,
    };
    const appointment = await calendar.book(request);
    expect(appointment.endsAt.toISOString()).toBe("2030-06-03T07:30:00.000Z");
    expect((await calendar.book(request)).id).toBe(appointment.id);

    await expect(
      calendar.book({ ...request, contactId: ids.luis ?? "", startsAt: new Date("2030-06-03T07:15:00Z"), idempotencyKey: `${marker}:run-2:book` }),
    ).rejects.toThrow(SlotTakenError);

    await expect(calendar.cancel({ appointmentId: appointment.id, contactId: ids.luis ?? "" })).rejects.toThrow(AppointmentNotFoundError);
    const otherOrg = createMoodlyCalendar(service.forOrganization(ids.orgB ?? ""));
    await expect(otherOrg.cancel({ appointmentId: appointment.id, contactId: ids.ana ?? "" })).rejects.toThrow(AppointmentNotFoundError);
    expect(await otherOrg.upcomingForContact({ contactId: ids.ana ?? "", from: new Date("2030-01-01T00:00:00Z"), limit: 5 })).toEqual([]);

    const moved = await calendar.reschedule({ appointmentId: appointment.id, contactId: ids.ana ?? "", startsAt: new Date("2030-06-03T09:00:00Z") });
    expect(moved.endsAt.toISOString()).toBe("2030-06-03T09:30:00.000Z");
    expect((await calendar.upcomingForContact({ contactId: ids.ana ?? "", from: new Date("2030-01-01T00:00:00Z"), limit: 5 })).map((a) => a.id)).toEqual([
      appointment.id,
    ]);

    expect((await calendar.cancel({ appointmentId: appointment.id, contactId: ids.ana ?? "" })).status).toBe("cancelled");
    expect((await calendar.cancel({ appointmentId: appointment.id, contactId: ids.ana ?? "" })).status).toBe("cancelled");
    await expect(
      calendar.reschedule({ appointmentId: appointment.id, contactId: ids.ana ?? "", startsAt: new Date("2030-06-03T10:00:00Z") }),
    ).rejects.toThrow(AppointmentNotChangeableError);
  });
});
