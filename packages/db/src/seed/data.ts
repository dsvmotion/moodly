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

const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const ORG_B = "5eed0000-0000-4000-8000-00000000000b";
// C solo la usa el e2e de invitaciones: así puede añadir a alguien sin cambiar lo
// que ven los demás tests, que corren en paralelo contra A y B.
const ORG_C = "5eed0000-0000-4000-8000-00000000000c";
// D y E solo las usa el e2e de organización activa: una misma persona es staff
// en las dos (seedExtraMemberships).
const ORG_D = "5eed0000-0000-4000-8000-00000000000d";
const ORG_E = "5eed0000-0000-4000-8000-00000000000e";
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";
const LOC_B1 = "5eed0002-0000-4000-8000-0000000000b1";
const LOC_C1 = "5eed0002-0000-4000-8000-0000000000c1";
const LOC_D1 = "5eed0002-0000-4000-8000-0000000000d1";
const LOC_E1 = "5eed0002-0000-4000-8000-0000000000e1";

export const seedOrganizations: readonly SeedOrganization[] = [
  { id: ORG_A, name: "Demo A", vertical: "demo" },
  { id: ORG_B, name: "Demo B", vertical: "demo" },
  { id: ORG_C, name: "Demo C", vertical: "demo" },
  { id: ORG_D, name: "Demo D", vertical: "demo" },
  { id: ORG_E, name: "Demo E", vertical: "demo" },
];

export const seedRegions: readonly SeedRegion[] = [
  { id: REGION_A_NORTE, organizationId: ORG_A, name: "A Norte" },
];

export const seedLocations: readonly SeedLocation[] = [
  { id: LOC_A1, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A1 Norte" },
  { id: LOC_A2, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A2 Norte" },
  { id: LOC_A3, organizationId: ORG_A, regionId: null, name: "A3 sin región" },
  { id: LOC_B1, organizationId: ORG_B, regionId: null, name: "B1" },
  { id: LOC_C1, organizationId: ORG_C, regionId: null, name: "C1" },
  { id: LOC_D1, organizationId: ORG_D, regionId: null, name: "D1" },
  { id: LOC_E1, organizationId: ORG_E, regionId: null, name: "E1" },
];

/**
 * Identidades sin organización: pueden entrar pero no ven nada hasta aceptar una
 * invitación (las usan los e2e de invitaciones y de MFA). El seed les quita las
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
