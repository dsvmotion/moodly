import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="llamadas" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Llamadas. <span style={{ color: "#5f5f63" }}>Hoy: 42 atendidas, 0 perdidas.</span></h1>
<a href="/plataforma/configuracion/integraciones" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>Voz y saludo</a>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "2 1 360px", minWidth: "0", background: "#ffffff", borderRadius: "12px", overflow: "hidden", fontSize: "14px", lineHeight: "21px" }}>
<a href="#" data-demo="" style={{ display: "flex", gap: "12px", padding: "14px 16px", background: "#0000000d" }}><span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "#004c39", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path></svg></span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Sara Pérez</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>10:31 · 1:42</span></span><span style={{ display: "block", color: "#5f5f63" }}>Reservó revisión el martes 9:30</span></span></a>
<a href="#" data-demo="" style={{ display: "flex", gap: "12px", padding: "14px 16px", borderTop: "1px solid #0000000f" }}><span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "#004c39", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "12px" }}>✓</span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>+34 6•• ••• 447</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>10:12 · 0:58</span></span><span style={{ display: "block", color: "#5f5f63" }}>Preguntó horarios del sábado</span></span></a>
<a href="#" data-demo="" style={{ display: "flex", gap: "12px", padding: "14px 16px", borderTop: "1px solid #0000000f" }}><span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "12px" }}>→</span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Jorge López</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>09:47 · 2:10</span></span><span style={{ display: "block", color: "#5f5f63" }}>Pasada a Carmen: queja por una factura</span></span></a>
<a href="#" data-demo="" style={{ display: "flex", gap: "12px", padding: "14px 16px", borderTop: "1px solid #0000000f" }}><span style={{ width: "36px", height: "36px", borderRadius: "800px", background: "#004c39", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "12px" }}>✓</span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>Nuria Ferrer</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>09:20 · 1:05</span></span><span style={{ display: "block", color: "#5f5f63" }}>Confirmó la cita de hoy</span></span></a>
</section>

<section style={{ flex: "3 1 460px", minWidth: "0", background: "#ffffff", borderRadius: "12px", display: "flex", flexDirection: "column" }}>
<div style={{ padding: "20px 24px", borderBottom: "1px solid #0000000f", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
<span><span style={{ display: "block", fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Sara Pérez</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Hoy 10:31 · 1 min 42 s · atendida por Recepción</span></span>
<span style={{ display: "flex", gap: "8px" }}><a href="/plataforma/clientes" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", fontSize: "14px", lineHeight: "21px" }}>Ver ficha</a><button data-demo="" type="button" style={{ padding: "10px 16px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Devolver llamada</button></span>
</div>
<div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "#f4f4f5" }}><button data-demo="" type="button" aria-label="Reproducir grabación" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></button><span style={{ flex: "1", height: "4px", borderRadius: "800px", background: "#d4d4d8" }}><span style={{ display: "block", width: "30%", height: "4px", borderRadius: "800px", background: "#000000" }}></span></span><span style={{ fontSize: "12px", color: "#6b6b70" }}>0:31 / 1:42</span></div>
<div style={{ borderRadius: "12px", background: "#a3c2a7", padding: "14px 16px" }}><strong style={{ fontWeight: "500" }}>Resumen:</strong> Sara quería una revisión esta semana. Se le ofreció el martes a las 9:30 con el Dr. Vidal y aceptó.</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><span style={{ padding: "5px 10px", borderRadius: "800px", background: "#9dbecc", fontSize: "12px", lineHeight: "14px" }}>Calendar · Cita creada</span><span style={{ padding: "5px 10px", borderRadius: "800px", background: "#a3c2a7", fontSize: "12px", lineHeight: "14px" }}>CRM · Ficha actualizada</span><span style={{ padding: "5px 10px", borderRadius: "800px", background: "#f4f4f5", fontSize: "12px", lineHeight: "14px" }}>WhatsApp · Confirmación enviada</span></div>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
<span style={{ fontSize: "12px", color: "#6b6b70" }}>Transcripción</span>
<div style={{ display: "flex", gap: "12px" }}><span style={{ width: "64px", color: "#6b6b70", flex: "none" }}>Agente</span><span>Clínica Dental Sol, buenos días. Soy el asistente de la clínica, ¿en qué puedo ayudarte?</span></div>
<div style={{ display: "flex", gap: "12px" }}><span style={{ width: "64px", color: "#6b6b70", flex: "none" }}>Sara</span><span>Hola, quería pedir una revisión para esta semana si puede ser.</span></div>
<div style={{ display: "flex", gap: "12px" }}><span style={{ width: "64px", color: "#6b6b70", flex: "none" }}>Agente</span><span>Claro. Tengo el martes a las 9:30 o el jueves a las 18:00. ¿Cuál te va mejor?</span></div>
<div style={{ display: "flex", gap: "12px" }}><span style={{ width: "64px", color: "#6b6b70", flex: "none" }}>Sara</span><span>El martes.</span></div>
</div>
</div>
</section>
</div>
</main>
</div>
</>
  );
}
