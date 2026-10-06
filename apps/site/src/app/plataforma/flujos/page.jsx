"use client";
import { Fragment, useState } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const W = (t, d) => ({ k: 'when', title: t, detail: d });
const I = (t, d) => ({ k: 'if', title: t, detail: d });
const D = (t, d) => ({ k: 'do', title: t, detail: d });
const A = (t, d) => ({ k: 'ask', title: t, detail: d });
const data = [
{ id: 'espera', name: 'Hueco libre → lista de espera', meta: 'Recepción · se ha usado 23 veces este mes', steps: [W('Se cancela una cita', 'Por WhatsApp, llamada o desde la agenda'), I('Faltan menos de 48 h', 'Y hay pacientes en lista de espera para ese servicio'), D('Avisar por WhatsApp', 'Al primero de la lista, con 30 min para confirmar'), D('Si no confirma, avisar al siguiente', 'Hasta llenar el hueco')] },
{ id: 'recordatorio', name: 'Recordatorio de cita', meta: 'Recepción · 24 h antes', steps: [W('Faltan 24 h para una cita', 'Todas las citas confirmadas'), D('Enviar recordatorio', 'Plantilla «Recordatorio 24 h»'), I('No responde en 6 h', ''), D('Llamar al paciente', 'Con el agente de voz')] },
{ id: 'resena', name: 'Pedir reseña tras la visita', meta: 'Comercial · al día siguiente', steps: [W('Termina una visita', 'Marcada como atendida en la agenda'), I('Es su primera o segunda visita', ''), D('Enviar enlace de Google', 'A las 11:00 del día siguiente')] },
{ id: 'presupuesto', name: 'Seguimiento de presupuesto', meta: 'Comercial · 3 y 10 días después', steps: [W('Se envía un presupuesto', 'Ortodoncia, implantes o estética'), I('No hay respuesta en 3 días', ''), D('Preguntar si tiene dudas', 'Por WhatsApp, tono cercano'), A('Ofrecer pago a plazos', 'Lo aprueba la gerencia')] },
{ id: 'stock', name: 'Stock bajo → pedido', meta: 'Administración · pausado', steps: [W('Un material baja del mínimo', 'Según el inventario'), D('Preparar pedido al proveedor', 'Con las cantidades habituales'), A('Enviar pedido', 'Lo aprueba la gerencia')] }
];
const s = this.state || {};
const sel = s.sel || 'espera';
const on = s.on || { espera: true, recordatorio: true, resena: true, presupuesto: true, stock: false };
const cur = data.find((d) => d.id === sel) || data4;
return {
flows: data.map((f) => ({ name: f.name, meta: f.meta, selected: f.id === sel, notSelected: f.id !== sel, on: !!on[f.id], off: !on[f.id], select: () => this.setState({ sel: f.id }), toggle: () => this.setState({ on: { ...on, [f.id]: !on[f.id] } }) })),
current: { name: cur.name, meta: cur.meta, steps: cur.steps.map((x, i) => ({ ...x, notFirst: i > 0, isWhen: x.k === 'when', isIf: x.k === 'if', isDo: x.k === 'do', isAsk: x.k === 'ask' })) }
};
}.call(ctx);
  const { current, flows } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="flujos" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px", maxWidth: "720px" }}>Flujos automáticos. <span style={{ color: "#5f5f63" }}>Cuando pase algo, tus agentes saben qué hacer.</span></h1>
<button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Crear flujo</button>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "1 1 300px", maxWidth: "380px", background: "#ffffff", borderRadius: "12px", overflow: "hidden" }}>
{(flows).map((f, $index) => (<Fragment key={$index}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #0000000f" }}>
{(f.selected) ? (<><span style={{ flex: "1", minWidth: "0", fontSize: "14px", lineHeight: "21px", padding: "6px 10px", margin: "-6px -10px", borderRadius: "12px", background: "#0000000d" }}><span style={{ display: "block", fontWeight: "500" }}>{f.name}</span><span style={{ display: "block", fontSize: "12px", color: "#6b6b70" }}>{f.meta}</span></span></>) : null}
{(f.notSelected) ? (<><button type="button" onClick={f.select} style={{ flex: "1", minWidth: "0", textAlign: "left", border: "0", background: "transparent", padding: "0", font: "400 14px/21px var(--font-display)", color: "#000000", cursor: "pointer" }}><span style={{ display: "block", fontWeight: "500" }}>{f.name}</span><span style={{ display: "block", fontSize: "12px", color: "#6b6b70" }}>{f.meta}</span></button></>) : null}
{(f.on) ? (<><button type="button" role="switch" aria-checked="true" aria-label={f.name} onClick={f.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#000000", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
{(f.off) ? (<><button type="button" role="switch" aria-checked="false" aria-label={f.name} onClick={f.toggle} style={{ width: "40px", height: "24px", borderRadius: "800px", border: "0", background: "#d4d4d8", position: "relative", cursor: "pointer", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></button></>) : null}
</div>
</Fragment>))}
<div style={{ padding: "14px 16px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>Plantillas para clínicas: <a href="#" data-demo="" style={{ color: "#2457f5" }}>ver 12 más</a></div>
</section>

<section style={{ flex: "3 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
<span><span style={{ display: "block", fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{current.name}</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{current.meta}</span></span>
<span style={{ display: "flex", gap: "8px" }}><a href="#" data-demo="" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>Historial</a><button data-demo="" type="button" style={{ padding: "10px 16px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Guardar</button></span>
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", maxWidth: "560px" }}>
{(current.steps).map((s, $index) => (<Fragment key={$index}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
{(s.notFirst) ? (<><span aria-hidden="true" style={{ width: "2px", height: "24px", background: "#0000001a" }}></span></>) : null}
<div style={{ width: "100%", boxSizing: "border-box", background: "#ffffff", borderRadius: "12px", padding: "16px 18px", display: "flex", gap: "14px", alignItems: "flex-start", fontSize: "14px", lineHeight: "21px" }}>
{(s.isWhen) ? (<><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "16px", flex: "none" }}>Cuando</span></>) : null}
{(s.isIf) ? (<><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#ebebed", fontSize: "12px", lineHeight: "16px", flex: "none" }}>Si</span></>) : null}
{(s.isDo) ? (<><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "12px", lineHeight: "16px", flex: "none" }}>Haz</span></>) : null}
{(s.isAsk) ? (<><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", fontSize: "12px", lineHeight: "16px", flex: "none" }}>Pide aprobación</span></>) : null}
<span style={{ flex: "1" }}><span style={{ display: "block", fontWeight: "500" }}>{s.title}</span><span style={{ display: "block", color: "#5f5f63" }}>{s.detail}</span></span>
</div>
</div>
</Fragment>))}
<span aria-hidden="true" style={{ alignSelf: "center", width: "2px", height: "24px", background: "#0000001a" }}></span>
<button data-demo="" type="button" style={{ alignSelf: "center", padding: "10px 18px", borderRadius: "800px", border: "1px dashed #0000004d", background: "transparent", color: "#000000", font: "400 14px/21px var(--font-display)" }}>+ Añadir paso</button>
</div>
</section>
</div>
</main>
</div>
</>
  );
}
