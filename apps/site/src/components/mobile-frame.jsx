"use client";
import { useSede } from "@/components/use-sede";
import { approvalsCount } from "@/components/sede-data";

// Marco del prototipo móvil (PWA): teléfono + cabecera + barra inferior. Una sola
// fuente para que la barra y el contador de aprobaciones sean iguales en todas las
// pantallas móviles (el contador sale de la sede activa, como en escritorio).
const TABS = [
  ["inicio", "Inicio", "/plataforma/movil", <path key="p" d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />],
  ["chats", "Chats", "/plataforma/movil/chats", <path key="p" d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />],
  ["aprobar", "Aprobar", "/plataforma/movil/aprobaciones", <><path key="a" d="M9 11l3 3 8-8" /><path key="b" d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>],
  ["agenda", "Agenda", "/plataforma/movil/agenda", <><rect key="r" x="3" y="5" width="18" height="16" rx="2" /><path key="p" d="M16 3v4M8 3v4M3 11h18" /></>],
  ["mas", "Más", "/plataforma/movil/mas", <path key="p" d="M4 6h16M4 12h16M4 18h16" />],
];

export default function MobileFrame({ active, title, back, right, children }) {
  const { sede } = useSede();
  const badge = approvalsCount(sede);
  return (
    <div style={{ minHeight: "100vh", background: "var(--backdrop)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid var(--ink)" }}>
        <div style={{ width: "390px", maxWidth: "calc(100vw - 48px)", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <header style={{ padding: "56px 20px 12px", display: "flex", alignItems: "center", gap: "12px" }}>
            {back && <a href={back} aria-label="Volver" style={{ display: "flex", color: "var(--ink)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></a>}
            <h1 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: "24px", lineHeight: "26.4px", fontWeight: 400, letterSpacing: "-0.48px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h1>
            {right}
          </header>
          <main style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "20px" }}>{children}</main>
          <nav aria-label="Principal" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "8px 6px 28px", background: "var(--paper)", borderTop: "1px solid var(--line)", fontSize: "11px", lineHeight: "14px", textAlign: "center" }}>
            {TABS.map(([key, label, href, icon]) => {
              const on = key === active;
              return (
                <a key={key} href={href} aria-current={on ? "page" : undefined} style={{ fontWeight: on ? 500 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: on ? "var(--ink)" : "var(--muted)", position: "relative", textDecoration: "none" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? "var(--ink)" : "var(--muted)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                  {key === "aprobar" && badge > 0 && <span style={{ position: "absolute", top: 0, left: "56%", minWidth: "16px", height: "16px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "11px", lineHeight: "16px" }}>{badge}</span>}
                  {label}
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
