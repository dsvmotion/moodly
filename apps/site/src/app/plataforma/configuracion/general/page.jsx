import { Fragment } from "react";
import SettingsNav from "@/components/settings-nav";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="general" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>General. <span style={{ color: "#5f5f63" }}>Tu negocio, tu marca y tus avisos.</span></h1>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
<h2 style={{ margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" }}>Contexto de la empresa</h2>
<span style={{ fontSize: "13px", lineHeight: "19px", color: "#5f5f63" }}>Lo que todos los agentes deben saber de tu negocio. Se usa en cada conversación, así que ve al grano: a qué os dedicáis, horarios, tono y lo que nunca deben hacer.</span>
<textarea rows={6} defaultValue={"Clínica Dental Sol, en el centro de [ciudad]. 3 profesionales. Horario: L-V 9:00–20:00. Tono cercano y tranquilo; tratamos de usted a mayores. Nunca damos consejo clínico por chat: ante dolor o urgencia, derivamos y, si hace falta, indicamos llamar al 112."} style={{ font: "400 14px/22px var(--font-body)", padding: "12px 14px", borderRadius: "12px", border: "1px solid #0000001a", resize: "vertical", color: "#000000" }} />
<span style={{ alignSelf: "flex-start", fontSize: "12px", color: "#6b6b70" }}>Esto es la base. Cada agente aprende además de las conversaciones (Memoria del negocio).</span>
</section>

<button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Guardar cambios</button>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<div style={{ flex: "3 1 480px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>

<section style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tu negocio</h2>
<div style={{ display: "flex", gap: "16px", alignItems: "center" }}><span style={{ width: "64px", height: "64px", borderRadius: "12px", background: "#f4f4f5", boxShadow: "inset 0 0 0 1px #0000001a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#6b6b70" }}>Logo</span><button data-demo="" type="button" style={{ padding: "9px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "400 14px/20px var(--font-display)" }}>Subir logo</button></div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ color: "#5f5f63" }}>Nombre comercial</span><input type="text" defaultValue="Clínica Dental Sol" style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/21px var(--font-display)", color: "#000000" }} /></label>
<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ color: "#5f5f63" }}>Sector</span><select style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/21px var(--font-display)", color: "#000000" }}><option>Clínica dental</option></select></label>
<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ color: "#5f5f63" }}>Teléfono</span><input type="tel" defaultValue="+34 910 000 210" style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/21px var(--font-display)", color: "#000000" }} /></label>
<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ color: "#5f5f63" }}>Web</span><input type="url" defaultValue="clinicadentalsol.es" style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/21px var(--font-display)", color: "#000000" }} /></label>
<label style={{ display: "flex", flexDirection: "column", gap: "6px", gridColumn: "1 / -1" }}><span style={{ color: "#5f5f63" }}>Datos fiscales para facturas</span><input type="text" defaultValue="Clínica Dental Sol S.L. · B12345678 · Calle Mayor 12, Madrid" style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/21px var(--font-display)", color: "#000000" }} /></label>
</div>
</section>

<section style={{ background: "#ffffff", borderRadius: "12px", overflowX: "auto", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ padding: "20px 24px 8px" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Avisos</h2><span style={{ color: "#5f5f63" }}>Qué te avisamos y por dónde.</span></div>
<table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px" }}>
<thead><tr style={{ textAlign: "left" }}><th style={{ padding: "10px 24px", fontWeight: "500" }}></th><th style={{ padding: "10px", fontWeight: "500" }}>App</th><th style={{ padding: "10px", fontWeight: "500" }}>Email</th><th style={{ padding: "10px 24px", fontWeight: "500" }}>WhatsApp</th></tr></thead>
<tbody>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Algo espera tu aprobación</td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="App" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 10px" }}><input type="checkbox" aria-label="Email" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 24px" }}><input type="checkbox" defaultChecked aria-label="WhatsApp" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Urgencias y quejas</td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="App" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="Email" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 24px" }}><input type="checkbox" defaultChecked aria-label="WhatsApp" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Una integración se desconecta</td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="App" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="Email" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 24px" }}><input type="checkbox" aria-label="WhatsApp" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Resumen semanal de resultados</td><td style={{ padding: "12px 10px" }}><input type="checkbox" aria-label="App" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 10px" }}><input type="checkbox" defaultChecked aria-label="Email" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td><td style={{ padding: "12px 24px" }}><input type="checkbox" aria-label="WhatsApp" style={{ accentColor: "#000000", width: "18px", height: "18px" }} /></td></tr>
</tbody>
</table>
</section>
</div>

<div style={{ flex: "2 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Marca en los mensajes</h2>
<span style={{ color: "#5f5f63" }}>Cómo firman tus agentes y el color del chat de tu web.</span>
<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ color: "#5f5f63" }}>Firma</span><input type="text" defaultValue="El equipo de Clínica Dental Sol" style={{ padding: "11px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/21px var(--font-display)", color: "#000000" }} /></label>
<span style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "#5f5f63" }}>Color del chat</span><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#004c39", boxShadow: "0 0 0 2px #ffffff, 0 0 0 4px #000000" }}></span><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#2457f5" }}></span><span style={{ width: "28px", height: "28px", borderRadius: "800px", background: "#000000" }}></span></span>
<span style={{ display: "flex", justifyContent: "space-between" }}><span>El agente se presenta como asistente</span><span style={{ color: "#004c39" }}>Sí</span></span>
</section>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Privacidad y datos</h2>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Guardar conversaciones</span><span style={{ padding: "2px 10px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>12 meses ⌄</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Registro de actividad</span><a href="#" data-demo="" style={{ color: "#2457f5" }}>Ver y descargar</a></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Contrato de tratamiento de datos</span><a href="#" data-demo="" style={{ color: "#2457f5" }}>Descargar</a></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Exportar todos los datos</span><a href="#" data-demo="" style={{ color: "#2457f5" }}>Exportar</a></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Eliminar cuenta y datos</span><a href="#" data-demo="" style={{ color: "#a30042" }}>Eliminar…</a></div>
</section>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tu cuenta</h2>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Verificación en dos pasos</span><span style={{ padding: "0 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39" }}>✓ Activada</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Idioma y zona horaria</span><span style={{ color: "#5f5f63" }}>Español · Madrid</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Sesiones abiertas</span><a href="#" data-demo="" style={{ color: "#2457f5" }}>2 dispositivos</a></div>
</section>
</div>
</div>
</main>
</div>
</>
  );
}
