// Navegación de la app (MANUAL §9.2 y §9.4). Fuente única para la barra
// lateral y la paleta de comandos. Las etiquetas viven en messages/*.json
// (nav.<key>); aquí solo claves, rutas e iconos.
import {
  ActivityIcon,
  BarChart3Icon,
  BookOpenIcon,
  BrainIcon,
  CheckSquareIcon,
  ContactIcon,
  HomeIcon,
  InboxIcon,
  LightbulbIcon,
  MessagesSquareIcon,
  SettingsIcon,
  SparklesIcon,
  StampIcon,
  StoreIcon,
  TargetIcon,
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
  { key: "approvals", href: "/app/approvals", icon: StampIcon },
  { key: "inbox", href: "/app/inbox", icon: InboxIcon },
  { key: "tasks", href: "/app/tasks", icon: CheckSquareIcon },
  { key: "activity", href: "/app/activity", icon: ActivityIcon },
  { key: "analytics", href: "/app/analytics", icon: BarChart3Icon },
];

export const RECORDS_NAV: readonly NavItem[] = [
  { key: "contacts", href: "/app/records/contacts", icon: ContactIcon },
  { key: "conversations", href: "/app/records/conversations", icon: MessagesSquareIcon },
  { key: "recommendations", href: "/app/records/recommendations", icon: LightbulbIcon },
  { key: "goals", href: "/app/records/goals", icon: TargetIcon },
  { key: "knowledge", href: "/app/records/knowledge", icon: BookOpenIcon },
  { key: "memory", href: "/app/records/memory", icon: BrainIcon },
  { key: "locations", href: "/app/records/locations", icon: StoreIcon },
  { key: "people", href: "/app/records/people", icon: UsersIcon },
];

export const SETTINGS_NAV: NavItem = { key: "settings", href: "/app/settings/organization", icon: SettingsIcon };

/** ¿La ruta actual corresponde a esta entrada? /app solo coincide exacto. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href.startsWith("/app/settings")) return pathname.startsWith("/app/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
