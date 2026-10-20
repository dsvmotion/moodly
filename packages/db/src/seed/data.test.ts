import { describe, expect, it } from "vitest";
import { seedGuests, seedLocations, seedOrganizations, seedRegions, seedUsers } from "./data.ts";

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
});
