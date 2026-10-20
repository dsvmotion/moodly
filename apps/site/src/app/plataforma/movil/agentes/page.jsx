"use client";
import { Fragment, useState } from "react";
import ApprovalsBadge from "@/components/approvals-badge";

export default function Screen() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const list = [
{ id: 'recepcion', name: 'Recepción', color: '#004c39', today: 'Hoy: 14 citas reservadas, 9 llamadas' },
{ id: 'atencion', name: 'Atención al cliente', color: '#9dbecc', today: 'Hoy: 31 mensajes respondidos' },
{ id: 'comercial', name: 'Comercial', color: '#a30042', today: 'Hoy: 4 seguimientos de presupuesto' },
{ id: 'admin', name: 'Administración', color: '#8e4e00', today: 'Hoy: 6 facturas preparadas' }
];
const on = (this.state && this.state.on) || { recepcion: true, atencion: true, comercial: false, admin: true };
return { agents: list.map((a) => ({ ...a, on: !!on[a.id], off: !on[a.id], toggle: () => this.setState({ on: { ...on, [a.id]: !on[a.id] } }) })) };
}.call(ctx);
  const { agents } = vals;
  return (
    <div style={{ minHeight: "100vh", background: "#e9e9ec", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}><div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid #000000" }}>

<div style={{ width: "390px", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<header style={{ padding: "52px 12px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
<a href="/plataforma/movil/mas" aria-label="Volver" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg></a>
<h1 style={{ flex: "1", margin: "0", fontSize: "20px", lineHeight: "24px", fontWeight: "400", letterSpacing: "-0.4px" }}>Agentes</h1>
</header>
<main style={{ flex: "1", overflow: "hidden", padding: "4px 16px 12px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "20px" }}>
<span style={{ color: "#5f5f63" }}>Pausa un agente si lo necesitas. Sus skills y reglas se ajustan desde el ordenador.</span>
{(agents).map((a, $index) => (<Fragment key={$index}>
<div style={{ background: "#ffffff", borderRadius: "12px", padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
<span style={{ width: "44px", height: "44px", borderRadius: "800px", background: a.color, flex: "none" }}></span>
<span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "15px", fontWeight: "500" }}>{a.name}</span><span style={{ display: "block", fontSize: "12px", color: "#6b6b70" }}>{a.today}</span>
{(a.on) ? (<><span style={{ display: "inline-block", marginTop: "4px", padding: "0 8px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px", lineHeight: "20px" }}>● Activo</span></>) : null}
{(a.off) ? (<><span style={{ display: "inline-block", marginTop: "4px", padding: "0 8px", borderRadius: "800px", background: "#ebebed", color: "#5f5f63", fontSize: "12px", lineHeight: "20px" }}>○ En pausa</span></>) : null}</span>
{(a.on) ? (<><button type="button" role="switch" aria-checked="true" aria-label={a.name} onClick={a.toggle} style={{ width: "48px", height: "30px", borderRadius: "800px", border: "0", background: "#000000", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "24px", height: "24px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
{(a.off) ? (<><button type="button" role="switch" aria-checked="false" aria-label={a.name} onClick={a.toggle} style={{ width: "48px", height: "30px", borderRadius: "800px", border: "0", background: "#d4d4d8", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "24px", height: "24px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
</div>
</Fragment>))}
</main>
<nav aria-label="Principal" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "8px 6px 28px", background: "#ffffff", borderTop: "1px solid #0000001a", fontSize: "11px", lineHeight: "14px", textAlign: "center" }}>
<a href="/plataforma/movil" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "#5f5f63", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5f5f63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>Inicio</a>
<a href="/plataforma/movil/chats" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "#5f5f63", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5f5f63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Chats</a>
<a href="/plataforma/movil/aprobaciones" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "#5f5f63", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5f5f63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path></svg><span style={{ position: "absolute", top: "0", left: "56%", minWidth: "16px", height: "16px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "11px", lineHeight: "16px" }}><ApprovalsBadge /></span>Aprobar</a>
<a href="/plataforma/movil/agenda" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "#5f5f63", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5f5f63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>Agenda</a>
<a href="/plataforma/movil/mas" aria-current="page" style={{ fontWeight: "500", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "#000000", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>Más</a>
</nav>
</div>
</div></div>
  );
}
