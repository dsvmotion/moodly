// Datos del seed de desarrollo y CI (MANUAL §13). Solo datos ficticios:
// dominios .test (reservados, RFC 2606) y contraseñas que genera run.ts en
// cada ejecución. Los ids fijos hacen el seed idempotente (upsert por id).

export type MembershipRole = "org_admin" | "region_manager" | "location_manager" | "staff";

/** Roles del equipo interno (platform_staff). Nunca "staff" a secas: ese es un rol tenant. */
export type PlatformStaffRole = "platform_admin" | "platform_operator";

export interface SeedOrganization {
  id: string;
  name: string;
  vertical: string;
  /** Idioma de la organización (BCP 47). E en inglés para probar que la interfaz sigue a la organización activa (ADR 0041). */
  defaultLocale: string;
}

export interface SeedRegion {
  id: string;
  organizationId: string;
  name: string;
}

export interface SeedLocation {
  id: string;
  organizationId: string;
  regionId: string | null;
  name: string;
  /** Zona horaria IANA; sin ella, la de la base de datos (Europe/Madrid). */
  timezone?: string;
}

export interface SeedUser {
  /** Clave estable para localizar al usuario en tests (no es un secreto). */
  key: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: MembershipRole;
  scopeRegionIds: readonly string[];
  scopeLocationIds: readonly string[];
}

/**
 * Cuenta del equipo interno (ADR 0021, D4: en local y CI se concede por el
 * seed). Cuenta dedicada: sin membership en ninguna organización (D2).
 */
export interface SeedPlatformStaff {
  /** Clave estable para localizar al usuario en tests (no es un secreto). */
  key: string;
  email: string;
  fullName: string;
  role: PlatformStaffRole;
  /** Fecha fija (no now()) para que el seed sea idempotente; null = acceso vigente. */
  revokedAt: string | null;
}

/**
 * Tipo de agente propio de una organización (ADR 0030): el seed crea uno para
 * que los e2e comprueben que la web pinta cualquier agente del catálogo, no
 * solo los de serie. Su clave no puede coincidir con la de uno de serie: las
 * rutas de los agentes van por clave.
 */
export interface SeedCustomAgentType {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string;
  /** Un color de la paleta --agent-* (packages/ui). */
  color: string;
}

const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const ORG_B = "5eed0000-0000-4000-8000-00000000000b";
// C solo la usan el e2e de invitaciones (así puede añadir a alguien sin cambiar
// lo que ven los demás tests, que corren en paralelo contra A y B) y el de un
// agente propio (seedCustomAgentTypes).
const ORG_C = "5eed0000-0000-4000-8000-00000000000c";
// D y E solo las usa el e2e de organización activa: una misma persona es staff
// en las dos (seedExtraMemberships).
const ORG_D = "5eed0000-0000-4000-8000-00000000000d";
const ORG_E = "5eed0000-0000-4000-8000-00000000000e";
// F solo la usan los e2e de volumen de la bandeja y las aprobaciones (M-07): muchas
// conversaciones y aprobaciones en F1 y una en F2, para probar que el filtro de
// local va antes del límite. Aparte, para no cambiar las listas exactas de Demo A.
const ORG_F = "5eed0000-0000-4000-8000-00000000000f";
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";
const LOC_B1 = "5eed0002-0000-4000-8000-0000000000b1";
const LOC_C1 = "5eed0002-0000-4000-8000-0000000000c1";
const LOC_D1 = "5eed0002-0000-4000-8000-0000000000d1";
const LOC_E1 = "5eed0002-0000-4000-8000-0000000000e1";
const LOC_F1 = "5eed0002-0000-4000-8000-0000000000f1";
const LOC_F2 = "5eed0002-0000-4000-8000-0000000000f2";

export const seedOrganizations: readonly SeedOrganization[] = [
  { id: ORG_A, name: "Demo A", vertical: "demo", defaultLocale: "es-ES" },
  { id: ORG_B, name: "Demo B", vertical: "demo", defaultLocale: "es-ES" },
  { id: ORG_C, name: "Demo C", vertical: "demo", defaultLocale: "es-ES" },
  { id: ORG_D, name: "Demo D", vertical: "demo", defaultLocale: "es-ES" },
  { id: ORG_E, name: "Demo E", vertical: "demo", defaultLocale: "en" },
  { id: ORG_F, name: "Demo F", vertical: "demo", defaultLocale: "es-ES" },
];

export const seedRegions: readonly SeedRegion[] = [{ id: REGION_A_NORTE, organizationId: ORG_A, name: "A Norte" }];

export const seedLocations: readonly SeedLocation[] = [
  { id: LOC_A1, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A1 Norte" },
  { id: LOC_A2, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A2 Norte" },
  { id: LOC_A3, organizationId: ORG_A, regionId: null, name: "A3 sin región" },
  { id: LOC_B1, organizationId: ORG_B, regionId: null, name: "B1" },
  { id: LOC_C1, organizationId: ORG_C, regionId: null, name: "C1" },
  { id: LOC_D1, organizationId: ORG_D, regionId: null, name: "D1" },
  { id: LOC_E1, organizationId: ORG_E, regionId: null, name: "E1" },
  { id: LOC_F1, organizationId: ORG_F, regionId: null, name: "F1" },
  // F2 en Canarias: Demo F tiene locales en dos zonas (e2e de M-08).
  { id: LOC_F2, organizationId: ORG_F, regionId: null, name: "F2", timezone: "Atlantic/Canary" },
];

/**
 * Identidades sin organización: pueden entrar pero no ven nada hasta aceptar una
 * invitación (las usan los e2e de invitaciones, de MFA y de agentes). El seed les quita las
 * memberships y los factores de MFA en cada ejecución, para que los tests
 * empiecen siempre igual.
 */
export interface SeedGuest {
  key: string;
  email: string;
  fullName: string;
  /** Sale del seed con un segundo factor (TOTP) verificado. */
  totp?: boolean;
}

export const seedGuests: readonly SeedGuest[] = [
  { key: "guest_no_org", email: "invitado@demo.test", fullName: "Persona invitada" },
  // Solo para el e2e de agentes: nadie la invita, así que siempre está sin organización.
  { key: "guest_alone", email: "sin.organizacion@demo.test", fullName: "Persona sin organización" },
  // Solo para el e2e de MFA: activa y desactiva su segundo factor.
  { key: "guest_mfa", email: "mfa@demo.test", fullName: "Persona sin MFA" },
  // Solo para el e2e del freno de códigos MFA: queda bloqueada al terminar.
  { key: "guest_mfa_throttle", email: "mfa.freno@demo.test", fullName: "Persona con MFA", totp: true },
];

export const seedUsers: readonly SeedUser[] = [
  {
    key: "a_org_admin",
    email: "admin.a@demo.test",
    fullName: "Admin A",
    organizationId: ORG_A,
    role: "org_admin",
    scopeRegionIds: [],
    scopeLocationIds: [],
  },
  {
    key: "a_region_manager",
    email: "region.a@demo.test",
    fullName: "Región A Norte",
    organizationId: ORG_A,
    role: "region_manager",
    scopeRegionIds: [REGION_A_NORTE],
    scopeLocationIds: [],
  },
  {
    key: "a_location_manager",
    email: "local.a1@demo.test",
    fullName: "Encargado A1",
    organizationId: ORG_A,
    role: "location_manager",
    scopeRegionIds: [],
    scopeLocationIds: [LOC_A1],
  },
  {
    key: "a_staff",
    email: "staff.a2@demo.test",
    fullName: "Staff A2",
    organizationId: ORG_A,
    role: "staff",
    scopeRegionIds: [],
    scopeLocationIds: [LOC_A2],
  },
  {
    key: "b_org_admin",
    email: "admin.b@demo.test",
    fullName: "Admin B",
    organizationId: ORG_B,
    role: "org_admin",
    scopeRegionIds: [],
    scopeLocationIds: [],
  },
  {
    key: "de_staff",
    email: "staff.de@demo.test",
    fullName: "Staff D y E",
    organizationId: ORG_D,
    role: "staff",
    scopeRegionIds: [],
    scopeLocationIds: [LOC_D1],
  },
  {
    key: "f_org_admin",
    email: "admin.f@demo.test",
    fullName: "Admin F",
    organizationId: ORG_F,
    role: "org_admin",
    scopeRegionIds: [],
    scopeLocationIds: [],
  },
  {
    key: "c_org_admin",
    email: "admin.c@demo.test",
    fullName: "Admin C",
    organizationId: ORG_C,
    role: "org_admin",
    scopeRegionIds: [],
    scopeLocationIds: [],
  },
];

/**
 * Memberships adicionales de usuarios de seedUsers en otras organizaciones (una
 * persona que trabaja para dos empresas). Las usa el e2e de organización activa.
 */
export interface SeedExtraMembership {
  userKey: string;
  organizationId: string;
  role: MembershipRole;
  scopeRegionIds: readonly string[];
  scopeLocationIds: readonly string[];
}

export const seedExtraMemberships: readonly SeedExtraMembership[] = [
  { userKey: "de_staff", organizationId: ORG_E, role: "staff", scopeRegionIds: [], scopeLocationIds: [LOC_E1] },
];

export const seedCustomAgentTypes: readonly SeedCustomAgentType[] = [
  {
    id: "5eed0003-0000-4000-8000-0000000000c1",
    organizationId: ORG_C,
    key: "events",
    name: "Eventos",
    description: "Prepara presupuestos de eventos y reserva salas.",
    color: "agent-sales",
  },
];

export const seedPlatformStaff: readonly SeedPlatformStaff[] = [
  {
    key: "platform_admin",
    email: "ops.admin@demo.test",
    fullName: "Ops Admin",
    role: "platform_admin",
    revokedAt: null,
  },
  {
    key: "platform_operator",
    email: "ops.operator@demo.test",
    fullName: "Ops Operator",
    role: "platform_operator",
    revokedAt: null,
  },
  {
    key: "platform_revoked",
    email: "ops.revocado@demo.test",
    fullName: "Ops Revocado",
    role: "platform_operator",
    revokedAt: "2026-10-01T00:00:00.000Z",
  },
];

/**
 * Lo que el agente dejó esperando a una persona (paso 4d-3d): aprobaciones fijas
 * para la bandeja de la app y sus e2e. El seed las borra y las vuelve a crear en
 * cada ejecución, porque una aprobación decidida no vuelve a pendiente
 * (guard_approval). Su hash no sale de una entrada real: el worker no las
 * ejecutaría (verifyApproval), y en local no hay worker durante los e2e.
 */
export interface SeedApproval {
  key: string;
  runId: string;
  executionId: string;
  approvalId: string;
  locationId: string;
  skillKey: string;
  effectClass: "external_message" | "internal_write";
  input: Record<string, string>;
  summary: string;
  /** El rol mínimo que la decide (private.can_decide_approval); por defecto, staff. */
  requiredRole?: "staff" | "location_manager";
  /**
   * La conversación de la bandeja de la que salió (seedInboxConversations.key):
   * su run apunta al primer mensaje del cliente (trigger_ref), como los del
   * worker. Para el detalle de la aprobación (OA02).
   */
  conversationKey?: string;
}

export const seedApprovals: readonly SeedApproval[] = [
  {
    key: "a2_reply",
    runId: "5eed0007-0000-4000-8000-0000000000a1",
    executionId: "5eed0008-0000-4000-8000-0000000000a1",
    approvalId: "5eed0009-0000-4000-8000-0000000000a1",
    locationId: LOC_A2,
    skillKey: "reply",
    effectClass: "external_message",
    input: { text: "Hola, tenemos hueco el lunes a las 9:00. ¿Te va bien?" },
    summary: "Responder: «Hola, tenemos hueco el lunes a las 9:00. ¿Te va bien?»",
    conversationKey: "a2_human",
  },
  {
    key: "a2_booking",
    runId: "5eed0007-0000-4000-8000-0000000000a2",
    executionId: "5eed0008-0000-4000-8000-0000000000a2",
    approvalId: "5eed0009-0000-4000-8000-0000000000a2",
    locationId: LOC_A2,
    skillKey: "book_appointment",
    effectClass: "internal_write",
    input: { service_id: "5eed000a-0000-4000-8000-000000000001", starts_at: "2030-06-03T09:00:00+02:00" },
    summary: "Reservar Primera visita el lunes, 3 de junio de 2030, 9:00",
  },
  {
    key: "a1_reply",
    runId: "5eed0007-0000-4000-8000-0000000000a3",
    executionId: "5eed0008-0000-4000-8000-0000000000a3",
    approvalId: "5eed0009-0000-4000-8000-0000000000a3",
    locationId: LOC_A1,
    skillKey: "reply",
    effectClass: "external_message",
    input: { text: "Buenas tardes, le confirmamos la cita del martes." },
    summary: "Responder: «Buenas tardes, le confirmamos la cita del martes.»",
  },
  // Pide un encargado: el staff de A2 la ve (RLS por local) pero no la decide,
  // así que no le cuenta ni sale en su lista (M-02); el region_manager de A
  // Norte, sí.
  {
    key: "a2_manager",
    runId: "5eed0007-0000-4000-8000-0000000000a4",
    executionId: "5eed0008-0000-4000-8000-0000000000a4",
    approvalId: "5eed0009-0000-4000-8000-0000000000a4",
    locationId: LOC_A2,
    skillKey: "reply",
    effectClass: "external_message",
    input: { text: "Le enviamos el presupuesto que nos pidió." },
    summary: "Responder: «Le enviamos el presupuesto que nos pidió.»",
    requiredRole: "location_manager",
  },
];

/** La organización de las aprobaciones del seed. */
export const SEED_APPROVALS_ORG = ORG_A;

/**
 * La bandeja de conversaciones (`/app/inbox`, V2): conversaciones de Demo A con
 * ids fijos, para que los e2e las abran por su id. Una abierta en A1 que lleva
 * el agente, una en A2 que lleva el equipo (con un aviso del sistema y un
 * mensaje que no se pudo enviar), una cerrada en A1, una de toda la
 * organización (solo la ve el org_admin) y una del chat de pruebas en A1, que
 * la bandeja nunca enseña. Y una en C1 que lleva el agente, solo para los e2e
 * que toman el control, escriben y la devuelven (en otra organización, para no
 * cambiar lo que ven los de solo lectura). Los mensajes van con minutos de antigüedad respecto
 * a la ejecución del seed: el orden de la bandeja es el de su último mensaje.
 */
export type SeedInboxChannel = "whatsapp" | "webchat" | "email" | "test";

export interface SeedInboxMessage {
  author: "contact" | "agent" | "user" | "system";
  content: string;
  status?: "received" | "sent" | "failed";
  minutesAgo: number;
}

export interface SeedInboxConversation {
  key: string;
  id: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  locationId: string | null;
  channel: SeedInboxChannel;
  mode: "agent" | "human" | "closed";
  messages: readonly SeedInboxMessage[];
}

export const seedInboxConversations: readonly SeedInboxConversation[] = [
  {
    key: "a1_open",
    id: "5eed000b-0000-4000-8000-0000000000b1",
    organizationId: ORG_A,
    contactId: "5eed000c-0000-4000-8000-0000000000c1",
    contactName: "Lucía Martín",
    locationId: LOC_A1,
    channel: "whatsapp",
    mode: "agent",
    messages: [
      { author: "contact", content: "Hola, ¿tenéis hueco mañana por la tarde para un tratamiento facial?", minutesAgo: 20 },
      {
        author: "agent",
        content:
          "Hola Lucía, soy el asistente de IA del centro. Mañana tengo libre a las 17:00 y a las 18:30. ¿Te viene bien alguna?",
        status: "sent",
        minutesAgo: 19,
      },
      { author: "contact", content: "A las 18:30 perfecto", minutesAgo: 5 },
    ],
  },
  {
    key: "a2_human",
    id: "5eed000b-0000-4000-8000-0000000000b2",
    organizationId: ORG_A,
    contactId: "5eed000c-0000-4000-8000-0000000000c2",
    contactName: "Jorge Pérez",
    locationId: LOC_A2,
    channel: "webchat",
    mode: "human",
    messages: [
      { author: "contact", content: "Quiero hablar con una persona, por favor.", minutesAgo: 120 },
      {
        author: "system",
        content: "El equipo ha tomado el control. El agente queda en pausa en esta conversación.",
        status: "sent",
        minutesAgo: 110,
      },
      { author: "user", content: "Hola Jorge, soy del equipo del centro A2. Cuéntame.", status: "sent", minutesAgo: 100 },
      { author: "user", content: "Te he enviado el presupuesto por email.", status: "failed", minutesAgo: 90 },
    ],
  },
  {
    key: "a1_closed",
    id: "5eed000b-0000-4000-8000-0000000000b3",
    organizationId: ORG_A,
    contactId: "5eed000c-0000-4000-8000-0000000000c3",
    contactName: "Marta Ruiz",
    locationId: LOC_A1,
    channel: "whatsapp",
    mode: "closed",
    messages: [{ author: "contact", content: "Gracias, todo claro.", minutesAgo: 3 * 24 * 60 }],
  },
  {
    key: "org_wide",
    id: "5eed000b-0000-4000-8000-0000000000b4",
    organizationId: ORG_A,
    contactId: "5eed000c-0000-4000-8000-0000000000c4",
    contactName: "Empresa Sol",
    locationId: null,
    channel: "email",
    mode: "agent",
    messages: [{ author: "contact", content: "Buenos días, ¿hacéis precios para empresas?", minutesAgo: 60 }],
  },
  {
    key: "a1_test_chat",
    id: "5eed000b-0000-4000-8000-0000000000b5",
    organizationId: ORG_A,
    contactId: "5eed000c-0000-4000-8000-0000000000c5",
    contactName: "Prueba interna",
    locationId: LOC_A1,
    channel: "test",
    mode: "agent",
    messages: [{ author: "contact", content: "Mensaje del chat de pruebas", minutesAgo: 1 }],
  },
  {
    key: "c1_takeover",
    id: "5eed000b-0000-4000-8000-0000000000b6",
    organizationId: ORG_C,
    contactId: "5eed000c-0000-4000-8000-0000000000c6",
    contactName: "Sara Gil",
    locationId: LOC_C1,
    channel: "webchat",
    mode: "agent",
    messages: [
      { author: "contact", content: "Hola, ¿puedo cambiar mi cita del jueves?", minutesAgo: 30 },
      {
        author: "agent",
        content: "Hola Sara, soy el asistente de IA del centro. Claro, ¿qué día te viene mejor?",
        status: "sent",
        minutesAgo: 29,
      },
    ],
  },
];

/**
 * Volumen para los e2e de M-07 (el filtro de local va en la consulta, antes del
 * límite, en la bandeja y en las aprobaciones). Todo en Demo F, con ids fijos:
 * - en F1, más de 100 conversaciones abiertas (las lleva el agente) con su último
 *   mensaje más reciente que el de F2, y más de 100 cerradas sin mensajes;
 * - en F2, una conversación que lleva el equipo, con un contacto de nombre fijo;
 * - en F1, más de 200 aprobaciones pendientes, y en F2 una, que se crea después
 *   (otra inserción): es la más reciente.
 */
const volumeId = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export const SEED_VOLUME = {
  organizationId: ORG_F,
  userKey: "f_org_admin",
  f1: LOC_F1,
  f2: LOC_F2,
  openInF1: 105,
  closedInF1: 105,
  pendingInF1: 205,
  f2Conversation: { id: volumeId("5eed00f1", 0), contactId: volumeId("5eed00f2", 0), contactName: "Contacto de F2" },
  f2Approval: {
    runId: volumeId("5eed00f3", 0),
    executionId: volumeId("5eed00f4", 0),
    approvalId: volumeId("5eed00f5", 0),
    text: "Mensaje pendiente en F2",
    reason: "Responder: «Mensaje pendiente en F2»",
  },
  /** La conversación n de F1 (n empieza en 1): las abiertas primero, después las cerradas. */
  f1Conversation: (n: number) => ({ id: volumeId("5eed00f1", n), contactId: volumeId("5eed00f2", n) }),
  /** La aprobación n de F1 (n empieza en 1). */
  f1Approval: (n: number) => ({ runId: volumeId("5eed00f3", n), executionId: volumeId("5eed00f4", n), approvalId: volumeId("5eed00f5", n) }),
} as const;

