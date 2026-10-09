"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";

// Asistente / orquestador: el copiloto del OWNER y su equipo para gestionar la
// plataforma. Distinto de los 4 agentes (que atienden a los clientes del
// negocio): este trabaja PARA ti, dentro de Moodly. Propone y, con tu OK,
// ejecuta cambios de ajustes, lanza tareas, diagnostica y recomienda.
// TODO(backend): meta-agente con acceso a acciones de plataforma, limitado por
// rol, con confirmación de acciones sensibles y registro en audit_logs.
const EXAMPLES = [
  {
    cat: "Configurar", q: "Pon un tope de gasto de 200 € al mes y avísame al 80 %.",
    a: "Hecho. Esto es lo que voy a aplicar en Modelos › Consumo:",
    chip: "Configuración", chipBg: "#e8edff", chipFg: "#2457f5",
    title: "Tope de gasto → 200 €/mes · aviso al 80 %",
    detail: "Al llegar al límite, el uso pasa al equipo en vez de cortarse.",
    buttons: [["Revisar", false], ["Aplicar", true]],
  },
  {
    cat: "Operar", q: "Recuérdale por WhatsApp a los pacientes con cita mañana.",
    a: "Preparo 12 recordatorios para mañana con la plantilla aprobada «Recordatorio de cita 24 h».",
    chip: "Recepción", chipBg: "#dcebdd", chipFg: "#004c39",
    title: "Programar 12 recordatorios · mañana 09:00",
    detail: "Plantilla aprobada por Meta. Puedes revisar la lista antes de enviar.",
    buttons: [["Ver lista", false], ["Aprobar y programar", true]],
  },
  {
    cat: "Diagnosticar", q: "¿Por qué no se ha enviado la factura F-0412?",
    a: "Está pendiente de tu aprobación desde las 11:02. Administración la preparó (75,00 €) pero nadie la ha aprobado todavía.",
    chip: "Diagnóstico", chipBg: "#ffe8d6", chipFg: "#8e4e00",
    title: "Factura F-0412 · pendiente de aprobación",
    detail: "Tu regla pide tu visto bueno para enviar facturas. Puedes aprobarla aquí.",
    buttons: [["Ir a Aprobaciones", false], ["Aprobar y enviar", true]],
  },
  {
    cat: "Mejorar", q: "¿Cómo configuro mejor el agente de Atención?",
    a: "Por cómo trabajáis, te recomiendo tres ajustes que suelen subir la resolución:",
    chip: "Recomendación", chipBg: "#f6f2e8", chipFg: "#8e4e00",
    title: "3 mejoras para Atención al cliente",
    detail: "Activar memoria del negocio · subir tus FAQ a Conocimiento · limitar respuestas fuera de horario.",
    buttons: [["Ver detalle", false], ["Prepararlo", true]],
  },
];
const CAPS = [
  ["Configura", "Cambia ajustes, reglas, modelos e integraciones por ti."],
  ["Opera", "Lanza tareas: recordatorios, respuestas, informes, reservas."],
  ["Diagnostica", "Encuentra por qué algo no pasó y te propone la solución."],
  ["Enseña", "Te recomienda la mejor configuración para tu negocio."],
];

export default function Asistente() {
  const [sel, setSel] = useState(0);
  const ex = EXAMPLES[sel];
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="asistente" /></div>

      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "720px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "12px", lineHeight: "16px" }}>✦ Asistente de Moodly</span>
          <h1 style={{ margin: "6px 0 0", fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px" }}>Tu copiloto para gestionar la plataforma. <span style={{ color: "#5f5f63" }}>Pídele tareas, ajustes o que te eche una mano.</span></h1>
        </div>

        {/* Conversación de ejemplo */}
        <section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "#000000", color: "#ffffff", borderRadius: "14px", padding: "10px 14px", fontSize: "14px", lineHeight: "21px", fontFamily: "var(--font-body)" }}>{ex.q}</div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "#000000", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "14px" }}>✦</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                <div style={{ fontSize: "14px", lineHeight: "21px", fontFamily: "var(--font-body)" }}>{ex.a}</div>
                <div style={{ border: "1px solid #0000001a", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
                  <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "800px", background: ex.chipBg, color: ex.chipFg, fontSize: "12px", lineHeight: "16px" }}>{ex.chip}</span>
                  <span style={{ fontSize: "15px", fontWeight: 500 }}>{ex.title}</span>
                  <span style={{ fontSize: "13px", lineHeight: "20px", color: "#5f5f63", fontFamily: "var(--font-body)" }}>{ex.detail}</span>
                  <span style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                    {ex.buttons.map(([label, dark]) => (
                      <button key={label} data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>{label}</button>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* Input */}
          <div style={{ borderTop: "1px solid #0000000f", padding: "16px 24px", display: "flex", gap: "12px", alignItems: "center" }}>
            <label htmlFor="ask" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Pídele algo al asistente</label>
            <input id="ask" type="text" placeholder="Pídele algo al asistente: un cambio, una tarea, una duda…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "400 14px/21px var(--font-body)", color: "#000000" }} />
            <button data-demo="" type="button" aria-label="Enviar" style={{ width: "36px", height: "36px", borderRadius: "800px", border: 0, background: "#2457f5", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </section>

        {/* Ejemplos de prompt */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {EXAMPLES.map((e, i) => (
            <button key={e.cat} type="button" aria-pressed={i === sel} onClick={() => setSel(i)} style={{ padding: "8px 14px", borderRadius: "800px", border: i === sel ? "1px solid #000000" : "1px solid #0000001a", background: i === sel ? "#000000" : "#ffffff", color: i === sel ? "#ffffff" : "#000000", font: "400 14px/18px var(--font-display)", cursor: "pointer" }}>
              <span style={{ opacity: 0.6 }}>{e.cat}:</span> {e.q.length > 42 ? e.q.slice(0, 42) + "…" : e.q}
            </button>
          ))}
        </div>

        {/* Qué sabe hacer */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {CAPS.map(([t, d]) => (
            <div key={t} style={{ background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "15px", fontWeight: 500 }}>{t}</span>
              <span style={{ fontSize: "13px", lineHeight: "20px", color: "#5f5f63", fontFamily: "var(--font-body)" }}>{d}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", borderRadius: "12px", background: "#f6f2e8", padding: "14px 18px", fontSize: "14px", lineHeight: "21px", fontFamily: "var(--font-body)" }}>
          <span aria-hidden="true">🔒</span>
          <span><strong style={{ fontWeight: 500, fontFamily: "var(--font-display)" }}>Con tus reglas.</strong> El asistente respeta tu rol y el techo de autonomía: los cambios sensibles (dinero, seguridad, borrar) necesitan tu visto bueno y todo queda en el registro de actividad.</span>
        </div>
      </main>
    </div>
  );
}
