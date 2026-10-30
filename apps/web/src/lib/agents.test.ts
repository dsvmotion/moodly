import { describe, expect, it } from "vitest";
import { AGENT_TYPES } from "@repo/config";
import { agentDotClass, sortAgentRows, toAgentView, type AgentRow } from "./agents";

// Ids fijos de los 4 de serie (20261023150000_agent_catalog.sql), en el orden de AGENT_TYPES.
const BUILTIN_IDS = [
  "0a9e0000-0000-4000-8000-000000000001",
  "0a9e0000-0000-4000-8000-000000000002",
  "0a9e0000-0000-4000-8000-000000000003",
  "0a9e0000-0000-4000-8000-000000000004",
];

function builtinId(index: number): string {
  const id = BUILTIN_IDS[index];
  if (!id) throw new Error(`No hay id de serie en la posición ${index}`);
  return id;
}

function row(overrides: Partial<AgentRow>): AgentRow {
  return {
    key: "reception",
    origin: "builtin",
    typeId: builtinId(0),
    name: "Recepción",
    description: "Agenda y citas.",
    color: "agent-reception",
    status: "draft",
    displayName: null,
    ...overrides,
  };
}

const builtins = AGENT_TYPES.map((type, i) =>
  row({ key: type.key, typeId: builtinId(i), name: type.name, color: type.color }),
);

describe("agentes desde el catálogo", () => {
  it("los de serie salen en el orden de AGENT_TYPES aunque lleguen desordenados", () => {
    const shuffled = [2, 0, 3, 1].flatMap((i) => builtins.slice(i, i + 1));
    expect(sortAgentRows(shuffled).map((agent) => agent.key)).toEqual(AGENT_TYPES.map((type) => type.key));
  });

  it("después de los de serie, los de plantilla y los propios, por nombre", () => {
    const custom = [
      row({ key: "events", origin: "custom", typeId: "ffff0000-0000-4000-8000-000000000000", name: "Eventos" }),
      row({ key: "bookings", origin: "custom", typeId: "00000000-0000-4000-8000-000000000000", name: "Banquetes" }),
    ];
    const template = row({ key: "reviews", origin: "template", typeId: "11110000-0000-4000-8000-000000000000", name: "Reseñas" });
    expect(sortAgentRows([...custom, template, ...builtins]).map((agent) => agent.key)).toEqual([
      ...AGENT_TYPES.map((type) => type.key),
      "reviews",
      "bookings",
      "events",
    ]);
  });

  it("pinta cualquier agente con sus datos: ruta por clave, color y estado", () => {
    const view = toAgentView(row({ key: "events", origin: "custom", name: "Eventos", color: "agent-sales", status: "live" }));
    expect(view).toEqual({
      key: "events",
      href: "/app/agents/events",
      label: "Eventos",
      description: "Agenda y citas.",
      dotClass: "bg-agent-sales",
      status: "live",
    });
  });

  it("el nombre que da la organización manda; si no, el traducido; si no, el del catálogo", () => {
    expect(toAgentView(row({ displayName: "Mostrador" }), { label: "Reception" }).label).toBe("Mostrador");
    expect(toAgentView(row({}), { label: "Reception" }).label).toBe("Reception");
    expect(toAgentView(row({})).label).toBe("Recepción");
    expect(toAgentView(row({}), { description: "Scheduling." }).description).toBe("Scheduling.");
  });

  it("cada color de la paleta tiene su clase, escrita entera; un color desconocido no rompe nada", () => {
    for (const type of AGENT_TYPES) expect(agentDotClass(type.color)).toBe(`bg-${type.color}`);
    for (const color of ["agent-unknown", "", "__proto__", "constructor"]) expect(agentDotClass(color)).toBe("bg-muted-foreground");
  });
});
