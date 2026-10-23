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
  BotIcon,
  BrainIcon,
  Building2Icon,
  CheckSquareIcon,
  ContactIcon,
  CreditCardIcon,
  HomeIcon,
  InboxIcon,
  KeyRoundIcon,
  LockIcon,
  PlugIcon,
  ReceiptIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StampIcon,
  StoreIcon,
  TargetIcon,
  UserIcon,
  UsersIcon,
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
/** Entrada «Ajustes» de la barra lateral: /app/ajustes abre General y queda activa en todas las secciones. */
export const SETTINGS_NAV: NavItem = { key: "settings", href: SETTINGS_ROOT, icon: SettingsIcon };

// Ajustes (P6, MANUAL §9.4): área propia con navegación secundaria agrupada,
// como el prototipo. Etiquetas en settings.groups.<grupo> y
// settings.sections.<sección>. `ready: false` = aún sin contenido: la página
// dice qué habrá y con qué llega (settings.pending.<sección>).
const SETTINGS_GROUP_DEFS = [
  {
    key: "personal",
    sections: [
      { key: "profile", slug: "perfil", icon: UserIcon, ready: true },
      { key: "preferences", slug: "preferencias", icon: SlidersHorizontalIcon, ready: true },
      { key: "privacy", slug: "privacidad", icon: ShieldIcon, ready: false },
    ],
  },
  {
    key: "people",
    sections: [
      { key: "team", slug: "equipo", icon: UsersIcon, ready: true },
      { key: "roles", slug: "roles", icon: KeyRoundIcon, ready: false },
    ],
  },
  {
    key: "business",
    sections: [
      { key: "organization", slug: "general", icon: Building2Icon, ready: true },
      { key: "locations", slug: "sedes", icon: StoreIcon, ready: true },
      { key: "plan", slug: "plan", icon: CreditCardIcon, ready: false },
      { key: "billing", slug: "facturacion", icon: ReceiptIcon, ready: false },
    ],
  },
  {
    key: "ai",
    sections: [
      { key: "models", slug: "modelos", icon: BotIcon, ready: false },
      { key: "integrations", slug: "integraciones", icon: PlugIcon, ready: false },
    ],
  },
  {
    key: "security",
    sections: [
      { key: "security", slug: "seguridad", icon: LockIcon, ready: true },
      { key: "audit", slug: "auditoria", icon: ScrollTextIcon, ready: false },
    ],
  },
] as const;

type SettingsSectionDef = (typeof SETTINGS_GROUP_DEFS)[number]["sections"][number];
export type SettingsSectionKey = SettingsSectionDef["key"];

export interface SettingsSection {
  key: SettingsSectionKey;
  slug: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
}

export interface SettingsGroup {
  key: (typeof SETTINGS_GROUP_DEFS)[number]["key"];
  sections: readonly SettingsSection[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = SETTINGS_GROUP_DEFS.map((group) => ({
  key: group.key,
  sections: group.sections.map((section: SettingsSectionDef) => ({ ...section, href: `${SETTINGS_ROOT}/${section.slug}` })),
}));

/** Las 13 secciones, en el orden de la navegación. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = SETTINGS_GROUPS.flatMap((group) => group.sections);

export function settingsSection(key: SettingsSectionKey): SettingsSection {
  const section = SETTINGS_SECTIONS.find((candidate) => candidate.key === key);
  if (!section) throw new Error(`Sección de Ajustes desconocida: ${key}`);
  return section;
}

/** Sección por su tramo de URL (`/app/ajustes/<slug>`), o null. */
export function settingsSectionBySlug(slug: string): SettingsSection | null {
  return SETTINGS_SECTIONS.find((section) => section.slug === slug) ?? null;
}

/** ¿Es una clave de agente de serie? Para validar `/app/agentes/[tipo]`. */
export function isAgentKey(value: string): value is AgentTypeKey {
  return AGENT_TYPES.some((agent) => agent.key === value);
}

/** ¿La ruta actual corresponde a esta entrada? /app solo coincide exacto. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
