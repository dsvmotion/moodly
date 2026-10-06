"use client";
import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, switchLocale, ui } from "./i18n";
import { useLang } from "./use-lang";

// Selector de idioma: guarda la elección en una cookie (el proxy la respeta en
// las siguientes visitas) y abre la misma página en el idioma elegido.
export default function LanguageSwitcher({ compact = false }) {
  const lang = useLang();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const pick = (next) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(switchLocale(pathname, next) + window.location.hash);
  };
  return (
    <div role="group" aria-label={ui(lang).language} style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "13px", lineHeight: "19px" }}>
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} title={LOCALE_NAMES[l]} aria-pressed={l === lang} onClick={() => l !== lang && pick(l)} style={{ padding: compact ? "2px 8px" : "3px 10px", borderRadius: "800px", border: 0, background: l === lang ? "#000000" : "transparent", color: l === lang ? "#ffffff" : "#5f5f63", font: "inherit", cursor: l === lang ? "default" : "pointer" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
