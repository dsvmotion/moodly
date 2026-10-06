"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Server, ShieldCheck } from "lucide-react";
import { getNav } from "./site-data";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, localize, switchLocale, ui } from "./i18n";
import { useLang } from "./use-lang";

// Pie de página común (referencia: Langdock). Sellos de confianza, columnas de
// navegación, idiomas, hora local y legales.

// Redes sociales: sin URL hasta que existan las cuentas (no se inventan enlaces).
const SOCIAL = [
  ["LinkedIn", "/logos/linkedin.svg", null],
  ["Instagram", "/logos/instagram.svg", null],
  ["YouTube", "/logos/youtube.svg", null],
];

// Círculo con las 12 estrellas de la UE.
function EuStars() {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return [28 + 15 * Math.sin(a), 28 - 15 * Math.cos(a)];
  });
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="28" fill="#2457f5" />
      {stars.map(([x, y], i) => (
        <path key={i} transform={`translate(${x} ${y})`} d="M0 -3.2 L0.95 -1 L3.2 -1 L1.4 0.4 L2 2.7 L0 1.3 L-2 2.7 L-1.4 0.4 L-3.2 -1 L-0.95 -1 Z" fill="#ffd400" />
      ))}
    </svg>
  );
}

const BADGE_ICONS = [
  <span key="a" style={{ width: "56px", height: "56px", borderRadius: "800px", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldCheck size={26} strokeWidth={1.75} color="#ffffff" aria-hidden="true" /></span>,
  <span key="b" style={{ width: "56px", height: "56px", borderRadius: "800px", background: "radial-gradient(circle, #ffffff8c 1.2px, transparent 1.6px) 0 0 / 7px 7px, #4a4a4f", display: "flex", alignItems: "center", justifyContent: "center" }}><Server size={22} strokeWidth={1.75} color="#ffffff" aria-hidden="true" /></span>,
  <EuStars key="c" />,
];

function LocalTime() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const fmt = () => setNow(new Date().toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{now}</span>;
}

export default function SiteFooter() {
  const lang = useLang();
  const t = ui(lang);
  const { footer: FOOTER, legal: LEGAL } = getNav(lang);
  const pathname = usePathname() || "/";
  const router = useRouter();
  const pickLang = (next) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(switchLocale(pathname, next) + window.location.hash);
  };
  const colTitle = { color: "#6b6b70", fontSize: "15px", lineHeight: "22px" };
  const link = { fontSize: "16px", lineHeight: "24px", color: "#000000" };

  return (
    <footer style={{ padding: "clamp(96px, 10vw, 160px) clamp(16px, 4vw, 40px) 40px", fontFamily: "var(--font-display)", letterSpacing: "-0.16px", color: "#000000" }}>
      <div style={{ maxWidth: "1312px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "72px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "56px 48px", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 300px", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "28px" }}>
            <Link href={localize(lang, "/")} aria-label="Moodly"><img src="/brand/moodly-logo-black.svg" alt="Moodly" width="124" height="32" style={{ display: "block" }} /></Link>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "18px" }}>
              {t.badges.map(([title, sub], i) => (
                <li key={title} style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <span style={{ flex: "none" }}>{BADGE_ICONS[i]}</span>
                  <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "17px", lineHeight: "24px", fontWeight: 500 }}>{title}</span><span style={{ fontSize: "15px", lineHeight: "22px", color: "#6b6b70" }}>{sub}</span></span>
                </li>
              ))}
            </ul>
            <Link href={localize(lang, "/seguridad")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "16px", lineHeight: "24px", fontWeight: 500 }}>{t.moreSecurity}<ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" /></Link>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "15px", lineHeight: "22px" }}>
              <span style={{ color: "#6b6b70" }}>{t.city} · <LocalTime /></span>
              <span>{t.address.map((l) => (<span key={l} style={{ display: "block" }}>{l}</span>))}</span>
            </div>
          </div>

          <nav aria-label={t.footerNav} className="footer-cols" style={{ flex: "3 1 640px", display: "grid", gap: "40px 32px" }}>
            {FOOTER.map((col) => (
              <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={colTitle}>{col.title}</span>
                {col.links.map(([label, href]) => (<Link key={label} href={href} className="footer-link" style={link}>{label}</Link>))}
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={colTitle}>{t.languages}</span>
              {LOCALES.map((l) => (
                <button key={l} type="button" lang={l} aria-current={l === lang ? "true" : undefined} onClick={() => l !== lang && pickLang(l)} className="footer-link" style={{ ...link, padding: 0, border: 0, background: "transparent", textAlign: "left", font: "inherit", fontSize: "16px", cursor: l === lang ? "default" : "pointer", fontWeight: l === lang ? 500 : 400 }}>{LOCALE_NAMES[l]}</button>
              ))}
            </div>
          </nav>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px 32px", flexWrap: "wrap", fontSize: "15px", lineHeight: "22px" }}>
          <div style={{ display: "flex", gap: "12px 28px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "#6b6b70" }}>© 2026 Moodly AI</span>
            {LEGAL.map(([label, href]) => (<Link key={label} href={href} className="footer-link">{label}</Link>))}
            <Link href={localize(lang, "/seguridad")} className="footer-link">{t.vuln}</Link>
          </div>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {SOCIAL.map(([name, icon, url]) => {
              const inner = (<><img src={icon} alt="" width="20" height="20" style={{ display: "block" }} />{name}</>);
              return url
                ? <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: "8px", alignItems: "center" }}>{inner}</a>
                : <span key={name} title="Próximamente" style={{ display: "flex", gap: "8px", alignItems: "center", color: "#6b6b70" }}>{inner}</span>;
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
