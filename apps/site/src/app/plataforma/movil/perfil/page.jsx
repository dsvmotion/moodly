"use client";
import { useState } from "react";
import ApprovalsBadge from "@/components/approvals-badge";

export default function Screen() {
  const [twofa, setTwofa] = useState(true);
  const [lang, setLang] = useState("es");
  const [push, setPush] = useState({ aprobaciones: true, urgencias: true, resumen: false });
  const Switch = ({ on, onClick, label }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "44px", height: "26px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#004c39" : "var(--track-2)", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}><span style={{ width: "20px", height: "20px", borderRadius: "800px", background: "var(--paper)" }} /></button>
  );
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px" };
  return (
    <div style={{ minHeight: "100vh", background: "var(--backdrop)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}><div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid var(--ink)" }}>

<div style={{ width: "390px", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<header style={{ padding: "52px 12px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
<a href="/plataforma/movil/ajustes" aria-label="Volver" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg></a>
<h1 style={{ flex: "1", margin: "0", fontSize: "20px", lineHeight: "24px", fontWeight: "400", letterSpacing: "-0.4px" }}>Mi perfil</h1>
</header>
<main style={{ flex: "1", overflowY: "auto", padding: "4px 16px 12px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "20px" }}>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "16px", display: "flex", gap: "14px", alignItems: "center" }}>
<span style={{ width: "52px", height: "52px", borderRadius: "800px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "500", flex: "none" }}>MR</span>
<span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "16px", fontWeight: "500" }}>Marta Ruiz</span><span style={{ color: "var(--muted-2)" }}>marta@clinicadentalsol.es</span><span style={{ color: "var(--muted-2)" }}>Dueña · todas las sedes</span></span>
</div>
<span style={{ padding: "0 4px", fontSize: "12px", color: "var(--muted-2)" }}>Avisos en este móvil</span>
<div style={{ background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
<div style={row}><span>Tareas para aprobar</span><Switch label="Tareas para aprobar" on={push.aprobaciones} onClick={() => setPush({ ...push, aprobaciones: !push.aprobaciones })} /></div>
<div style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Urgencias y quejas</span><Switch label="Urgencias y quejas" on={push.urgencias} onClick={() => setPush({ ...push, urgencias: !push.urgencias })} /></div>
<div style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Resumen diario</span><Switch label="Resumen diario" on={push.resumen} onClick={() => setPush({ ...push, resumen: !push.resumen })} /></div>
</div>
<span style={{ padding: "0 4px", fontSize: "12px", color: "var(--muted-2)" }}>Cuenta</span>
<div style={{ background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
<label style={row}><span>Idioma</span><select value={lang} onChange={(e) => setLang(e.target.value)} style={{ border: 0, background: "transparent", font: "400 14px/20px var(--font-display)", color: "var(--muted)" }}><option value="es">Español</option><option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label>
<div style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Verificación en dos pasos</span><Switch label="Verificación en dos pasos" on={twofa} onClick={() => setTwofa(!twofa)} /></div>
<a href="/plataforma/configuracion/perfil" style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Más ajustes del perfil</span><span style={{ color: "var(--muted-2)" }}>Escritorio ›</span></a>
</div>
<a href="/es" style={{ marginTop: "4px", textAlign: "center", padding: "12px", borderRadius: "800px", background: "var(--paper)", color: "var(--rose-fg)" }}>Cerrar sesión</a>
</main>
<nav aria-label="Principal" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "8px 6px 28px", background: "var(--paper)", borderTop: "1px solid var(--line)", fontSize: "11px", lineHeight: "14px", textAlign: "center" }}>
<a href="/plataforma/movil" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>Inicio</a>
<a href="/plataforma/movil/chats" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Chats</a>
<a href="/plataforma/movil/aprobaciones" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path></svg><span style={{ position: "absolute", top: "0", left: "56%", minWidth: "16px", height: "16px", borderRadius: "800px", background: "#ff6301", color: "var(--ink)", fontSize: "11px", lineHeight: "16px" }}><ApprovalsBadge /></span>Aprobar</a>
<a href="/plataforma/movil/agenda" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>Agenda</a>
<a href="/plataforma/movil/mas" aria-current="page" style={{ fontWeight: "500", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--ink)", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>Más</a>
</nav>
</div>
</div></div>
  );
}
