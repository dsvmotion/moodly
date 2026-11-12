import { Fragment } from "react";
import ApprovalsBadge from "@/components/approvals-badge";
import { SedeCycle, SedeName } from "@/components/sede-cycle";

export default function Screen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--backdrop)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}><div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid var(--ink)" }}>

<div style={{ width: "390px", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>

<header style={{ padding: "56px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}><SedeCycle>Estudio de Belleza Sol · <SedeName /> ⌄</SedeCycle></span><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Buenos días, Marta</span></span>
<span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "var(--linen)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500" }}>MR</span>
</header>

<main style={{ flex: "1", overflow: "hidden", padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
<div style={{ borderRadius: "12px", background: "var(--sage)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "12px", lineHeight: "18px" }}>Conversaciones</span><span style={{ fontSize: "24px", lineHeight: "26px", letterSpacing: "-0.48px" }}>42</span></div>
<div style={{ borderRadius: "12px", background: "var(--mist)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "12px", lineHeight: "18px" }}>Citas reservadas</span><span style={{ fontSize: "24px", lineHeight: "26px", letterSpacing: "-0.48px" }}>18</span></div>
</div>

<a href="/plataforma/movil/aprobaciones" style={{ borderRadius: "12px", background: "var(--amber-bg)", color: "var(--amber-fg)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "14px", lineHeight: "21px" }}><span><strong style={{ fontWeight: "500" }}>3 tareas esperan tu aprobación</strong><span style={{ display: "block", fontSize: "12px", lineHeight: "18px" }}>Factura, reseña y cambio de agenda</span></span><span aria-hidden="true">›</span></a>

<section style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tus agentes</h2>
<div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px" }}><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#004c39" }}></span><span style={{ flex: "1" }}>Recepción</span><span style={{ fontSize: "12px", color: "var(--green-fg)" }}>● Activo</span></div>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--line-soft)" }}><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "var(--mist)" }}></span><span style={{ flex: "1" }}>Atención al cliente</span><span style={{ fontSize: "12px", color: "var(--green-fg)" }}>● Activo</span></div>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--line-soft)" }}><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#a30042" }}></span><span style={{ flex: "1" }}>Comercial</span><span style={{ fontSize: "12px", color: "var(--muted)" }}>○ Pausado</span></div>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--line-soft)" }}><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#8e4e00" }}></span><span style={{ flex: "1" }}>Administración</span><span style={{ fontSize: "12px", color: "var(--green-fg)" }}>● Activo</span></div>
</div>
</section>

<section style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Actividad reciente</h2>
<div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden", fontSize: "14px", lineHeight: "20px" }}>
<a href="/plataforma/movil/conversacion" style={{ display: "flex", gap: "10px", padding: "12px 14px" }}><span style={{ fontSize: "12px", color: "var(--muted-2)", width: "36px", flex: "none" }}>10:42</span><span>Recepción reservó una cita para Laura M.</span></a>
<div style={{ display: "flex", gap: "10px", padding: "12px 14px", borderTop: "1px solid var(--line-soft)" }}><span style={{ fontSize: "12px", color: "var(--muted-2)", width: "36px", flex: "none" }}>10:15</span><span>Atención respondió 4 emails</span></div>
<div style={{ display: "flex", gap: "10px", padding: "12px 14px", borderTop: "1px solid var(--line-soft)" }}><span style={{ fontSize: "12px", color: "var(--muted-2)", width: "36px", flex: "none" }}>09:58</span><span>Aviso de stock bajo de guantes</span></div>
</div>
</section>
</main>

<nav aria-label="Principal" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "8px 6px 28px", background: "var(--paper)", borderTop: "1px solid var(--line)", fontSize: "11px", lineHeight: "14px", textAlign: "center" }}>
<a href="/plataforma/movil" aria-current="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", fontWeight: "500" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>Inicio</a>
<a href="/plataforma/movil/chats" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Chats</a>
<a href="/plataforma/movil/aprobaciones" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path></svg><span style={{ position: "absolute", top: "0", left: "55%", minWidth: "16px", height: "16px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "11px", lineHeight: "16px" }}><ApprovalsBadge /></span>Aprobar</a>
<a href="/plataforma/movil/agenda" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>Agenda</a>
<a href="/plataforma/movil/mas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>Más</a>
</nav>
</div>
</div></div>
  );
}
