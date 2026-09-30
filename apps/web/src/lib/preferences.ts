// Preferencias de interfaz del usuario, en cookies para que el servidor pinte
// el tema y la barra lateral correctos desde el primer render (sin parpadeo).

export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const SIDEBAR_COOKIE = "sidebar_collapsed";

export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: unknown): Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value) ? (value as Theme) : "system";
}

/** Atributo data-theme de <html>: sin atributo = tema del sistema. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

export function parseSidebarCollapsed(value: unknown): boolean {
  return value === "1";
}
