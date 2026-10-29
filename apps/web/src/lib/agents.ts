// Agentes de una organización tal como los pinta la web (ADR 0030 §1): a partir
// de sus datos (nombre, color y descripción), sin suponer cuántos hay ni hacer
// lógica sobre su clave. Los datos llegan del catálogo (agent_types y agents,
// fase D1) con RLS; esto solo los ordena y les da forma.

const AGENT_STATUSES = ["draft", "testing", "live", "paused"] as const;
const AGENT_ORIGINS = ["builtin", "template", "custom"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentOrigin = (typeof AGENT_ORIGINS)[number];

// La base de datos ya los restringe (CHECK); esto lo comprueba al leer para que
// TypeScript no tenga que fiarse.
export function isAgentStatus(value: string): value is AgentStatus {
  return (AGENT_STATUSES as readonly string[]).includes(value);
}
export function isAgentOrigin(value: string): value is AgentOrigin {
  return (AGENT_ORIGINS as readonly string[]).includes(value);
}

export interface AgentRow {
  key: string;
  origin: AgentOrigin;
  /** Id del tipo: los de serie tienen ids fijos que siguen el orden de la semilla de @repo/config. */
  typeId: string;
  name: string;
  description: string;
  color: string;
  status: AgentStatus;
  displayName: string | null;
}

export interface AgentView {
  key: string;
  href: string;
  label: string;
  description: string;
  /** Clase de fondo con el color del agente. */
  dotClass: string;
  status: AgentStatus;
}

/** Textos traducidos de un agente, si los hay (los de serie se traducen por clave). */
export interface AgentTexts {
  label?: string | undefined;
  description?: string | undefined;
}

// Clases literales de la paleta --agent-* (packages/ui): Tailwind solo genera
// las clases que ve escritas enteras en el código. La clave es el color del
// tipo (agent_types.color), no el agente: un agente propio elige color de esta
// misma paleta.
const AGENT_COLOR_CLASS: ReadonlyMap<string, string> = new Map([
  ["agent-reception", "bg-agent-reception"],
  ["agent-customer", "bg-agent-customer"],
  ["agent-sales", "bg-agent-sales"],
  ["agent-admin", "bg-agent-admin"],
]);
const FALLBACK_COLOR_CLASS = "bg-muted-foreground";

export function agentDotClass(color: string): string {
  return AGENT_COLOR_CLASS.get(color) ?? FALLBACK_COLOR_CLASS;
}

const ORIGIN_ORDER: Readonly<Record<AgentOrigin, number>> = { builtin: 0, template: 1, custom: 2 };

/** De serie primero (en su orden), después los de plantilla y los propios, por nombre. */
export function sortAgentRows(rows: readonly AgentRow[]): AgentRow[] {
  return [...rows].sort(
    (a, b) =>
      ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin] ||
      (a.origin === "builtin" ? a.typeId.localeCompare(b.typeId) : a.name.localeCompare(b.name, "es")),
  );
}

/**
 * Lo que pinta la web de un agente: el nombre que le haya dado la organización,
 * o el traducido, o el del catálogo; la descripción traducida o la del catálogo.
 */
export function toAgentView(row: AgentRow, texts: AgentTexts = {}): AgentView {
  return {
    key: row.key,
    href: `/app/agents/${row.key}`,
    label: row.displayName ?? texts.label ?? row.name,
    description: texts.description ?? row.description,
    dotClass: agentDotClass(row.color),
    status: row.status,
  };
}
