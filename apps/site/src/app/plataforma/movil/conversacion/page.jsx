import { Fragment } from "react";

export default function Screen() {
  return (
    <div style={{ minHeight: "100vh", background: "#e9e9ec", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}><div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid #000000" }}>

<div style={{ width: "390px", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>

<header style={{ padding: "52px 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#ffffff", borderBottom: "1px solid #0000001a" }}>
<a href="/plataforma/movil/chats" aria-label="Volver" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg></a>
<span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "#a3c2a7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500", flex: "none" }}>LM</span>
<span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "16px", lineHeight: "20px", fontWeight: "500" }}>Laura M.</span><span style={{ display: "block", fontSize: "12px", lineHeight: "16px", color: "#6b6b70" }}>WhatsApp · Recepción</span></span>
<button data-demo="" type="button" style={{ padding: "8px 12px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 13px/14px var(--font-display)", minHeight: "36px" }}>Tomar control</button>
</header>

<main style={{ flex: "1", overflow: "hidden", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "20px" }}>
<div style={{ alignSelf: "center", fontSize: "12px", color: "#6b6b70" }}>Hoy</div>
<div style={{ alignSelf: "flex-start", background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "10px 12px", maxWidth: "80%" }}>Hola, ¿tenéis hueco para una limpieza dental esta semana?</div>
<div style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 12px", maxWidth: "80%" }}>¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?</div>
<div style={{ alignSelf: "flex-start", background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "10px 12px", maxWidth: "80%" }}>El jueves perfecto</div>
<div style={{ alignSelf: "flex-end", display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}><span style={{ padding: "5px 10px", borderRadius: "800px", background: "#9dbecc", fontSize: "12px", lineHeight: "14px" }}>Calendar · Cita creada</span><span style={{ padding: "5px 10px", borderRadius: "800px", background: "#a3c2a7", fontSize: "12px", lineHeight: "14px" }}>CRM · Actualizado</span></div>
<div style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 12px", maxWidth: "80%" }}>Hecho: jueves a las 10:30 con la Dra. Ruiz. Te enviaré un recordatorio el día antes.</div>
<div style={{ alignSelf: "flex-start", background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "10px 12px", maxWidth: "80%" }}>¿Me mandáis la factura de la última visita?</div>
<div style={{ borderRadius: "12px", background: "#ffe8d6", color: "#8e4e00", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
<span><strong style={{ fontWeight: "500" }}>Necesita tu aprobación.</strong> Administración ha preparado la factura F-0412.</span>
<span style={{ display: "flex", gap: "8px" }}><button data-demo="" type="button" style={{ flex: "1", minHeight: "44px", borderRadius: "800px", border: "1px solid #8e4e0040", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Ver</button><button data-demo="" type="button" style={{ flex: "2", minHeight: "44px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Aprobar y enviar</button></span>
</div>
</main>

<div style={{ padding: "10px 12px 30px", background: "#ffffff", borderTop: "1px solid #0000001a", display: "flex", gap: "8px", alignItems: "center" }}>
<label htmlFor="m-msg" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensaje</label>
<input id="m-msg" type="text" placeholder="Responde tú o pide algo al agente" style={{ flex: "1", minWidth: "0", padding: "12px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#f4f4f5", font: "400 14px/20px var(--font-display)", color: "#000000" }} />
<button data-demo="" type="button" aria-label="Enviar" style={{ width: "44px", height: "44px", borderRadius: "800px", border: "0", background: "#2457f5", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
</div>
</div>
</div></div>
  );
}
