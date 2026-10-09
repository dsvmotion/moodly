import { NextResponse } from "next/server";
import { COUNTRY_LOCALE, DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, hasLocale } from "./components/i18n";

// Idioma por defecto de cada visita, por orden:
// 1) el que eligió antes (cookie), 2) su país (cabecera de la CDN), 3) su navegador, 4) inglés.
function pickLocale(request) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(saved)) return saved;
  const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");
  if (country && COUNTRY_LOCALE[country.toUpperCase()]) return COUNTRY_LOCALE[country.toUpperCase()];
  const accepted = (request.headers.get("accept-language") || "")
    .split(",")
    .map((part) => { const [tag, q] = part.trim().split(";q="); return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 }; })
    .sort((a, b) => b.q - a.q);
  return accepted.find((a) => LOCALES.includes(a.lang))?.lang || DEFAULT_LOCALE;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  request.nextUrl.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Todo menos los internos de Next, los archivos estáticos y el prototipo de la plataforma.
  matcher: ["/((?!_next|plataforma|api|.*\\..*).*)"],
};
