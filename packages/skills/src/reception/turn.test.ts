import { PLATFORM_MODEL_POLICY, createFakeTransport, createModelRouter, runAgentTurn } from "@repo/agent-core";
import type { RunScope, SkillDefinition, SkillSettings, ToolCall, TransportResponse } from "@repo/agent-core";
import { createFakeBookingProvider } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { createFakeConversationSender } from "../conversation/fake.js";
import { createReplySkill } from "../conversation/reply.js";
import { createReceptionSkills } from "./skills.js";
import type { ReceptionCatalog } from "./skills.js";

// Recepción de punta a punta con el turno de verdad (paso 4d-2): las skills de
// Recepción y reply con la autonomía con la que nace un agente, un calendario
// falso y un modelo con guion. Es lo que verá una organización el primer día.
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
const scope: RunScope = { organizationId: ORG, locationId: LOC, runId: RUN, conversation: { id: "conv-1", contactId: ANA } };

function setup() {
  const booking = createFakeBookingProvider({
    services: [{ id: LASER, durationMinutes: 30, locationId: null }],
    resources: [{ id: CAB1, locationId: LOC, serviceIds: [LASER] }],
    now: () => new Date("2030-06-01T00:00:00Z"),
  });
  const sender = createFakeConversationSender();
  const all = [...Object.values(createReceptionSkills({ booking, catalog })), createReplySkill({ sender })] as unknown as SkillDefinition<unknown>[];
  const skills = new Map(all.map((skill) => [skill.key, skill]));
  // Como nace el agente: cada skill con su autonomía por defecto.
  const settings = new Map<string, SkillSettings>(all.map((skill) => [skill.key, { enabled: true, autonomy: skill.defaultAutonomy }]));
  return { booking, sender, skills, settings };
}

const usage = { model: "fake/fast", tokensIn: 100, tokensOut: 20, costEur: 0.001 };
const say = (text: string) => (): TransportResponse => ({ text, ...usage });
const call = (...calls: ToolCall[]) => (): TransportResponse => ({ text: "", toolCalls: calls, ...usage });

function turn(script: (() => TransportResponse)[], message: string) {
  const env = setup();
  let index = 0;
  const transport = createFakeTransport({
    provider: "fake",
    respond: () => (script[Math.min(index++, script.length - 1)] ?? say(""))(),
  });
  const result = runAgentTurn({
    scope,
    systemPrompt: "Eres la recepción del centro.",
    history: [{ author: "contact", content: message }],
    skills: env.skills,
    settings: env.settings,
    router: createModelRouter([transport]),
    policy: PLATFORM_MODEL_POLICY,
    spend: { runEur: 0, dayEur: 0, monthEur: 0 },
  });
  return { ...env, transport, result };
}

describe("Recepción el primer día", () => {
  it("busca huecos por su cuenta y deja la respuesta para que la envíe una persona", async () => {
    const { result, transport, sender } = turn(
      [call({ id: "c1", name: "find_slots", args: { service_id: LASER, from: "2030-06-03T00:00:00+02:00" } }), say("Tengo hueco el lunes a las 9:00.")],
      "¿Tenéis hueco el lunes para láser?",
    );
    const { status, executions } = await result;
    expect(status).toBe("reply_drafted");
    expect(executions.map((execution) => [execution.skillKey, execution.status])).toEqual([
      ["find_slots", "executed"],
      ["reply", "drafted"],
    ]);
    const slots = (executions[0]?.output as { slots: { starts_at: string }[] }).slots;
    // El calendario falso abre a las 9:00 UTC.
    expect(slots[0]?.starts_at).toBe("2030-06-03T09:00:00.000Z");
    // El modelo vio los huecos antes de responder.
    expect(JSON.stringify(transport.calls[1]?.messages)).toContain("2030-06-03T09:00:00.000Z");
    expect(sender.sent).toEqual([]);
  });

  it("reservar queda en borrador: no se crea ninguna cita hasta que la apruebe una persona", async () => {
    const { result, booking } = turn(
      [
        call({ id: "c1", name: "book_appointment", args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00+02:00" } }),
        say("Te confirmamos la cita enseguida."),
      ],
      "Resérvame el lunes a las 9 para láser",
    );
    const { executions } = await result;
    expect(executions[0]).toMatchObject({
      skillKey: "book_appointment",
      status: "drafted",
      preview: { summary: "Reservar Láser con Cabina 1 el lunes, 3 de junio de 2030, 9:00" },
    });
    expect(booking.appointments).toEqual([]);
  });

  it("si el cliente pide reservar a nombre de otro, el motor lo rechaza y no se reserva nada", async () => {
    const { result, booking } = turn(
      [
        call({
          id: "c1",
          name: "book_appointment",
          args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00+02:00", contact_id: LUIS },
        }),
        say("Solo puedo reservar a tu nombre."),
      ],
      "Reserva a nombre de Luis",
    );
    const { executions } = await result;
    expect(executions[0]).toMatchObject({ skillKey: "book_appointment", status: "rejected", rejectReason: "reserved_field" });
    expect(booking.appointments).toEqual([]);
  });

  it("con la autonomía subida, reserva para quien escribe y responde sin esperar", async () => {
    const env = setup();
    env.settings.set("book_appointment", { enabled: true, autonomy: "execute" });
    env.settings.set("reply", { enabled: true, autonomy: "autonomous" });
    let index = 0;
    const script = [
      call({ id: "c1", name: "book_appointment", args: { service_id: LASER, resource_id: CAB1, starts_at: "2030-06-03T09:00:00+02:00" } }),
      say("Listo: el lunes a las 9:00."),
    ];
    const transport = createFakeTransport({ provider: "fake", respond: () => (script[Math.min(index++, 1)] ?? say(""))() });
    const result = await runAgentTurn({
      scope,
      systemPrompt: "Eres la recepción del centro.",
      history: [{ author: "contact", content: "Resérvame el lunes a las 9" }],
      skills: env.skills,
      settings: env.settings,
      router: createModelRouter([transport]),
      policy: PLATFORM_MODEL_POLICY,
      spend: { runEur: 0, dayEur: 0, monthEur: 0 },
    });
    expect(result.status).toBe("replied");
    expect(env.booking.appointments.map((appointment) => [appointment.contactId, appointment.startsAt.toISOString()])).toEqual([
      [ANA, "2030-06-03T07:00:00.000Z"],
    ]);
    expect(env.sender.sent.map((message) => [message.conversationId, message.text])).toEqual([["conv-1", "Listo: el lunes a las 9:00."]]);
  });
});
