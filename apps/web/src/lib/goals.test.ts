import { describe, expect, it } from "vitest";
import {
  canManageGoal,
  GOAL_METRIC_KEYS,
  goalMetric,
  goalMetricOptions,
  goalsInScope,
  manageableTargets,
  parseTargetValue,
  targetValue,
  type GoalScopeRef,
} from "./goals";

// Objetivos del negocio (MANUAL §6.3, unidad OA19). Quién gestiona qué es lo
// mismo que dicen las políticas de goals (migración 20261023190000_goals): aquí
// solo se decide qué ofrecer en la pantalla; la barrera sigue siendo RLS.

const ORG = "00000000-0000-4000-8000-0000000000aa";
const NORTE = "00000000-0000-4000-8000-0000000000b1";
const SUR = "00000000-0000-4000-8000-0000000000b2";
const regions = [
  { id: SUR, name: "Sur" },
  { id: NORTE, name: "Norte" },
];
const locations = [
  { id: "l-a1", name: "A1", regionId: NORTE },
  { id: "l-a2", name: "A2", regionId: NORTE },
  { id: "l-s1", name: "S1", regionId: SUR },
  { id: "l-x", name: "Sin región", regionId: null },
];
const organization = { id: ORG, name: "Demo" };

const values = (targets: GoalScopeRef[]) => targets.map((t) => targetValue(t));

describe("manageableTargets", () => {
  it("el org_admin con el segundo factor gestiona toda la organización, cada región y cada local", () => {
    const targets = manageableTargets({ role: "org_admin", aal2: true, organization, regions, locations });
    expect(values(targets)).toEqual([
      `organization:${ORG}`,
      `region:${NORTE}`,
      `region:${SUR}`,
      "location:l-a1",
      "location:l-a2",
      "location:l-s1",
      "location:l-x",
    ]);
  });

  it("el org_admin sin el segundo factor no gestiona nada (RLS pide aal2)", () => {
    expect(manageableTargets({ role: "org_admin", aal2: false, organization, regions, locations })).toEqual([]);
  });

  it("el region_manager gestiona sus regiones y los locales de ellas, no toda la organización", () => {
    const targets = manageableTargets({
      role: "region_manager",
      aal2: false,
      organization,
      regions: [{ id: NORTE, name: "Norte" }],
      locations: locations.filter((l) => l.regionId === NORTE),
    });
    expect(values(targets)).toEqual([`region:${NORTE}`, "location:l-a1", "location:l-a2"]);
  });

  it("el location_manager gestiona sus locales, no su región", () => {
    const targets = manageableTargets({
      role: "location_manager",
      aal2: true,
      organization,
      regions: [{ id: NORTE, name: "Norte" }],
      locations: locations.filter((l) => l.id === "l-a1"),
    });
    expect(values(targets)).toEqual(["location:l-a1"]);
  });

  it("el staff y quien no tiene rol solo leen", () => {
    expect(manageableTargets({ role: "staff", aal2: true, organization, regions, locations })).toEqual([]);
    expect(manageableTargets({ role: null, aal2: true, organization, regions, locations })).toEqual([]);
    expect(manageableTargets({ role: "org_admin", aal2: true, organization: null, regions, locations })).toEqual([]);
  });
});

describe("canManageGoal", () => {
  const targets = manageableTargets({
    role: "region_manager",
    aal2: false,
    organization,
    regions: [{ id: NORTE, name: "Norte" }],
    locations: locations.filter((l) => l.regionId === NORTE),
  });

  it("solo los objetivos de un alcance que la persona gestiona", () => {
    expect(canManageGoal({ scope: "region", scopeId: NORTE }, targets)).toBe(true);
    expect(canManageGoal({ scope: "location", scopeId: "l-a2" }, targets)).toBe(true);
    expect(canManageGoal({ scope: "organization", scopeId: ORG }, targets)).toBe(false);
    expect(canManageGoal({ scope: "location", scopeId: "l-s1" }, targets)).toBe(false);
  });
});

describe("goalsInScope", () => {
  const goals: (GoalScopeRef & { id: string })[] = [
    { id: "org", scope: "organization", scopeId: ORG },
    { id: "norte", scope: "region", scopeId: NORTE },
    { id: "sur", scope: "region", scopeId: SUR },
    { id: "a1", scope: "location", scopeId: "l-a1" },
    { id: "s1", scope: "location", scopeId: "l-s1" },
    { id: "x", scope: "location", scopeId: "l-x" },
  ];
  const ids = (list: { id: string }[]) => list.map((g) => g.id);

  it("con toda la organización, todos los que se ven", () => {
    expect(ids(goalsInScope(goals, { kind: "all" }, locations))).toEqual(["org", "norte", "sur", "a1", "s1", "x"]);
  });

  it("con una región, los de la organización, los de la región y los de sus locales", () => {
    expect(ids(goalsInScope(goals, { kind: "region", regionId: NORTE }, locations))).toEqual(["org", "norte", "a1"]);
  });

  it("con un local, los que se le aplican: organización, su región y el propio local", () => {
    expect(ids(goalsInScope(goals, { kind: "location", locationId: "l-a1" }, locations))).toEqual(["org", "norte", "a1"]);
    expect(ids(goalsInScope(goals, { kind: "location", locationId: "l-x" }, locations))).toEqual(["org", "x"]);
  });
});

describe("goalMetric", () => {
  it("las métricas del catálogo traen su unidad y su sentido por defecto", () => {
    expect(goalMetric("appointments.booked")).toMatchObject({ unit: "count", direction: "at_least", known: true });
    expect(goalMetric("response.first_reply_minutes")).toMatchObject({ unit: "minutes", direction: "at_most", known: true });
  });

  it("una métrica que la app no conoce se enseña con su clave", () => {
    expect(goalMetric("custom.metric")).toMatchObject({ key: "custom.metric", unit: "count", known: false });
  });
});

describe("parseTargetValue", () => {
  it("lee el alcance de un objetivo del valor del formulario", () => {
    expect(parseTargetValue(`region:${NORTE}`)).toEqual({ scope: "region", scopeId: NORTE });
    expect(parseTargetValue(`organization:${ORG}`)).toEqual({ scope: "organization", scopeId: ORG });
  });

  it.each(["", "all", "region:", "planeta:x", `region:${NORTE}:extra`, 42, null])("%j no es un alcance", (value) => {
    expect(parseTargetValue(value)).toBeNull();
  });
});

// Revisión de V10 (#217): cambiar un objetivo con una métrica que la app no
// conoce (la puso la plataforma u otra versión) no puede reescribirla en
// silencio con la primera del catálogo.
describe("goalMetricOptions", () => {
  it("con una métrica del catálogo, el catálogo", () => {
    expect(goalMetricOptions("leads.qualified")).toEqual(GOAL_METRIC_KEYS);
    expect(goalMetricOptions(null)).toEqual(GOAL_METRIC_KEYS);
  });

  it("con una que no conoce, la suya primero y después el catálogo", () => {
    expect(goalMetricOptions("custom.metric")).toEqual(["custom.metric", ...GOAL_METRIC_KEYS]);
  });
});
