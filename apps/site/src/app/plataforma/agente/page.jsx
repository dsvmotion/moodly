"use client";
import { Fragment, useState } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const base = [
{ id: 'reservar', name: 'Reservar citas', desc: 'Ofrece huecos libres y crea la cita en Calendar.', approval: false },
{ id: 'reprogramar', name: 'Reprogramar y cancelar', desc: 'Mueve citas a petición del paciente.', approval: false },
{ id: 'recordatorios', name: 'Recordatorios 24 h antes', desc: 'Por WhatsApp, con confirmación de asistencia.', approval: false },
{ id: 'espera', name: 'Lista de espera', desc: 'Avisa a pacientes en espera cuando se libera un hueco.', approval: false },
{ id: 'llamadas', name: 'Atender llamadas', desc: 'Contesta, reserva y pasa la llamada si hace falta.', approval: false },
{ id: 'masivo', name: 'Mover citas en bloque', desc: 'Reorganiza la agenda ante bajas o cierres.', approval: true },
{ id: 'resenas', name: 'Pedir reseña tras la visita', desc: 'Envía un enlace a Google Reviews al día siguiente.', approval: false }
];
const defaults = { reservar: true, reprogramar: true, recordatorios: true, espera: true, llamadas: true, masivo: true, resenas: false };
const st = (this.state && this.state.on) || defaults;
const skills = base.map((s) => ({ ...s, on: !!st[s.id], off: !st[s.id], toggle: () => this.setState({ on: { ...st, [s.id]: !st[s.id] } }) }));
return { skills, activeCount: skills.filter((s) => s.on).length, totalCount: skills.length };
}.call(ctx);
  const { activeCount, skills, totalCount } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>

<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
<div style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}><a href="#" data-demo="" style={{ color: "#5f5f63" }}>Agentes</a> / Recepción</div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
<div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
<span style={{ width: "56px", height: "56px", borderRadius: "800px", background: "#004c39", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg></span>
<div><h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Recepción</h1><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Citas, agenda y llamadas · Plantilla Clínicas</span></div>
</div>
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
<span style={{ padding: "6px 12px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "14px", lineHeight: "14px" }}>● Activo</span>
<button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Pausar agente</button>
<button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Guardar cambios</button>
</div>
</div>

<div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #0000001a", fontSize: "14px", lineHeight: "21px", overflowX: "auto" }} role="tablist" aria-label="Configuración">
<button data-demo="" type="button" role="tab" aria-selected="true" style={{ padding: "10px 14px", border: "0", borderBottom: "2px solid #000000", background: "transparent", font: "500 14px/21px var(--font-display)", color: "#000000" }}>Skills</button>
<button data-demo="" type="button" role="tab" aria-selected="false" style={{ padding: "10px 14px", border: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "#5f5f63" }}>Tono</button>
<button data-demo="" type="button" role="tab" aria-selected="false" style={{ padding: "10px 14px", border: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "#5f5f63" }}>Reglas y aprobaciones</button>
<button data-demo="" type="button" role="tab" aria-selected="false" style={{ padding: "10px 14px", border: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "#5f5f63" }}>Canales</button>
<button data-demo="" type="button" role="tab" aria-selected="false" style={{ padding: "10px 14px", border: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "#5f5f63" }}>Historial</button>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "3 1 460px", minWidth: "0", background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #0000000f", gap: "12px", flexWrap: "wrap" }}>
<div><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Skills</h2><span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{activeCount} de {totalCount} activas · Configuradas de serie para clínicas</span></div>
<button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>+ Skill personalizada</button>
</div>
{(skills).map((s, $index) => (<Fragment key={$index}>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #0000000f" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}>{s.name}</div>
<div style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{s.desc}</div>
</div>
{(s.approval) ? (<><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" }}>Con aprobación</span></>) : null}
{(s.on) ? (<>
<button type="button" role="switch" aria-checked="true" aria-label={s.name} onClick={s.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#000000", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button>
</>) : null}
{(s.off) ? (<>
<button type="button" role="switch" aria-checked="false" aria-label={s.name} onClick={s.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#d4d4d8", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button>
</>) : null}
</div>
</Fragment>))}
</section>

<div style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tono</h2>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<span style={{ padding: "8px 14px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "14px" }}>Cercano</span>
<span style={{ padding: "8px 14px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", fontSize: "14px", lineHeight: "14px" }}>Formal</span>
<span style={{ padding: "8px 14px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", fontSize: "14px", lineHeight: "14px" }}>Breve</span>
</div>
<div style={{ background: "#f4f4f5", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>“¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?”</div>
</section>
<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 4px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Canales</h2>
<div style={{ display: "flex", justifyContent: "space-between" }}><span>WhatsApp Business</span><span style={{ color: "#004c39" }}>Conectado</span></div>
<div style={{ display: "flex", justifyContent: "space-between" }}><span>Teléfono (voz)</span><span style={{ color: "#004c39" }}>Conectado</span></div>
<div style={{ display: "flex", justifyContent: "space-between" }}><span>Google Calendar</span><span style={{ color: "#004c39" }}>Conectado</span></div>
<div style={{ display: "flex", justifyContent: "space-between" }}><span>Instagram</span><a href="/plataforma/configuracion/integraciones" style={{ color: "#2457f5" }}>Conectar</a></div>
</section>
<section style={{ borderRadius: "12px", background: "#9dbecc", padding: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Lo que sabe de tu negocio</h2>
<span>Horario: L–V 9:00–20:00 · 2 sedes · 4 profesionales · 5 servicios con precio.</span>
<a href="/plataforma/memoria" style={{ fontWeight: "500" }}>Editar memoria →</a>
</section>
</div>
</div>
</main>
</div>
</>
  );
}
