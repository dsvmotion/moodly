import { decide } from "@repo/agent-core";
import type { RunScope, SkillContext, SkillDefinition, SkillSettings } from "@repo/agent-core";
import { AppointmentNotFoundError, SlotTakenError, createFakeBookingProvider } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { ReceptionScopeError, createReceptionSkills } from "./skills.js";
import type { ReceptionCatalog } from "./skills.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";
const LASER = "c1000000-0000-4000-8000-000000000001";
const CAB1 = "c2000000-0000-4000-8000-000000000001";
const ANA = "c3000000-0000-4000-8000-000000000001";
const LUIS = "c3000000-0000-4000-8000-000000000002";
const RUN = "d0000000-0000-4000-8000-000000000001";

const catalog: ReceptionCatalog = {
  describe: ({ serviceId, resourceId }) =>
    Promise.resolve(serviceId === LASER ? { service: "Láser", resource: resourceId === CAB1 ? "Cabina 1" : null, timezone: "Europe/Madrid" } : null),
};

function setup() {
  const booking = createFakeBookingProvider({
    services: [{ id: LASER, durationMinutes: 30, locationId: null }],
    resources: [{ id: CAB1, locationId: LOC, serviceIds: [LASER] }],
    now: () => new Date("2030-06-01T00:00:00Z"),
  });
  const skills = createReceptionSkills({ booking, catalog });
  const all = Object.values(skills) as unknown as SkillDefinition<unknown>[];
  return { booking, skills, byKey: new Map(all.map((skill) => [skill.key, skill])) };
}

const scope = (contactId: string | null = ANA, locationId: string | null = LOC): RunScope => ({
  organizationId: ORG,
  locationId,
  runId: RUN,
  conversation: contactId ? { id: "conv-1", contactId } : null,
});
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: ANA,
  target: { kind: "none" },
  idempotencyKey: `${RUN}:book:1`,
  ...over,
});
const settings = (autonomy: SkillSettings["autonomy"]) =>
  new Map(["find_slots", "list_my_appointments", "book_appointment", "reschedule_appointment", "cancel_appointment"].map((k) => [k, { enabled: true, autonomy }]));

describe("skills de Recepción con el motor de políticas", () => {
  it("buscar huecos y ver citas son lectura: se ejecutan solos", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: { skillKey: "find_slots", args: { service_id: LASER, from: "2030-06-03T00:00:00Z" } },
      scope: scope(),
      skills: byKey,
      settings: settings("autonomous"),
    });
    expect(decision.outcome).toBe("execute");
  });

  it("reservar, mover y cancelar nacen en borrador; buscar y listar, autónomas", () => {
    const { skills } = setup();
    expect(
      Object.fromEntries(Object.values(skills).map((skill: { key: string; defaultAutonomy: string }) => [skill.key, skill.defaultAutonomy])),
    ).toEqual({
      find_slots: "autonomous",
      list_my_appointments: "autonomous",
      book_appointment: "draft",
      reschedule_appointment: "draft",
      cancel_appointment: "draft",
    });
  });

  it("reservar empieza en borrador: lo aprueba una persona del equipo", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: { skillKey: "book_appointment", args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z" } },
      scope: scope(),
      skills: byKey,
      settings: settings("draft"),
    });
    expect(decision.outcome).toBe("draft");
  });

  it("el LLM nunca elige para quién: un contact_id en los argumentos se rechaza", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: {
        skillKey: "book_appointment",
        args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z", contact_id: LUIS },
      },
      scope: scope(),
      skills: byKey,
      settings: settings("execute"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "reserved_field" });
  });

  it("ni el local", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: { skillKey: "find_slots", args: { service_id: LASER, from: "2030-06-03T00:00:00Z", location_id: LOC } },
      scope: scope(),
      skills: byKey,
      settings: settings("autonomous"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "reserved_field" });
  });

  it("ver las citas no admite argumentos: lo que invente el modelo se rechaza, no se ignora", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: { skillKey: "list_my_appointments", args: { date: "mañana" } },
      scope: scope(),
      skills: byKey,
      settings: settings("autonomous"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });

  it("rechaza una hora sin zona horaria (se reservaría a otra hora)", async () => {
    const { byKey } = setup();
    const decision = await decide({
      proposal: { skillKey: "book_appointment", args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00" } },
      scope: scope(),
      skills: byKey,
      settings: settings("execute"),
    });
    expect(decision).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });
});

describe("ejecutar las skills de Recepción", () => {
  it("busca huecos en el local del run y devuelve como mucho 10", async () => {
    const { skills } = setup();
    const result = await skills.findSlots.execute(ctx(), { service_id: LASER, from: "2030-06-03T00:00:00Z" });
    expect(result.slots).toHaveLength(10);
    expect(result.slots[0]).toEqual({ resource_id: CAB1, starts_at: "2030-06-03T09:00:00.000Z", ends_at: "2030-06-03T09:30:00.000Z" });
  });

  it("busca como mucho 14 días aunque le pidan más", async () => {
    const { booking, skills } = setup();
    const calls: { from: Date; to: Date }[] = [];
    const findSlots = booking.findSlots.bind(booking);
    booking.findSlots = (request) => {
      calls.push({ from: request.from, to: request.to });
      return findSlots(request);
    };
    await skills.findSlots.execute(ctx(), { service_id: LASER, from: "2030-06-03T00:00:00Z", until: "2031-06-03T00:00:00Z" });
    expect(calls[0]?.to.toISOString()).toBe("2030-06-17T00:00:00.000Z");
  });

  it("reserva para el contacto del run, una sola vez por ejecución", async () => {
    const { booking, skills } = setup();
    const input = { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z" };
    const first = await skills.bookAppointment.execute(ctx(), input);
    const retry = await skills.bookAppointment.execute(ctx(), input);
    expect(retry.appointment.id).toBe(first.appointment.id);
    expect(booking.appointments).toHaveLength(1);
    expect(booking.appointments[0]?.contactId).toBe(ANA);
  });

  it("otra ejecución en el mismo hueco no pisa la cita", async () => {
    const { skills } = setup();
    const input = { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z" };
    await skills.bookAppointment.execute(ctx(), input);
    await expect(skills.bookAppointment.execute(ctx({ contactId: LUIS, idempotencyKey: "otra" }), input)).rejects.toThrow(SlotTakenError);
  });

  it("solo mueve y cancela citas de la persona con la que habla", async () => {
    const { skills } = setup();
    const { appointment } = await skills.bookAppointment.execute(ctx(), { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z" });
    await expect(skills.cancelAppointment.execute(ctx({ contactId: LUIS }), { appointment_id: appointment.id })).rejects.toThrow(
      AppointmentNotFoundError,
    );
    const moved = await skills.rescheduleAppointment.execute(ctx(), { appointment_id: appointment.id, starts_at: "2030-06-03T10:00:00Z" });
    expect(moved.appointment.starts_at).toBe("2030-06-03T10:00:00.000Z");
    expect((await skills.cancelAppointment.execute(ctx(), { appointment_id: appointment.id })).appointment.status).toBe("cancelled");
  });

  it("lista solo las citas de la persona con la que habla", async () => {
    const { skills } = setup();
    await skills.bookAppointment.execute(ctx({ contactId: LUIS, idempotencyKey: "luis" }), {
      service_id: LASER,
      resource_id: CAB1,
      starts_at: "2099-06-03T09:00:00Z",
    });
    expect((await skills.listAppointments.execute(ctx(), {})).appointments).toEqual([]);
  });

  it("sin contacto en el run no reserva; sin local no busca", async () => {
    const { skills } = setup();
    await expect(
      skills.bookAppointment.execute(ctx({ contactId: null }), { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00Z" }),
    ).rejects.toThrow(ReceptionScopeError);
    await expect(skills.findSlots.execute(ctx({ locationId: null }), { service_id: LASER, from: "2030-06-03T00:00:00Z" })).rejects.toThrow(
      ReceptionScopeError,
    );
  });

  it("la vista previa dice qué, con quién y cuándo en la hora del local", async () => {
    const { skills } = setup();
    const preview = await skills.bookAppointment.preview(ctx(), { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T07:00:00Z" });
    expect(preview.summary).toBe("Reservar Láser con Cabina 1 el lunes, 3 de junio de 2030, 9:00");
  });

  it("y la de cancelar, la cita de esa persona", async () => {
    const { skills } = setup();
    const { appointment } = await skills.bookAppointment.execute(ctx(), { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T07:00:00Z" });
    expect((await skills.cancelAppointment.preview(ctx(), { appointment_id: appointment.id })).summary).toBe(
      "Cancelar la cita del lunes, 3 de junio de 2030, 9:00",
    );
    expect((await skills.cancelAppointment.preview(ctx({ contactId: LUIS }), { appointment_id: appointment.id })).summary).toMatch(/no tiene/);
  });
});
