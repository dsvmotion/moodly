"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AGENTS, getNav } from "./site-data";
import { localize, ui } from "./i18n";
import { useLang } from "./use-lang";
import LanguageSwitcher from "./language-switcher";

export { AGENTS };

const navLink = { padding: "8px 10px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "transparent", border: 0, color: "#000000", fontFamily: "inherit", cursor: "pointer" };
const mLabel = { display: "block", padding: "16px 4px 6px", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" };
const mLink = { display: "flex", alignItems: "center", gap: "10px", padding: "12px 4px", fontSize: "16px", lineHeight: "22px", borderBottom: "1px solid #0000000f" };
const item = { display: "flex", gap: "14px", padding: "12px 14px", borderRadius: "12px" };
const itemTitle = { display: "block", fontSize: "15px", lineHeight: "22px" };
const itemText = { display: "block", fontSize: "13px", lineHeight: "19px", color: "#5f5f63" };

function Feature({ href, bg, fg, title, text, cta, close }) {
  return (
    <Link href={href} onClick={close} style={{ flex: "1 1 280px", borderRadius: "12px", background: bg, color: fg, padding: "24px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "220px", boxSizing: "border-box" }}>
      <span style={{ fontSize: "18px", lineHeight: "22px", letterSpacing: "-0.36px" }}>{title}</span>
      <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.75 }}>{text}</span>
      <span style={{ marginTop: "auto", fontSize: "14px" }}>{cta} →</span>
    </Link>
  );
}

export default function SiteHeader() {
  const lang = useLang();
  const t = ui(lang);
  const pathname = usePathname() || "";
  // Páginas ya traducidas a los cuatro idiomas: sin aviso de traducción en curso.
  // "/" = home. Se añade cada ruta al terminar su traducción.
  const sub = pathname.replace(/^\/(es|en|fr|de)(?=\/|$)/, "") || "/";
  const translated = ["/", "/producto", "/app-movil", "/agentes", "/contacto", "/casos", "/implantacion", "/sobre-nosotros", "/privacidad", "/terminos", "/aviso-legal", "/cookies", "/enterprise", "/modelos", "/seguridad", "/precios", "/sectores", "/integraciones"].includes(sub);
  const { agents: AGENTS_L, platform: PLATFORM, sectors: SECTORS, resources: RESOURCES } = getNav(lang);
  const L = (href) => localize(lang, href);
  const [open, setOpen] = useState(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setOpen(null); setMobile(false); } };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const close = () => setOpen(null);
  const Menu = ({ id, label }) => (
    <button type="button" aria-expanded={open === id} onClick={() => toggle(id)} style={{ ...navLink, background: open === id ? "#0000000d" : "transparent" }}>{label} {open === id ? "⌃" : "⌄"}</button>
  );

  return (
    <header ref={ref} style={{ position: "sticky", top: 0, zIndex: 20, background: "#f7f7f8e6", backdropFilter: "blur(8px)", fontFamily: "var(--font-display)", letterSpacing: "-0.16px" }}>
      <nav style={{ maxWidth: "1312px", margin: "0 auto", padding: "0 clamp(16px, 4vw, 40px)", minHeight: "56px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <Link href={L("/")} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", lineHeight: "24px", fontWeight: 500, letterSpacing: "-0.3px" }}>
            <img src="/brand/moodly-logo-black.svg" alt="Moodly" width="85" height="22" style={{ display: "block" }} />
          </Link>
          <div className="nav-desktop" style={{ display: "flex" }}>
            <Menu id="plataforma" label={t.platform} />
            <Menu id="sectores" label={t.sectors} />
            <Menu id="recursos" label={t.resources} />
            <Link href={L("/seguridad")} style={navLink}>{t.security}</Link>
            <Link href={L("/enterprise")} style={navLink}>{t.enterprise}</Link>
            <Link href={L("/precios")} style={navLink}>{t.pricing}</Link>
          </div>
        </div>
        {/* Sin «Entrar» hasta que exista producción: la web pública nunca apunta a staging
            ni al prototipo (auditoría 2026-11-10, N-04; decisión de producto del 2026-11-10). */}
        <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link href={L("/contacto")} style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a", background: "#ffffff", whiteSpace: "nowrap" }}>{t.talkSales}</Link>
          <Link href={L("/#demo")} style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff", whiteSpace: "nowrap" }}>{t.demo}</Link>
        </div>
        <button type="button" className="nav-burger" aria-label={mobile ? t.closeMenu : t.openMenu} aria-expanded={mobile} onClick={() => setMobile((m) => !m)} style={{ width: "44px", height: "44px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">{mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </nav>
      {t.translating && !translated && (<div role="note" style={{ background: "#fff3e8", color: "#8e4e00", fontSize: "13px", lineHeight: "19px", textAlign: "center", padding: "6px 16px" }}>{t.translating}</div>)}

      {mobile && (
        <div className="nav-mobile-panel" style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "#f7f7f8", borderBottom: "1px solid #0000000f", boxShadow: "0 12px 24px #0000001f", padding: "8px 16px 20px", maxHeight: "calc(100vh - 56px)", overflowY: "auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px" }}><LanguageSwitcher /></div>
          <span style={mLabel}>{t.agents}</span>
          {AGENTS_L.map((a) => (<Link key={a.name} href={a.href} onClick={() => setMobile(false)} style={mLink}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: a.color, flex: "none" }} />{a.name}</Link>))}
          <span style={mLabel}>{t.platform}</span>
          {PLATFORM.map((p) => (<Link key={p.name} href={p.href} onClick={() => setMobile(false)} style={mLink}>{p.name}</Link>))}
          <span style={mLabel}>{t.sectors}</span>
          {SECTORS.map((s) => (<Link key={s.name} href={s.href} onClick={() => setMobile(false)} style={mLink}>{s.name}</Link>))}
          <span style={mLabel}>{t.resources}</span>
          {RESOURCES.map((r) => (<Link key={r.name} href={r.href} onClick={() => setMobile(false)} style={mLink}>{r.name}</Link>))}
          <Link href={L("/precios")} onClick={() => setMobile(false)} style={mLink}>{t.pricing}</Link>
          <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
            <Link href={L("/contacto")} onClick={() => setMobile(false)} style={{ flex: 1, textAlign: "center", padding: "13px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", fontSize: "15px" }}>{t.talkSales}</Link>
            <Link href={L("/#demo")} onClick={() => setMobile(false)} style={{ flex: 1, textAlign: "center", padding: "13px 18px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "15px" }}>{t.demo}</Link>
          </div>
        </div>
      )}

      {open && (
        <div className="nav-desktop-panel" style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "#f7f7f8", borderBottom: "1px solid #0000000f", boxShadow: "0 8px 24px #0000001f" }}>
          <div style={{ maxWidth: "1312px", margin: "0 auto", padding: "28px clamp(16px, 4vw, 40px) 36px", boxSizing: "border-box", display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {open === "plataforma" && (<>
              <div style={{ flex: "1 1 280px" }}>
                <span style={mLabel}>{t.agents}</span>
                {AGENTS_L.map((a) => (
                  <Link key={a.name} href={a.href} onClick={close} style={item}>
                    <span style={{ width: "32px", height: "32px", borderRadius: "800px", background: a.color, flex: "none" }} />
                    <span><span style={itemTitle}>{a.name}</span><span style={itemText}>{a.text}</span></span>
                  </Link>
                ))}
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <span style={mLabel}>{t.platform}</span>
                {PLATFORM.map((p) => (<Link key={p.name} href={p.href} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{p.name}</span><span style={itemText}>{p.text}</span></Link>))}
              </div>
              <Feature href={L("/producto")} bg="#000000" fg="#ffffff" title={t.seePlatform[0]} text={t.seePlatform[1]} cta={t.seePlatform[2]} close={close} />
            </>)}
            {open === "sectores" && (<>
              <div style={{ flex: "2 1 520px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 24px" }}>
                {SECTORS.map((s) => (<Link key={s.name} href={s.href} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{s.name}</span><span style={itemText}>{s.text}</span></Link>))}
                <Link href={L("/casos")} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{t.cases[0]}</span><span style={itemText}>{t.cases[1]}</span></Link>
              </div>
              <Feature href={L("/contacto")} bg="#ff6301" fg="#000000" title={t.noSector[0]} text={t.noSector[1]} cta={t.noSector[2]} close={close} />
            </>)}
            {open === "recursos" && (<>
              <div style={{ flex: "2 1 520px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 24px" }}>
                {RESOURCES.map((r) => (<Link key={r.name} href={r.href} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{r.name}</span><span style={itemText}>{r.text}</span></Link>))}
                <Link href={L("/sobre-nosotros")} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{t.about[0]}</span><span style={itemText}>{t.about[1]}</span></Link>
                <Link href={L("/contacto")} onClick={close} style={{ ...item, flexDirection: "column", gap: 0 }}><span style={itemTitle}>{t.contact[0]}</span><span style={itemText}>{t.contact[1]}</span></Link>
              </div>
              <Feature href={L("/seguridad")} bg="#a3c2a7" fg="#000000" title={t.trust[0]} text={t.trust[1]} cta={t.trust[2]} close={close} />
            </>)}
          </div>
        </div>
      )}
    </header>
  );
}
