"use client";
import { Fragment, useState } from "react";
import { SUBSECTORS, VERTICALS } from "@/components/verticals";

// Integraciones que solemos conectar primero en cada vertical.
const TYPICAL = { salud: "WhatsApp, Google Calendar y Doctoralia", hosteleria: "WhatsApp, TheFork o Booking.com y tu TPV", inmobiliario: "WhatsApp, Gmail y tu CRM inmobiliario", profesionales: "Gmail, Google Drive y tu programa de contabilidad", retail: "WhatsApp, Instagram y tu tienda online", hogar: "WhatsApp, teléfono y tu programa de presupuestos", automocion: "WhatsApp, teléfono y tu CRM o DMS", educacion: "WhatsApp, Instagram y tu sistema de reservas", otro: "WhatsApp, email y calendario" };

export default function Screen() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const s = this.state || {};
const step = s.step || 1;
const sector = s.sector || 'salud';
const subIdx = s.sub || 0;
const sectorList = VERTICALS.map((v) => ({ id: v.id, label: v.name, hint: v.subsectors.slice(0, 4).join(', ') })).concat([{ id: 'otro', label: 'Otro', hint: 'Cuéntanos y lo configuramos contigo' }]);
const subs = SUBSECTORS[sector] || [];
const sub = subs[subIdx] || subs[0];
const vert = VERTICALS.find((v) => v.id === sector);
const connected = s.connected || { whatsapp: true };
const agentsOn = s.agentsOn || { recepcion: true, atencion: true, comercial: false, admin: true };
const toolList = [
{ id: 'whatsapp', short: 'WA', name: 'WhatsApp Business', use: 'Mensajes con clientes' },
{ id: 'google', short: 'G', name: 'Google Workspace', use: 'Gmail y Calendar' },
{ id: 'microsoft', short: 'MS', name: 'Microsoft 365', use: 'Outlook y calendario' },
{ id: 'crm', short: 'CRM', name: 'Tu CRM', use: 'Fichas de clientes y leads' },
{ id: 'facturacion', short: '€', name: 'Tu facturación', use: 'Facturas y cobros' },
{ id: 'telefono', short: 'Tel', name: 'Línea de teléfono', use: 'Llamadas de voz' }
];
const agentList = [
{ id: 'recepcion', name: 'Recepción', desc: 'Citas, agenda y llamadas de voz.', color: 'moss' },
{ id: 'atencion', name: 'Atención al cliente', desc: 'WhatsApp, email y redes.', color: 'mist' },
{ id: 'comercial', name: 'Comercial', desc: 'CRM, leads y seguimiento.', color: 'sand' },
{ id: 'admin', name: 'Administración', desc: 'Facturación e inventario.', color: 'dusk' }
];
const labels = ['Tu negocio', 'Herramientas', 'Agentes', 'Activar'];
const skills = (k) => vert ? vert.skills[k].slice(0, 2).join(' · ') + '.' : null;
const agentNames = { recepcion: 'Recepción', atencion: 'Atención al cliente', comercial: 'Comercial', admin: 'Administración' };
const toolNames = { whatsapp: 'WhatsApp Business', google: 'Google Workspace', microsoft: 'Microsoft 365', crm: 'Tu CRM', facturacion: 'Tu facturación', telefono: 'Línea de teléfono' };
const connectedList = Object.keys(connected).filter((k) => connected[k]).map((k) => toolNames[k] || k);
const agentsOnList = Object.keys(agentsOn).filter((k) => agentsOn[k]).map((k) => agentNames[k] || k);
// Checklist de puesta en marcha: lo que el backend ejecutará al activar.
const golive = [
{ label: 'Sector y skills configurados', ok: true, hint: sub ? sub[1] : sector },
{ label: 'Al menos un canal conectado', ok: connectedList.length > 0, hint: connectedList.join(', ') || 'Conecta WhatsApp o email' },
{ label: 'Contexto del negocio cargado', ok: !!s.context, hint: s.context ? 'Listo' : 'Añade horarios, tono y qué no deben hacer' },
{ label: 'Al menos un agente elegido', ok: agentsOnList.length > 0, hint: agentsOnList.join(', ') || 'Activa un agente' },
{ label: 'Prueba en modo pruebas', ok: !!s.tested, hint: s.tested ? 'Probado' : 'Envía un mensaje de prueba antes de ir en vivo' },
];
const canGoLive = golive.every((g) => g.ok);
return {
steps: labels.map((label, i) => ({ n: i + 1, label, current: step === i + 1, done: step > i + 1, todo: step < i + 1 })),
isStep1: step === 1, isStep2: step === 2, isStep3: step === 3, isStep4: step === 4,
canBack: step > 1, noBack: step === 1, notLast: step < 4,
golive, canGoLive,
hasContext: !!s.context, addContext: () => this.setState({ context: true }),
hasTested: !!s.tested, runTest: () => this.setState({ tested: true }),
next: () => this.setState({ step: Math.min(4, step + 1) }),
back: () => this.setState({ step: Math.max(1, step - 1) }),
sectorName: sub ? sub[1] : 'tu negocio',
typical: TYPICAL[sector],
hasSubs: subs.length > 0,
subOptions: subs.map((x, i) => ({ label: x[0], sel: i === subIdx, unsel: i !== subIdx, pick: () => this.setState({ sub: i }) })),
sectors: sectorList.map((x) => ({ ...x, sel: x.id === sector, unsel: x.id !== sector, pick: () => this.setState({ sector: x.id, sub: 0 }) })),
tools: toolList.map((t) => ({ ...t, on: !!connected[t.id], off: !connected[t.id], connect: () => this.setState({ connected: { ...connected, [t.id]: true } }) })),
agents: agentList.map((a) => ({ ...a, desc: skills(a.id === 'admin' ? 'administracion' : a.id) || a.desc, on: !!agentsOn[a.id], off: !agentsOn[a.id], isMoss: a.color === 'moss', isMist: a.color === 'mist', isSand: a.color === 'sand', isDusk: a.color === 'dusk', toggle: () => this.setState({ agentsOn: { ...agentsOn, [a.id]: !agentsOn[a.id] } }) }))
};
}.call(ctx);
  const { addContext, agents, back, canBack, canGoLive, golive, hasContext, hasSubs, hasTested, isStep1, isStep2, isStep3, isStep4, next, noBack, notLast, runTest, sectorName, sectors, steps, subOptions, tools, typical } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

<header style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid #0000000f" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "500", letterSpacing: "-0.3px" }}><img src="/brand/moodly-logo-black.svg" alt="Moodly" width="78" height="20" style={{ display: "block" }} /></span>
<ol style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "14px", lineHeight: "14px" }}>
{(steps).map((st, $index) => (<Fragment key={$index}>
{(st.current) ? (<><li style={{ padding: "8px 14px", borderRadius: "800px", background: "#000000", color: "#ffffff" }} aria-current="step">{st.n} · {st.label}</li></>) : null}
{(st.done) ? (<><li style={{ padding: "8px 14px", borderRadius: "800px", background: "#dcebdd", color: "#004c39" }}>✓ {st.label}</li></>) : null}
{(st.todo) ? (<><li style={{ padding: "8px 14px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", color: "#5f5f63" }}>{st.n} · {st.label}</li></>) : null}
</Fragment>))}
</ol>
<a href="/es/contacto" style={{ fontSize: "14px", color: "#5f5f63" }}>Necesito ayuda</a>
</header>

<main style={{ flex: "1", width: "100%", maxWidth: "880px", margin: "0 auto", padding: "64px 24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "32px" }}>

{(isStep1) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>¿Qué tipo de negocio tienes? <span style={{ color: "#5f5f63" }}>Tus agentes vendrán configurados para tu sector.</span></h1>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
{(sectors).map((s, $index) => (<Fragment key={$index}>
{(s.sel) ? (<>
<button type="button" aria-pressed="true" style={{ textAlign: "left", padding: "24px", borderRadius: "12px", border: "2px solid #000000", background: "#ffffff", color: "#000000", font: "400 14px/21px var(--font-display)", display: "flex", flexDirection: "column", gap: "6px", cursor: "pointer" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{s.label}</span><span style={{ color: "#5f5f63" }}>{s.hint}</span></button>
</>) : null}
{(s.unsel) ? (<>
<button type="button" aria-pressed="false" onClick={s.pick} style={{ textAlign: "left", padding: "25px", borderRadius: "12px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "400 14px/21px var(--font-display)", display: "flex", flexDirection: "column", gap: "6px", cursor: "pointer" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{s.label}</span><span style={{ color: "#5f5f63" }}>{s.hint}</span></button>
</>) : null}
</Fragment>))}
</div>
{hasSubs ? (<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<span style={{ fontSize: "18px", lineHeight: "22px" }}>¿Y en concreto?</span>
<div role="group" aria-label="Subsector" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{subOptions.map((o) => (<button key={o.label} type="button" aria-pressed={o.sel} onClick={o.pick} style={{ padding: "10px 16px", borderRadius: "800px", border: o.sel ? "1px solid #000000" : "1px solid #0000001a", background: o.sel ? "#000000" : "#ffffff", color: o.sel ? "#ffffff" : "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>{o.label}</button>))}
</div>
</div>) : null}
</div>
</>) : null}

{(isStep2) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Conecta tus herramientas. <span style={{ color: "#5f5f63" }}>Para {sectorName} solemos empezar por {typical}. Puedes añadir más después.</span></h1>
<div style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
{(tools).map((t, $index) => (<Fragment key={$index}>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #0000000f", flexWrap: "wrap" }}>
<span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#ebebed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500", flex: "none" }}>{t.short}</span>
<span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}>{t.name}</span><span style={{ display: "block", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{t.use}</span></span>
{(t.on) ? (<><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "14px", lineHeight: "14px" }}>✓ Conectado</span></>) : null}
{(t.off) ? (<><button type="button" onClick={t.connect} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Conectar</button></>) : null}
</div>
</Fragment>))}
</div>
</div>
</>) : null}

{(isStep3) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Elige tus agentes. <span style={{ color: "#5f5f63" }}>Vienen configurados para {sectorName}. Podrás ajustar cada skill.</span></h1>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
{(agents).map((a, $index) => (<Fragment key={$index}>
<div style={{ borderRadius: "12px", background: "#ffffff", border: "1px solid #0000001a", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
{(a.isMoss) ? (<><span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#004c39", flex: "none" }}></span></>) : null}
{(a.isMist) ? (<><span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#9dbecc", flex: "none" }}></span></>) : null}
{(a.isSand) ? (<><span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#a30042", flex: "none" }}></span></>) : null}
{(a.isDusk) ? (<><span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#8e4e00", flex: "none" }}></span></>) : null}
<span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{a.name}</span><span style={{ display: "block", marginTop: "6px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{a.desc}</span></span>
{(a.on) ? (<><button type="button" role="switch" aria-checked="true" aria-label={a.name} onClick={a.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#000000", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
{(a.off) ? (<><button type="button" role="switch" aria-checked="false" aria-label={a.name} onClick={a.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#d4d4d8", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
</div>
</Fragment>))}
</div>
<div style={{ borderRadius: "12px", background: "#9dbecc", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}><strong style={{ fontWeight: "500" }}>Tranquilo:</strong> todo lo que implique dinero o cambios en bloque necesitará tu aprobación por defecto.</div>
</div>
</>) : null}

{(isStep4) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Revisa y activa. <span style={{ color: "#5f5f63" }}>Cuando esto esté listo, tus agentes empiezan a trabajar.</span></h1>
<div style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
{(golive).map((g, $index) => (<Fragment key={$index}>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #0000000f", flexWrap: "wrap" }}>
{(g.ok) ? (<><span aria-hidden="true" style={{ width: "24px", height: "24px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flex: "none" }}>✓</span></>) : (<><span aria-hidden="true" style={{ width: "24px", height: "24px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flex: "none" }}>!</span></>)}
<span style={{ flex: "1 1 220px" }}><span style={{ display: "block", fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}>{g.label}</span><span style={{ display: "block", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{g.hint}</span></span>
{(!g.ok && g.label === 'Contexto del negocio cargado') ? (<><button type="button" onClick={addContext} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Añadir contexto</button></>) : null}
{(!g.ok && g.label === 'Prueba en modo pruebas') ? (<><button type="button" onClick={runTest} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Enviar prueba</button></>) : null}
</div>
</Fragment>))}
</div>
{(canGoLive) ? (<><div style={{ borderRadius: "12px", background: "#dcebdd", color: "#004c39", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}>Todo listo. Al activar, los agentes empiezan a atender en los canales conectados.</div></>) : (<><div style={{ borderRadius: "12px", background: "#f6f2e8", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}>Te falta algún paso. Puedes activar igualmente los que estén listos y completar el resto después.</div></>)}
</div>
</>) : null}

<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingTop: "8px", borderTop: "1px solid #0000000f" }}>
{(canBack) ? (<><button type="button" onClick={back} style={{ padding: "12px 20px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Atrás</button></>) : null}
{(noBack) ? (<><span></span></>) : null}
{(notLast) ? (<><button type="button" onClick={next} style={{ padding: "12px 20px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Continuar</button></>) : null}
{(isStep4) ? (<><span style={{ display: "flex", gap: "8px" }}><a href="/plataforma" style={{ padding: "12px 20px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "14px", fontWeight: "500" }}>Activar agentes</a></span></>) : null}
</div>
</main>
</div>
</>
  );
}
