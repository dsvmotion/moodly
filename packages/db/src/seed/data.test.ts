import { describe, expect, it } from "vitest";
import {
  SEED_INBOX_ORG,
  seedCustomAgentTypes,
  seedExtraMemberships,
  seedGuests,
  seedInboxConversations,
  seedLocations,
  seedOrganizations,
  seedPlatformStaff,
  seedRegions,
  seedUsers,
} from "./data.ts";

// Las mismas reglas que impone la base de datos (CHECK de rol ↔ alcance,
// trigger validate_scope, FK compuesta de locations): si el seed las rompe,
// se detecta aquí antes de llegar a Postgres.
describe("seed", () => {
  const orgIds = new Set(seedOrganizations.map((o) => o.id));

  it("cumple el alcance pedido: A con 1 región y 3 locales (2 en la región), B con 1 local", () => {
    const [orgA, orgB] = seedOrganizations;
    expect(seedRegions.filter((r) => r.organizationId === orgA?.id)).toHaveLength(1);
    const locationsA = seedLocations.filter((l) => l.organizationId === orgA?.id);
    expect(locationsA).toHaveLength(3);
    expect(locationsA.filter((l) => l.regionId !== null)).toHaveLength(2);
    expect(seedLocations.filter((l) => l.organizationId === orgB?.id)).toHaveLength(1);
  });

  it("A tiene un usuario de cada rol y B su org_admin", () => {
    const [orgA, orgB] = seedOrganizations;
    const rolesA = seedUsers.filter((u) => u.organizationId === orgA?.id).map((u) => u.role).sort();
    expect(rolesA).toEqual(["location_manager", "org_admin", "region_manager", "staff"]);
    expect(seedUsers.filter((u) => u.organizationId === orgB?.id).map((u) => u.role)).toEqual(["org_admin"]);
  });

  it("regiones y locales cuelgan de una organización existente y de una región de la misma organización", () => {
    for (const region of seedRegions) expect(orgIds).toContain(region.organizationId);
    for (const location of seedLocations) {
      expect(orgIds).toContain(location.organizationId);
      if (location.regionId !== null) {
        const region = seedRegions.find((r) => r.id === location.regionId);
        expect(region?.organizationId).toBe(location.organizationId);
      }
    }
  });

  it("el alcance de cada usuario es coherente con su rol y apunta a su organización", () => {
    for (const user of seedUsers) {
      const regions = user.scopeRegionIds.map((id) => seedRegions.find((r) => r.id === id));
      const locations = user.scopeLocationIds.map((id) => seedLocations.find((l) => l.id === id));
      for (const r of regions) expect(r?.organizationId).toBe(user.organizationId);
      for (const l of locations) expect(l?.organizationId).toBe(user.organizationId);

      if (user.role === "org_admin") expect([regions.length, locations.length]).toEqual([0, 0]);
      if (user.role === "region_manager") expect(regions.length > 0 && locations.length === 0).toBe(true);
      if (user.role === "location_manager" || user.role === "staff") {
        expect(regions.length === 0 && locations.length > 0).toBe(true);
      }
    }
  });

  it("las memberships adicionales son de usuarios del seed, en otra organización y con alcance coherente", () => {
    for (const extra of seedExtraMemberships) {
      const user = seedUsers.find((u) => u.key === extra.userKey);
      expect(user).toBeDefined();
      expect(orgIds).toContain(extra.organizationId);
      expect(extra.organizationId).not.toBe(user?.organizationId);
      for (const id of extra.scopeLocationIds) expect(seedLocations.find((l) => l.id === id)?.organizationId).toBe(extra.organizationId);
      for (const id of extra.scopeRegionIds) expect(seedRegions.find((r) => r.id === id)?.organizationId).toBe(extra.organizationId);
      if (extra.role === "org_admin") expect([extra.scopeRegionIds.length, extra.scopeLocationIds.length]).toEqual([0, 0]);
      if (extra.role === "staff" || extra.role === "location_manager") expect(extra.scopeLocationIds.length).toBeGreaterThan(0);
    }
    // Una membership por organización y usuario (unique en la base de datos).
    const pairs = [...seedUsers.map((u) => `${u.key}:${u.organizationId}`), ...seedExtraMemberships.map((m) => `${m.userKey}:${m.organizationId}`)];
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("solo usa emails de dominios reservados para pruebas y claves únicas", () => {
    for (const user of seedUsers) expect(user.email).toMatch(/@[a-z0-9.-]+\.test$/);
    expect(new Set(seedUsers.map((u) => u.key)).size).toBe(seedUsers.length);
    expect(new Set(seedUsers.map((u) => u.email)).size).toBe(seedUsers.length);
  });

  it("las identidades sin organización tampoco repiten clave ni email con nadie", () => {
    const everyone = [...seedUsers, ...seedGuests];
    for (const guest of seedGuests) expect(guest.email).toMatch(/@[a-z0-9.-]+\.test$/);
    expect(new Set(everyone.map((u) => u.key)).size).toBe(everyone.length);
    expect(new Set(everyone.map((u) => u.email)).size).toBe(everyone.length);
  });

  it("equipo interno: un platform_admin y un platform_operator vigentes y un interno revocado", () => {
    const active = seedPlatformStaff.filter((s) => s.revokedAt === null).map((s) => s.role).sort();
    expect(active).toEqual(["platform_admin", "platform_operator"]);
    expect(seedPlatformStaff.filter((s) => s.revokedAt !== null)).toHaveLength(1);
  });

  it("equipo interno: cuentas dedicadas (D2), emails reservados y claves únicas entre todos los usuarios", () => {
    for (const staff of seedPlatformStaff) expect(staff.email).toMatch(/@[a-z0-9.-]+\.test$/);
    const all = [...seedUsers, ...seedGuests, ...seedPlatformStaff];
    expect(new Set(all.map((u) => u.key)).size).toBe(all.length);
    expect(new Set(all.map((u) => u.email)).size).toBe(all.length);
  });

  it("agentes propios: de una organización del seed, con clave y color válidos y sin pisar a uno de serie", () => {
    // Las claves y colores de los de serie (20261023150000_agent_catalog).
    const builtinKeys = ["reception", "customer", "sales", "admin"];
    expect(seedCustomAgentTypes.length).toBeGreaterThan(0);
    for (const type of seedCustomAgentTypes) {
      expect(orgIds.has(type.organizationId)).toBe(true);
      expect(type.key).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
      expect(builtinKeys).not.toContain(type.key);
      expect(type.color).toMatch(/^agent-(reception|customer|sales|admin)$/);
    }
    expect(new Set(seedCustomAgentTypes.map((t) => t.id)).size).toBe(seedCustomAgentTypes.length);
  });

  it("bandeja: ids únicos, locales de su organización, cada modo, una de toda la organización y una del chat de pruebas", () => {
    const conversations = seedInboxConversations;
    expect(new Set(conversations.map((c) => c.id)).size).toBe(conversations.length);
    expect(new Set(conversations.map((c) => c.contactId)).size).toBe(conversations.length);
    for (const conversation of conversations) {
      if (conversation.locationId !== null) {
        expect(seedLocations.find((l) => l.id === conversation.locationId)?.organizationId).toBe(SEED_INBOX_ORG);
      }
      expect(conversation.messages.length).toBeGreaterThan(0);
      for (const message of conversation.messages) {
        expect(message.content.length).toBeGreaterThan(0);
        expect(message.content.length).toBeLessThanOrEqual(10_000);
        expect(message.minutesAgo).toBeGreaterThan(0);
      }
    }
    expect(new Set(conversations.map((c) => c.mode))).toEqual(new Set(["agent", "human", "closed"]));
    expect(conversations.some((c) => c.locationId === null)).toBe(true);
    expect(conversations.some((c) => c.channel === "test")).toBe(true);
  });
});
