// Navegación de la app (MANUAL §9.2 y §9.4). Fuente única para la barra
// lateral, las migas y la paleta de comandos. Las rutas son las canónicas del
// ADR 0023: en español e identificadores estables (no se traducen con el
// idioma de la interfaz). Las etiquetas viven en messages/*.json
// (nav.<key>); aquí solo claves, rutas e iconos.
import { AGENT_TYPES, type AgentTypeKey } from "@repo/config";
import {
  ActivityIcon,
  BarChart3Icon,
  BookOpenIcon,
  BrainIcon,
  CheckSquareIcon,
  ContactIcon,
  HomeIcon,
  InboxIcon,
  SettingsIcon,
  SparklesIcon,
  StampIcon,
  TargetIcon,
  type LucideIcon,
} from "@repo/ui/lib/icons";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export const MAIN_NAV: readonly NavItem[] = [
  { key: "home", href: "/app", icon: HomeIcon },
  { key: "coach", href: "/app/coach", icon: SparklesIcon },
  { key: "approvals", href: "/app/aprobaciones", icon: StampIcon },
  { key: "inbox", href: "/app/conversaciones", icon: InboxIcon },
  { key: "tasks", href: "/app/tareas", icon: CheckSquareIcon },
  { key: "activity", href: "/app/actividad", icon: ActivityIcon },
  { key: "analytics", href: "/app/informes", icon: BarChart3Icon },
];

/** Objetos de negocio (§9.5). Locales y personas son estructura de la organización: van en Ajustes. */
export const RECORDS_NAV: readonly NavItem[] = [
  { key: "contacts", href: "/app/clientes", icon: ContactIcon },
  { key: "goals", href: "/app/objetivos", icon: TargetIcon },
  { key: "knowledge", href: "/app/conocimiento", icon: BookOpenIcon },
  { key: "memory", href: "/app/memoria", icon: BrainIcon },
];

// Clases literales del token --agent-* de cada agente: Tailwind solo genera las
// clases que ve escritas enteras en el código.
const AGENT_DOT: Record<AgentTypeKey, string> = {
  reception: "bg-agent-reception",
  customer: "bg-agent-customer",
  sales: "bg-agent-sales",
  admin: "bg-agent-admin",
};

export interface AgentNavItem {
  key: AgentTypeKey;
  href: string;
  /** Clase de fondo con el color del agente. */
  dotClass: string;
}

/** Los 4 agentes de serie (ADR 0023, `AGENT_TYPES`), cada uno con su ventana (P5). */
export const AGENTS_NAV: readonly AgentNavItem[] = AGENT_TYPES.map((agent) => ({
  key: agent.key,
  href: `/app/agentes/${agent.key}`,
  dotClass: AGENT_DOT[agent.key],
}));

export const SETTINGS_ROOT = "/app/ajustes";
export const SETTINGS_NAV: NavItem = { key: "settings", href: `${SETTINGS_ROOT}/general`, icon: SettingsIcon };

/** Secciones de Ajustes con datos reales hoy (etiquetas en settingsTabs.<key>). */
export const SETTINGS_SECTIONS = [
  { key: "organization", href: `${SETTINGS_ROOT}/general` },
  { key: "team", href: `${SETTINGS_ROOT}/equipo` },
  { key: "locations", href: `${SETTINGS_ROOT}/sedes` },
  { key: "security", href: `${SETTINGS_ROOT}/seguridad` },
] as const;

export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]["key"];

/** ¿Es una clave de agente de serie? Para validar `/app/agentes/[tipo]`. */
export function isAgentKey(value: string): value is AgentTypeKey {
  return AGENT_TYPES.some((agent) => agent.key === value);
}

/** ¿La ruta actual corresponde a esta entrada? /app solo coincide exacto. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href.startsWith(SETTINGS_ROOT)) return pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`);
  return pathname === href || pathname.startsWith(`${href}/`);
}
