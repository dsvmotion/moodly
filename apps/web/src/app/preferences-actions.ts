"use server";

import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { appCookieOptions, isHttpsRequest } from "@/lib/cookie-options";
import { parseTheme, SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/preferences";

// Preferencias de interfaz (no son datos de negocio ni de sesión). Se validan
// siempre: cualquier valor desconocido cae al valor por defecto.
async function setPreference(name: string, value: string): Promise<void> {
  (await cookies()).set(name, value, appCookieOptions(isHttpsRequest(await headers())));
}

export async function setTheme(theme: string): Promise<void> {
  await setPreference(THEME_COOKIE, parseTheme(theme));
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  await setPreference(SIDEBAR_COOKIE, collapsed ? "1" : "0");
}

export async function setLocale(locale: string): Promise<void> {
  await setPreference(LOCALE_COOKIE, isLocale(locale) ? locale : DEFAULT_LOCALE);
}
