// Datos del seed de desarrollo y CI (MANUAL §13). Solo datos ficticios:
// dominios .test (reservados, RFC 2606) y contraseñas que genera run.ts en
// cada ejecución. Los ids fijos hacen el seed idempotente (upsert por id).

export type MembershipRole = "org_admin" | "region_manager" | "location_manager" | "staff";

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

const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const ORG_B = "5eed0000-0000-4000-8000-00000000000b";
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";
const LOC_B1 = "5eed0002-0000-4000-8000-0000000000b1";

export const seedOrganizations: readonly SeedOrganization[] = [
  { id: ORG_A, name: "Demo A", vertical: "demo" },
  { id: ORG_B, name: "Demo B", vertical: "demo" },
];

export const seedRegions: readonly SeedRegion[] = [
  { id: REGION_A_NORTE, organizationId: ORG_A, name: "A Norte" },
];

export const seedLocations: readonly SeedLocation[] = [
  { id: LOC_A1, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A1 Norte" },
  { id: LOC_A2, organizationId: ORG_A, regionId: REGION_A_NORTE, name: "A2 Norte" },
  { id: LOC_A3, organizationId: ORG_A, regionId: null, name: "A3 sin región" },
  { id: LOC_B1, organizationId: ORG_B, regionId: null, name: "B1" },
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
];
