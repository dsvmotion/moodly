import { describe, expect, it } from "vitest";
import {
  locationsInScope,
  membershipInScope,
  parseScope,
  scopeOptions,
  withScope,
  type VisibleLocation,
  type VisibleRegion,
} from "./scope";

const labels = { organization: "Toda la organización", mine: "Todos mis locales" };
const regions: VisibleRegion[] = [{ id: "rn", name: "A Norte" }];
const locations: VisibleLocation[] = [
  { id: "l2", name: "A2 Norte", regionId: "rn" },
  { id: "l1", name: "A1 Norte", regionId: "rn" },
  { id: "l3", name: "A3 sin región", regionId: null },
];

describe("scopeOptions", () => {
  it("org_admin: toda la organización, sus regiones y sus locales (ordenados)", () => {
    expect(scopeOptions("org_admin", regions, locations, labels)).toEqual([
      { value: "all", label: "Toda la organización", kind: "all" },
      { value: "region:rn", label: "A Norte", kind: "region" },
      { value: "location:l1", label: "A1 Norte", kind: "location" },
      { value: "location:l2", label: "A2 Norte", kind: "location" },
      { value: "location:l3", label: "A3 sin región", kind: "location" },
    ]);
  });

  it("region_manager: 'todos mis locales', su región y sus locales", () => {
    const options = scopeOptions("region_manager", regions, locations.slice(0, 2), labels);
    expect(options.map((o) => o.value)).toEqual(["all", "region:rn", "location:l1", "location:l2"]);
    expect(options[0]?.label).toBe("Todos mis locales");
  });

  it("location_manager y staff: sin regiones aunque RLS les deje ver la de su local", () => {
    expect(scopeOptions("location_manager", regions, locations.filter((l) => l.id === "l1"), labels).map((o) => o.value)).toEqual([
      "all",
      "location:l1",
    ]);
    expect(scopeOptions("staff", regions, locations.filter((l) => l.id === "l2"), labels).map((o) => o.value)).toEqual(["all", "location:l2"]);
  });
});

describe("parseScope", () => {
  const options = scopeOptions("org_admin", regions, locations, labels);

  it("acepta solo valores ofrecidos", () => {
    expect(parseScope("region:rn", options)).toEqual({ kind: "region", regionId: "rn" });
    expect(parseScope("location:l3", options)).toEqual({ kind: "location", locationId: "l3" });
  });

  it.each([undefined, "", "all", "location:otro-local", "region:ajena", "location:", "basura", ["location:l1"]])(
    "%j → toda la vista",
    (value) => {
      expect(parseScope(value, options)).toEqual({ kind: "all" });
    },
  );
});

describe("filtros", () => {
  it("locales por región, por local o todos", () => {
    expect(locationsInScope({ kind: "region", regionId: "rn" }, locations).map((l) => l.id)).toEqual(["l2", "l1"]);
    expect(locationsInScope({ kind: "location", locationId: "l3" }, locations).map((l) => l.id)).toEqual(["l3"]);
    expect(locationsInScope({ kind: "all" }, locations)).toHaveLength(3);
  });

  const admin = { role: "org_admin", scopeRegionIds: [], scopeLocationIds: [] };
  const regionManager = { role: "region_manager", scopeRegionIds: ["rn"], scopeLocationIds: [] };
  const managerA1 = { role: "location_manager", scopeRegionIds: [], scopeLocationIds: ["l1"] };
  const staffA2 = { role: "staff", scopeRegionIds: [], scopeLocationIds: ["l2"] };

  it("personas con acceso a un local: admin, manager de su región y quien trabaja en él", () => {
    const scope = { kind: "location" as const, locationId: "l1" };
    expect([admin, regionManager, managerA1, staffA2].map((m) => membershipInScope(m, scope, locations))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("personas con acceso a una región", () => {
    const scope = { kind: "region" as const, regionId: "rn" };
    expect([admin, regionManager, managerA1, staffA2].map((m) => membershipInScope(m, scope, locations))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("un local sin región: nadie por región", () => {
    const scope = { kind: "location" as const, locationId: "l3" };
    expect([admin, regionManager, managerA1].map((m) => membershipInScope(m, scope, locations))).toEqual([true, false, false]);
  });
});

describe("withScope", () => {
  it("añade, sustituye y quita ?scope= conservando otros parámetros", () => {
    expect(withScope("/app/conversaciones", "location:l1")).toBe("/app/conversaciones?scope=location%3Al1");
    expect(withScope("/app/conversaciones?view=kanban&scope=all", "region:rn")).toBe("/app/conversaciones?view=kanban&scope=region%3Arn");
    expect(withScope("/app/conversaciones?scope=location%3Al1", "all")).toBe("/app/conversaciones");
    expect(withScope("/app/conversaciones?view=kanban", null)).toBe("/app/conversaciones?view=kanban");
  });
});
