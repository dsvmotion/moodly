"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Activity, BookOpen, Bot, Brain, CalendarDays, ChartColumn, Clock, Contact, Cpu, CreditCard, ExternalLink, Languages, LayoutTemplate, Moon, House, LogOut, MessagesSquare, Network, Phone, Plug, Receipt, Settings, ShieldCheck, Sparkles, Stamp, Store, Target, User, Users, WandSparkles, Zap } from "lucide-react";
import { SEDES, useSede } from "@/components/use-sede";
import { useTheme } from "@/components/theme";
import { PLAT_LANGS, usePlatformLang } from "@/components/plataforma-i18n";
import { setScreenState } from "@/components/screen-states";
import { approvalsCount } from "@/components/sede-data";

// Iconos del menú lateral (lucide, trazo fino), estilo de la referencia Langdock.
const ICONS = { asistente: WandSparkles, inicio: House, conversaciones: MessagesSquare, aprobaciones: Stamp, agenda: CalendarDays, clientes: Contact, leads: Target, facturas: Receipt, llamadas: Phone, informes: ChartColumn, agentes: Bot, conocimiento: BookOpen, memoria: Brain, reglas: ShieldCheck, flujos: Zap, horarios: Clock, coach: Sparkles, equipo: Users, sedes: Store, integraciones: Plug, modelos: Cpu, plan: CreditCard, ajustes: Settings, configuracion: Settings, red: Network };
const Ico = ({ k, active }) => { const C = ICONS[k]; return C ? <C size={18} strokeWidth={1.75} aria-hidden="true" style={{ flex: "none", color: active ? "var(--ink)" : "var(--muted)" }} /> : null; };

export default function Sidebar(props) {
  const [state, setStateRaw] = useState({});
  const { sede } = useSede();
  const aprob = String(approvalsCount(sede));
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: props, aprob };
  const vals = function () {
const active = this.props.active ?? 'inicio';
const H = (label) => ({ header: true, label });
const L = (key, label, href, badge) => ({ key, label, href, badge: badge || '' });
const list = [
L('asistente', 'Asistente', '/plataforma/asistente'),
H('Red'),
L('red', 'Red de franquicias', '/plataforma/red'),
H('Operación'),
L('inicio', 'Inicio', '/plataforma'),
L('conversaciones', 'Conversaciones', '/plataforma/conversaciones'),
L('aprobaciones', 'Aprobaciones', '/plataforma/aprobaciones', this.aprob),
L('agenda', 'Agenda', '/plataforma/agenda'),
L('clientes', 'Clientes', '/plataforma/clientes'),
L('leads', 'Leads', '/plataforma/leads'),
L('facturas', 'Facturas e inventario', '/plataforma/facturas'),
L('llamadas', 'Llamadas', '/plataforma/llamadas'),
L('informes', 'Informes', '/plataforma/informes'),
H('Agentes'),
L('agentes', 'Mis agentes', '/plataforma/agente'),
L('conocimiento', 'Conocimiento', '/plataforma/conocimiento'),
L('memoria', 'Memoria del negocio', '/plataforma/memoria'),
L('reglas', 'Reglas y aprobaciones', '/plataforma/reglas'),
L('flujos', 'Flujos automáticos', '/plataforma/flujos'),
L('horarios', 'Horarios', '/plataforma/horarios'),
L('coach', 'Modo coach', '/plataforma/coach'),
L('configuracion', 'Configuración', '/plataforma/configuracion/general')
];
return {
items: list.map((it) => ({ ...it, isHeader: !!it.header, isActive: !it.header && it.key === active, isLink: !it.header && it.key !== active, badge: it.badge || false }))
};
}.call(ctx);
  const { items } = vals;
  return (
    <>

<nav aria-label="Menú principal" data-sidenav="" style={{ width: "248px", minHeight: "100dvh", boxSizing: "border-box", padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", borderRight: "1px solid var(--line-soft)", letterSpacing: "-0.16px", fontSize: "14px", lineHeight: "20px" }}>
<a href="/plataforma" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "500", letterSpacing: "-0.3px", padding: "6px 10px 14px", color: "var(--ink)", textDecoration: "none" }}><img src="/brand/moodly-logo-black.svg" alt="Moodly" width="78" height="20" style={{ display: "block" }} /></a>
<SiteSwitcher />
{(items).map((it, $index) => (<Fragment key={$index}>
{(it.isHeader) ? (<><span style={{ padding: "16px 10px 6px", fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{it.label}</span></>) : null}
{(it.isActive) ? (<><a href={it.href} aria-current="page" style={{ padding: "7px 10px", borderRadius: "10px", background: "var(--line-soft)", fontWeight: "500", color: "var(--ink)", textDecoration: "none", display: "flex", gap: "10px", alignItems: "center" }}><Ico k={it.key} active /><span style={{ flex: 1 }}>{it.label}</span>{(it.badge) ? (<><span style={{ padding: "0 7px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "18px", fontWeight: "400" }}>{it.badge}</span></>) : null}</a></>) : null}
{(it.isLink) ? (<><a href={it.href} className="side-link" style={{ padding: "7px 10px", borderRadius: "10px", color: "var(--ink-2)", textDecoration: "none", display: "flex", gap: "10px", alignItems: "center" }}><Ico k={it.key} /><span style={{ flex: 1 }}>{it.label}</span>{(it.badge) ? (<><span style={{ padding: "0 7px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "18px" }}>{it.badge}</span></>) : null}</a></>) : null}
</Fragment>))}
<UserMenu />
</nav>
</>
  );
}


// Menú de usuario del pie del menú lateral: perfil, idioma, web pública y salir.
function UserMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const THEMES = { system: "Sistema", light: "Claro", dark: "Oscuro" };
  const nextTheme = { system: "light", light: "dark", dark: "system" };
  const [lang, setLang] = usePlatformLang();
  const langIds = Object.keys(PLAT_LANGS);
  const nextLang = langIds[(langIds.indexOf(lang) + 1) % langIds.length];
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (e.key === "Escape" || (e.type === "mousedown" && ref.current && !ref.current.contains(e.target))) setOpen(false); };
    document.addEventListener("keydown", close); document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("mousedown", close); };
  }, []);
  const item = { display: "flex", gap: "10px", alignItems: "center", padding: "9px 12px", borderRadius: "8px", color: "var(--ink)", textDecoration: "none", fontSize: "14px", lineHeight: "20px" };
  return (
    <div ref={ref} style={{ marginTop: "auto", position: "relative" }}>
      {open && (
        <div role="menu" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "var(--paper)", borderRadius: "12px", boxShadow: "0 8px 24px #1b1a1f1f, 0 1px 2px #1b1a1f14", padding: "6px", display: "flex", flexDirection: "column", zIndex: 30 }}>
          <a role="menuitem" href="/plataforma/configuracion/perfil" style={item}><User size={16} strokeWidth={1.75} aria-hidden="true" />Mi perfil</a>
          <a role="menuitem" href="/plataforma/configuracion/general" style={item}><Settings size={16} strokeWidth={1.75} aria-hidden="true" />Ajustes de la empresa</a>
          <a role="menuitem" href="/plataforma/configuracion/plan" style={item}><Activity size={16} strokeWidth={1.75} aria-hidden="true" />Plan y consumo</a>
          <button type="button" role="menuitem" onClick={() => setTheme(nextTheme[theme])} style={{ ...item, width: "100%", border: 0, background: "transparent", font: "inherit", cursor: "pointer", textAlign: "left" }}><Moon size={16} strokeWidth={1.75} aria-hidden="true" />{`Tema: ${THEMES[theme]}`}</button>
          <button type="button" role="menuitem" onClick={() => setLang(nextLang)} style={{ ...item, width: "100%", border: 0, background: "transparent", font: "inherit", cursor: "pointer", textAlign: "left" }}><Languages size={16} strokeWidth={1.75} aria-hidden="true" /><span>Idioma</span><span translate="no" lang={lang} style={{ marginLeft: "auto", color: "var(--muted-2)" }}>{PLAT_LANGS[lang]}</span></button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setScreenState("normal"); }} style={{ ...item, width: "100%", border: 0, background: "transparent", font: "inherit", cursor: "pointer", textAlign: "left" }}><LayoutTemplate size={16} strokeWidth={1.75} aria-hidden="true" />Ver estados de pantalla</button>
          <a role="menuitem" href="/es" style={item}><ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />Ir a moodly.ai</a>
          <a role="menuitem" href="/es" style={{ ...item, color: "var(--rose-fg)", borderTop: "1px solid var(--line-soft)", borderRadius: 0 }}><LogOut size={16} strokeWidth={1.75} aria-hidden="true" />Cerrar sesión</a>
        </div>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", gap: "10px", alignItems: "center", padding: "10px 12px", borderRadius: "12px", border: 0, background: open ? "var(--tint)" : "transparent", font: "400 14px/20px var(--font-display)", color: "var(--ink)", cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 500, flex: "none" }}>MR</span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block" }}>Marta Ruiz</span><span style={{ display: "block", fontSize: "12px", lineHeight: "16px", color: "var(--muted-2)" }}>Dueña · Clínica Dental Sol</span></span>
        <span aria-hidden="true" style={{ color: "var(--muted-2)" }}>{open ? "⌄" : "⌃"}</span>
      </button>
    </div>
  );
}

// Selector de sede: cambia la sede activa del panel. La selección se comparte con
// toda la pantalla vía SedeProvider y se guarda en localStorage (ver use-sede).
function SiteSwitcher() {
  const { sede, setSede } = useSede();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (e.key === "Escape" || (e.type === "mousedown" && ref.current && !ref.current.contains(e.target))) setOpen(false); };
    document.addEventListener("keydown", close); document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("mousedown", close); };
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: "8px" }}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} style={{ width: "100%", padding: "8px 10px", borderRadius: "12px", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", font: "400 14px/20px var(--font-display)", color: "var(--ink)", cursor: "pointer", textAlign: "left" }}>
        <span><span style={{ display: "block", fontWeight: 500 }}>Clínica Dental Sol</span><span style={{ display: "block", fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{sede}</span></span>
        <span aria-hidden="true" style={{ color: "var(--muted-2)" }}>{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Sede" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, margin: 0, padding: "6px", listStyle: "none", background: "var(--paper)", borderRadius: "12px", boxShadow: "0 8px 24px #1b1a1f1f", zIndex: 30 }}>
          {SEDES.map((x) => (
            <li key={x} role="option" aria-selected={x === sede}><button type="button" onClick={() => { setSede(x); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: "8px", border: 0, background: x === sede ? "var(--tint)" : "transparent", font: "400 14px/20px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}>{x}{x === sede ? " ✓" : ""}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
