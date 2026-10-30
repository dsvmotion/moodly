// Idiomas de la interfaz (MANUAL §9.9, ADR 0041): inglés por defecto y español.
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * El idioma de la interfaz para el de una organización (`organizations.default_locale`,
 * una etiqueta BCP 47 como `es-ES`): su idioma si lo tenemos; si no, el de por defecto.
 */
export function localeFromTag(tag: string | null | undefined): Locale {
  const language = tag?.split("-")[0]?.toLowerCase();
  return isLocale(language) ? language : DEFAULT_LOCALE;
}
