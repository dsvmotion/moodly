import { composeSystemPrompt } from "@repo/agent-core";
import type { BookableService, RunScope, SkillDefinition, SkillSettings } from "@repo/agent-core";
import { createFakeBookingProvider } from "@repo/integrations";
import type { FakeBookingProvider } from "@repo/integrations";
import { createFakeConversationSender, createJoinWaitlistSkill, createReceptionSkills, createReplySkill } from "@repo/skills";
import type { FakeConversationSender, ReceptionCatalog, WaitlistEntry, WaitlistStore } from "@repo/skills";

// El negocio de las conversaciones de prueba (MANUAL §12.4): un centro de
// estética de Madrid con un local, tres servicios y dos cabinas, sobre los
// proveedores falsos de verdad (calendario y envío). Sin datos reales: los IDs
// son fijos y las personas, inventadas.
//
// Cada caso monta su propio mundo: los agentes nacen como en la base de datos
// (private.default_agent_skills) y cada skill con su autonomía por defecto.

export const ORG = "e0000000-0000-4000-8000-000000000000";
export const LOCATION = "e2000000-0000-4000-8000-000000000001";
export const RUN = "e9000000-0000-4000-8000-000000000001";
export const CONVERSATION = "e8000000-0000-4000-8000-000000000001";

export const LASER = "e1000000-0000-4000-8000-000000000001";
export const FACIAL = "e1000000-0000-4000-8000-000000000002";
export const MANICURA = "e1000000-0000-4000-8000-000000000003";
export const CABINA_1 = "e3000000-0000-4000-8000-000000000001";
export const CABINA_2 = "e3000000-0000-4000-8000-000000000002";

/** Quien escribe. */
export const ANA = "e4000000-0000-4000-8000-000000000001";
/** Otra clienta del centro: nadie puede ver ni tocar lo suyo desde la conversación de Ana. */
export const LUIS = "e4000000-0000-4000-8000-000000000002";

export const TIMEZONE = "Europe/Madrid";
/** Lunes, 3 de junio de 2030, 9:30 en Madrid. El calendario falso abre de 9:00 a 14:00 UTC (11:00 a 16:00 en Madrid). */
export const NOW = new Date("2030-06-03T07:30:00Z");

export const SERVICES: readonly BookableService[] = [
  { id: FACIAL, name: "Facial hidratante", durationMinutes: 60 },
  { id: LASER, name: "Láser diodo (piernas)", durationMinutes: 30 },
  { id: MANICURA, name: "Manicura", durationMinutes: 45 },
];

export const AGENTS = {
  reception: {
    name: "Recepción",
    // Las de la migración (20261031150000_agent_converse y 20261109090000_waitlist).
    skills: ["find_slots", "list_my_appointments", "book_appointment", "reschedule_appointment", "cancel_appointment", "join_waitlist", "reply"],
  },
  customer: { name: "Atención al cliente", skills: ["reply"] },
} as const;
export type AgentKey = keyof typeof AGENTS;
/** La clave de cada agente de la tabla, para que los casos no la escriban a mano (ADR 0030 §1). */
export const AGENT = Object.fromEntries(Object.keys(AGENTS).map((key) => [key, key])) as { [K in AgentKey]: K };

export const BUSINESS_NAME = "Centro Aurora";
export const LOCATION_NAME = "Chamberí";

const catalog: ReceptionCatalog = {
  describe: ({ serviceId, resourceId }) => {
    const service = SERVICES.find((s) => s.id === serviceId);
    if (!service) return Promise.resolve(null);
    const resource = resourceId === CABINA_1 ? "Cabina 1" : resourceId === CABINA_2 ? "Cabina 2" : null;
    return Promise.resolve({ service: service.name, resource, timezone: TIMEZONE });
  },
};

export interface StoredWaitlistEntry extends WaitlistEntry {
  contactId: string;
  locationId: string;
}

/** Una lista de espera en memoria con las reglas de la de Moodly: idempotente y una entrada viva por contacto, servicio y local. */
export function createFakeWaitlist(): WaitlistStore & { entries: StoredWaitlistEntry[] } {
  const entries: StoredWaitlistEntry[] = [];
  const byKey = new Map<string, StoredWaitlistEntry>();
  return {
    entries,
    join(request) {
      const replay = byKey.get(request.idempotencyKey);
      if (replay) return Promise.resolve({ entry: replay, alreadyWaiting: true });
      const live = entries.find(
        (e) => e.contactId === request.contactId && e.serviceId === request.serviceId && e.locationId === request.locationId && e.status === "waiting",
      );
      if (live) return Promise.resolve({ entry: live, alreadyWaiting: true });
      const entry: StoredWaitlistEntry = {
        id: `wl-${entries.length + 1}`,
        serviceId: request.serviceId,
        wantedFrom: request.wantedFrom,
        wantedUntil: request.wantedUntil,
        status: "waiting",
        contactId: request.contactId,
        locationId: request.locationId,
      };
      entries.push(entry);
      byKey.set(request.idempotencyKey, entry);
      return Promise.resolve({ entry, alreadyWaiting: false });
    },
  };
}

export interface World {
  agent: AgentKey;
  scope: RunScope;
  booking: FakeBookingProvider;
  sender: FakeConversationSender;
  waitlist: ReturnType<typeof createFakeWaitlist>;
  skills: Map<string, SkillDefinition<unknown>>;
  settings: Map<string, SkillSettings>;
  systemPrompt: string;
  /** Lo que preparó el caso (p. ej. el id de la cita de Ana). */
  seeded: Record<string, string>;
}

export function createWorld(agent: AgentKey): World {
  const booking = createFakeBookingProvider({
    services: SERVICES.map((service) => ({ id: service.id, durationMinutes: service.durationMinutes, locationId: null })),
    resources: [
      { id: CABINA_1, locationId: LOCATION, serviceIds: [LASER, FACIAL] },
      { id: CABINA_2, locationId: LOCATION, serviceIds: [MANICURA, FACIAL] },
    ],
    now: () => NOW,
  });
  const sender = createFakeConversationSender();
  const waitlist = createFakeWaitlist();
  const all = [
    ...Object.values(createReceptionSkills({ booking, catalog })),
    createJoinWaitlistSkill({ store: waitlist }),
    createReplySkill({ sender }),
  ] as unknown as SkillDefinition<unknown>[];
  const keys: readonly string[] = AGENTS[agent].skills;
  const mine = all.filter((skill) => keys.includes(skill.key));
  const books = keys.includes("find_slots");
  return {
    agent,
    scope: { organizationId: ORG, locationId: LOCATION, runId: RUN, conversation: { id: CONVERSATION, contactId: ANA } },
    booking,
    sender,
    waitlist,
    skills: new Map(mine.map((skill) => [skill.key, skill])),
    // Como nace el agente: cada skill activa con su autonomía por defecto.
    settings: new Map(mine.map((skill) => [skill.key, { enabled: true, autonomy: skill.defaultAutonomy }])),
    systemPrompt: composeSystemPrompt({
      agentName: AGENTS[agent].name,
      businessName: BUSINESS_NAME,
      locationName: LOCATION_NAME,
      timezone: TIMEZONE,
      now: NOW,
      ...(books ? { services: SERVICES } : {}),
    }),
    seeded: {},
  };
}

/** Una cita ya reservada, directamente en el calendario (no por el agente). */
export async function seedAppointment(world: World, contactId: string, serviceId: string, startsAt: string): Promise<string> {
  const resourceId = serviceId === MANICURA ? CABINA_2 : CABINA_1;
  const appointment = await world.booking.book({
    locationId: LOCATION,
    serviceId,
    resourceId,
    contactId,
    conversationId: null,
    startsAt: new Date(startsAt),
    idempotencyKey: `seed:${contactId}:${startsAt}`,
  });
  return appointment.id;
}
