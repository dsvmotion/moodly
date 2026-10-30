import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, type Locale, LOCALE_COOKIE, localeFromTag } from "./config";

// Idioma por cookie (sin prefijo en la URL): la app es privada y no necesita
// rutas por idioma.
export default getRequestConfig(async () => {
  const locale = await requestLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

// ADR 0041: el que eligió la persona (cookie); si no ha elegido o la cookie trae
// un idioma que no tenemos, el de su organización activa, para que una
// organización que trabaja en español no obligue a cada persona a cambiarlo; y
// si no hay sesión ni organización, inglés. getOrgContext ya lo pide el layout de
// la app en cada petición (React cache), así que no añade consultas allí; se
// importa al usarlo para no cargarlo en las páginas que traen la cookie.
async function requestLocale(): Promise<Locale> {
  const requested = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(requested)) return requested;
  const { getOrgContext } = await import("@/lib/scope-data");
  const { active } = await getOrgContext();
  return localeFromTag(active?.defaultLocale);
}
