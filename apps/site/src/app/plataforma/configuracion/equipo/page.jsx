import { Fragment } from "react";
import SettingsNav from "@/components/settings-nav";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="equipo" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Equipo y roles. <span style={{ color: "var(--muted)" }}>Cada persona ve lo que necesita.</span></h1>
<button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)" }}>Invitar a alguien</button>
</div>

<section style={{ background: "var(--paper)", borderRadius: "12px", overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "680px" }}>
<thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th style={{ padding: "12px 24px", fontWeight: "500" }}>Persona</th><th style={{ padding: "12px", fontWeight: "500" }}>Rol</th><th style={{ padding: "12px", fontWeight: "500" }}>Sedes</th><th style={{ padding: "12px", fontWeight: "500" }}>Avisos por</th><th style={{ padding: "12px 24px", fontWeight: "500" }}></th></tr></thead>
<tbody>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}><span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500" }}>MR</span><span><span style={{ display: "block", fontWeight: "500" }}>Marta Ruiz</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>marta@estudiobellezasol.es</span></span></span></td><td style={{ padding: "12px" }}><span title="El rol de la propietaria no se puede cambiar" style={{ padding: "4px 10px", borderRadius: "800px", background: "var(--canvas)", color: "var(--ink)", fontSize: "12px"  }}>Dueña · propietaria</span></td><td style={{ padding: "12px" }}>Todas</td><td style={{ padding: "12px" }}>App · WhatsApp</td><td style={{ padding: "12px 24px", textAlign: "right", color: "var(--muted-2)" }}>Tú</td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}><span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "var(--mist)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500" }}>JV</span><span><span style={{ display: "block", fontWeight: "500" }}>Javier Vidal</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>javier@estudiobellezasol.es</span></span></span></td><td style={{ padding: "12px" }}><select aria-label="Rol" defaultValue="Gerente" style={{ appearance: "auto", border: "1px solid var(--line)", borderRadius: "800px", background: "var(--paper)", padding: "6px 10px", font: "400 13px/16px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}><option value="Dueña">Dueña</option><option value="Gerente">Gerente</option><option value="Recepción">Recepción</option><option value="Profesional">Profesional</option></select></td><td style={{ padding: "12px" }}>Centro, Norte</td><td style={{ padding: "12px" }}>App · Email</td><td style={{ padding: "12px 24px", textAlign: "right" }}><a href="#" data-demo="" style={{ color: "var(--blue-fg)" }}>Editar</a></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}><span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500" }}>CL</span><span><span style={{ display: "block", fontWeight: "500" }}>Carmen López</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>carmen@estudiobellezasol.es</span></span></span></td><td style={{ padding: "12px" }}><select aria-label="Rol" defaultValue="Recepción" style={{ appearance: "auto", border: "1px solid var(--line)", borderRadius: "800px", background: "var(--paper)", padding: "6px 10px", font: "400 13px/16px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}><option value="Dueña">Dueña</option><option value="Gerente">Gerente</option><option value="Recepción">Recepción</option><option value="Profesional">Profesional</option></select></td><td style={{ padding: "12px" }}>Centro</td><td style={{ padding: "12px" }}>App</td><td style={{ padding: "12px 24px", textAlign: "right" }}><a href="#" data-demo="" style={{ color: "var(--blue-fg)" }}>Editar</a></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}><span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "var(--sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500" }}>?</span><span><span style={{ display: "block", fontWeight: "500" }}>lucia@estudiobellezasol.es</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Invitación enviada hace 2 días</span></span></span></td><td style={{ padding: "12px" }}><select aria-label="Rol" defaultValue="Profesional" style={{ appearance: "auto", border: "1px solid var(--line)", borderRadius: "800px", background: "var(--paper)", padding: "6px 10px", font: "400 13px/16px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}><option value="Dueña">Dueña</option><option value="Gerente">Gerente</option><option value="Recepción">Recepción</option><option value="Profesional">Profesional</option></select></td><td style={{ padding: "12px" }}>Norte</td><td style={{ padding: "12px", color: "var(--muted-2)" }}>–</td><td style={{ padding: "12px 24px", textAlign: "right" }}><a href="#" data-demo="" style={{ color: "var(--blue-fg)" }}>Reenviar</a></td></tr>
</tbody>
</table>
</section>

<section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Qué puede hacer cada rol</h2>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ background: "var(--ink)", color: "var(--on-ink)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "16px", fontWeight: "500" }}>Dueño</span><span style={{ opacity: ".75" }}>Todo, incluidos plan, pagos, agentes y equipo.</span></div>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "16px", fontWeight: "500" }}>Gerente</span><span style={{ color: "var(--muted)" }}>Aprueba facturas y cambios de agenda, ve informes y ajusta reglas.</span></div>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "16px", fontWeight: "500" }}>Recepción</span><span style={{ color: "var(--muted)" }}>Conversaciones, agenda y clientes. Puede tomar el control de un chat.</span></div>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "16px", fontWeight: "500" }}>Profesional</span><span style={{ color: "var(--muted)" }}>Solo su agenda y los avisos de quejas o traspasos.</span></div>
</div>
<a href="#" data-demo="" style={{ alignSelf: "flex-start", fontSize: "14px", color: "var(--blue-fg)" }}>Crear un rol personalizado</a>
</section>
</main>
</div>
</>
  );
}
