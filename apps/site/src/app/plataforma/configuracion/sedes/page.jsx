import { Fragment } from "react";
import SettingsNav from "@/components/settings-nav";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="sedes" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Sedes. <span style={{ color: "var(--muted)" }}>Toda la cadena de un vistazo.</span></h1>
<div style={{ display: "flex", gap: "8px" }}><span style={{ padding: "11px 16px", borderRadius: "800px", background: "var(--paper)", fontSize: "14px", lineHeight: "21px" }}>Este mes</span><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)" }}>Añadir sede</button></div>
</div>

<div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 260px", borderRadius: "12px", background: "var(--ink)", color: "var(--on-ink)", padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "14px", opacity: ".75" }}>Toda la cadena · 2 sedes</span><span style={{ fontSize: "40px", lineHeight: "44px", letterSpacing: "-1.6px" }}>670</span><span style={{ fontSize: "14px", opacity: ".75" }}>conversaciones atendidas</span></div>
<div style={{ flex: "2 1 420px", borderRadius: "12px", background: "var(--amber-bg)", color: "var(--amber-fg)", padding: "22px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>Necesita atención</span><span><strong style={{ fontWeight: "500" }}>Sede Norte:</strong> 2 aprobaciones esperan tu revisión.</span><span><strong style={{ fontWeight: "500" }}>Google Calendar:</strong> hay que reconectarlo; afecta a la agenda de Centro.</span></div>
</div>

<section style={{ background: "var(--paper)", borderRadius: "12px", overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "760px" }}>
<thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th style={{ padding: "12px 24px", fontWeight: "500" }}>Sede</th><th style={{ padding: "12px", fontWeight: "500" }}>Agentes</th><th style={{ padding: "12px", fontWeight: "500" }}>Conversaciones</th><th style={{ padding: "12px", fontWeight: "500" }}>Citas</th><th style={{ padding: "12px", fontWeight: "500" }}>Ocupación</th><th style={{ padding: "12px", fontWeight: "500" }}>Pendiente</th><th style={{ padding: "12px 24px", fontWeight: "500" }}>Estado</th></tr></thead>
<tbody>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "14px 24px", fontWeight: "500" }}>Centro</td><td style={{ padding: "14px 12px" }}><span style={{ display: "inline-flex", gap: "3px" }}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "#004c39" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "var(--mist)" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "#a30042" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "#8e4e00" }}></span></span></td><td style={{ padding: "14px 12px" }}>427</td><td style={{ padding: "14px 12px" }}>427</td><td style={{ padding: "14px 12px" }}><span style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "80px", height: "6px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: "86%", height: "6px", borderRadius: "800px", background: "var(--ink)" }}></span></span>86 %</span></td><td style={{ padding: "14px 12px" }}>3</td><td style={{ padding: "14px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>! Reconectar Calendar</span></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "14px 24px", fontWeight: "500" }}>Norte</td><td style={{ padding: "14px 12px" }}><span style={{ display: "inline-flex", gap: "3px" }}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "#004c39" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "var(--mist)" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: "var(--coral)" }}></span></span></td><td style={{ padding: "14px 12px" }}>243</td><td style={{ padding: "14px 12px" }}>211</td><td style={{ padding: "14px 12px" }}><span style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "80px", height: "6px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: "72%", height: "6px", borderRadius: "800px", background: "var(--ink)" }}></span></span>72 %</span></td><td style={{ padding: "14px 12px" }}>2</td><td style={{ padding: "14px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>! Revisar</span></td></tr>
</tbody>
</table>
</section>

<section style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ flex: "1 1 360px" }}><span style={{ display: "block", fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px", marginBottom: "6px" }}>Plantillas de la cadena</span><span style={{ color: "var(--muted)" }}>Configura un agente una vez (tono, reglas, flujos) y aplícalo a todas las sedes. Cada sede mantiene su agenda y sus horarios.</span></span>
<span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><span style={{ padding: "9px 14px", borderRadius: "800px", background: "var(--canvas)" }}>Recepción · 2 sedes</span><span style={{ padding: "9px 14px", borderRadius: "800px", background: "var(--canvas)" }}>Atención · 2 sedes</span><a href="#" data-demo="" style={{ padding: "9px 14px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)" }}>Gestionar plantillas</a></span>
</section>
</main>
</div>
</>
  );
}
