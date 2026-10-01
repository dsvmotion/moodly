"use server";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { parseTheme, PREFERENCE_COOKIE_MAX_AGE, SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/preferences";

// Preferencias de interfaz (no son datos de negocio ni de sesión). Se validan
// siempre: cualquier valor desconocido cae al valor por defecto.
const cookieOptions = { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax" as const, httpOnly: true };

export async function setTheme(theme: string): Promise<void> {
  (await cookies()).set(THEME_COOKIE, parseTheme(theme), cookieOptions);
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  (await cookies()).set(SIDEBAR_COOKIE, collapsed ? "1" : "0", cookieOptions);
}

export async function setLocale(locale: string): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, isLocale(locale) ? locale : DEFAULT_LOCALE, cookieOptions);
}
