import { decide } from "@repo/agent-core";
import type { ConsentChecker, RunScope, SkillContext, SkillDefinition, SkillSettings } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createFakeConversationSender } from "../conversation/fake.js";
import { APPOINTMENT_REMINDER_SKILL_KEY, ReminderNotApplicableError, createAppointmentReminderSkill, reminderText, stillApplies } from "./reminder.js";
import type { ReminderAppointment } from "./reminder.js";

const ORG = "a0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";
const APPT = "c4000000-0000-4000-8000-000000000001";
const ANA = "c3000000-0000-4000-8000-000000000001";
const RUN = "d0000000-0000-4000-8000-000000000001";
const STARTS = "2030-06-03T09:00:00+02:00";

const appointment = (over: Partial<ReminderAppointment> = {}): ReminderAppointment => ({
  id: APPT,
  status: "booked",
  startsAt: new Date(STARTS),
  contactId: ANA,
  conversationId: "conv-1",
  service: "Láser",
  location: "Centro",
  timezone: "Europe/Madrid",
  locale: "es",
  ...over,
});

function setup(current: ReminderAppointment | null = appointment()) {
  const sender = createFakeConversationSender();
  const skill = createAppointmentReminderSkill({ source: { load: (id) => Promise.resolve(id === APPT ? current : null) }, sender });
  return { sender, skill };
}

const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: ANA } };
const everyone: ConsentChecker = { allowed: ({ contactIds }) => Promise.resolve(contactIds) };
const args = (over: Record<string, unknown> = {}) => ({ appointment_id: APPT, kind: "24h", starts_at: STARTS, ...over });

async function decideWith(skill: SkillDefinition<unknown>, settings: SkillSettings = { enabled: true, autonomy: "execute" }, consent = everyone, input = args()) {
  return decide({
    proposal: { skillKey: APPOINTMENT_REMINDER_SKILL_KEY, args: input },
    scope,
    skills: new Map([[APPOINTMENT_REMINDER_SKILL_KEY, skill]]),
    settings: new Map([[APPOINTMENT_REMINDER_SKILL_KEY, settings]]),
    consent,
  });
}

const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  organizationId: ORG,
  locationId: LOC,
  runId: RUN,
  contactId: ANA,
  conversationId: "conv-1",
  target: { kind: "audience", contactIds: [ANA] },
  idempotencyKey: `reminder:${APPT}:2030-06-03T07:00:00.000Z:24h`,
  ...over,
});

describe("el texto del recordatorio", () => {
  it("en español: el servicio, el local, el día y la hora del local, y cómo darse de baja", () => {
    const text = reminderText(appointment());
    expect(text).toContain("Láser");
    expect(text).toContain("Centro");
    expect(text).toContain("lunes, 3 de junio");
    expect(text).toContain("09:00");
    expect(text).toContain("BAJA");
  });

  it("en inglés, con STOP; y la hora es siempre la del local, no la del servidor", () => {
    const text = reminderText(appointment({ locale: "en", timezone: "Atlantic/Canary" }));
    expect(text).toContain("Monday 3 June");
    expect(text).toContain("08:00");
    expect(text).toContain("STOP");
  });

  it("un idioma que no tenemos sale en inglés", () => {
    expect(reminderText(appointment({ locale: "fr" }))).toMatch(/^Reminder:/);
  });
});

describe("si la cita sigue siendo la que se recuerda", () => {
  it("reservada, a la misma hora y con su conversación: sí", () => {
    expect(stillApplies(appointment(), STARTS)).toBe(true);
    expect(stillApplies(appointment(), "2030-06-03T07:00:00Z")).toBe(true);
  });

  it("movida, cancelada o sin conversación (no la reservó el agente): no", () => {
    expect(stillApplies(appointment(), "2030-06-03T10:00:00+02:00")).toBe(false);
    expect(stillApplies(appointment({ status: "cancelled" }), STARTS)).toBe(false);
    expect(stillApplies(appointment({ conversationId: null }), STARTS)).toBe(false);
  });
});

describe("el recordatorio con el motor de políticas", () => {
  it("sale solo (execute) y va al contacto de la cita", async () => {
    const { skill } = setup();
    const decision = await decideWith(skill as unknown as SkillDefinition<unknown>);
    expect(decision).toMatchObject({ outcome: "execute", target: { kind: "audience", contactIds: [ANA] }, autonomy: "execute" });
  });

  it("no pasa de execute aunque el agente la tenga en autónoma (el techo de la clase)", async () => {
    const { skill } = setup();
    const decision = await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: true, autonomy: "autonomous" });
    expect(decision).toMatchObject({ outcome: "execute", autonomy: "execute" });
  });

  it("a quien se dio de baja, nada", async () => {
    const { skill } = setup();
    const nobody: ConsentChecker = { allowed: () => Promise.resolve([]) };
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, undefined, nobody)).toMatchObject({ outcome: "reject", reason: "no_recipients" });
  });

  it("el comprobador de permisos no puede añadir a nadie", async () => {
    const { skill } = setup();
    const extra: ConsentChecker = { allowed: () => Promise.resolve([ANA, "otro-contacto"]) };
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, undefined, extra)).toMatchObject({ target: { contactIds: [ANA] } });
  });

  it("si la cita se movió, se canceló o no es de esta organización, no hay a quién enviarlo", async () => {
    for (const current of [appointment({ startsAt: new Date("2030-06-04T09:00:00+02:00") }), appointment({ status: "cancelled" }), null]) {
      const { skill } = setup(current);
      expect(await decideWith(skill as unknown as SkillDefinition<unknown>)).toMatchObject({ outcome: "reject", reason: "no_recipients" });
    }
  });

  it("desactivada, no sale; con menos autonomía, no es execute (el worker no lo envía)", async () => {
    const { skill } = setup();
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: false, autonomy: "execute" })).toMatchObject({
      outcome: "reject",
      reason: "skill_disabled",
    });
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, { enabled: true, autonomy: "draft" })).toMatchObject({ outcome: "draft" });
  });

  it("la entrada no admite un destinatario ni otra conversación", async () => {
    const { skill } = setup();
    expect(await decideWith(skill as unknown as SkillDefinition<unknown>, undefined, everyone, args({ conversation_id: "otra" }))).toMatchObject({
      outcome: "reject",
      reason: "reserved_field",
    });
  });
});

describe("enviar el recordatorio", () => {
  it("por la conversación de la reserva, con la clave de la ejecución: un reintento no lo repite", async () => {
    const { sender, skill } = setup();
    const input = skill.input.parse(args());
    const first = await skill.execute(ctx(), input);
    const again = await skill.execute(ctx(), input);
    expect(again).toEqual(first);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ conversationId: "conv-1", idempotencyKey: ctx().idempotencyKey });
    expect(sender.sent[0]?.text).toContain("Láser");
    expect(first).toEqual({ message_id: "msg-1", conversation_id: "conv-1" });
  });

  it("nunca a la conversación del run si no es la de la cita", async () => {
    const { sender, skill } = setup(appointment({ conversationId: "conv-de-la-reserva" }));
    await skill.execute(ctx({ conversationId: "otra-conversacion" }), skill.input.parse(args()));
    expect(sender.sent[0]?.conversationId).toBe("conv-de-la-reserva");
  });

  it("si el contacto no está en la audiencia que resolvió el runtime, no se envía", async () => {
    const { sender, skill } = setup();
    await expect(skill.execute(ctx({ target: { kind: "audience", contactIds: ["otro"] } }), skill.input.parse(args()))).rejects.toThrow(
      ReminderNotApplicableError,
    );
    await expect(skill.execute(ctx({ target: { kind: "none" } }), skill.input.parse(args()))).rejects.toThrow(ReminderNotApplicableError);
    expect(sender.sent).toHaveLength(0);
  });

  it("si la cita cambió entre decidir y enviar, no se envía", async () => {
    const { sender, skill } = setup(appointment({ status: "cancelled" }));
    await expect(skill.execute(ctx(), skill.input.parse(args()))).rejects.toThrow(ReminderNotApplicableError);
    expect(sender.sent).toHaveLength(0);
  });

  it("lo que ve quien revisa la ejecución es el texto que se envía", async () => {
    const { skill } = setup();
    expect((await skill.preview(ctx(), skill.input.parse(args()))).summary).toBe(reminderText(appointment()));
  });
});
