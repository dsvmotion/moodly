"use client";
import { Fragment, useState } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const base = [
{ id: 'reservar', name: 'Reservar cita', desc: 'En un hueco libre de la agenda', agent: 'Recepción', mode: 'auto', approver: 'Recepción' },
{ id: 'mover', name: 'Mover citas en bloque', desc: 'Por bajas, cierres o festivos', agent: 'Recepción', mode: 'approval', approver: 'Gerente' },
{ id: 'responder', name: 'Responder preguntas', desc: 'Con la información de Conocimiento', agent: 'Atención', mode: 'auto', approver: 'Recepción' },
{ id: 'resena', name: 'Responder reseñas negativas', desc: '3 estrellas o menos', agent: 'Atención', mode: 'approval', approver: 'Dueña' },
{ id: 'descuento', name: 'Ofrecer descuento', desc: 'Cualquier rebaja de precio', agent: 'Comercial', mode: 'approval', approver: 'Dueña' },
{ id: 'factura', name: 'Enviar factura', desc: 'A clientes y aseguradoras', agent: 'Administración', mode: 'approval', approver: 'Gerente' },
{ id: 'pedido', name: 'Pedir material a proveedor', desc: 'Cuando el stock baja del mínimo', agent: 'Administración', mode: 'approval', approver: 'Gerente' },
{ id: 'medico', name: 'Dar consejo médico', desc: 'Diagnósticos o tratamientos', agent: 'Todos', mode: 'never', approver: '–' }
];
const modes = (this.state && this.state.modes) || {};
const set = (id, m) => () => this.setState({ modes: { ...modes, [id]: m } });
const rules = base.map((r) => {
const m = modes[r.id] || r.mode;
return { ...r, isAuto: m === 'auto', notAuto: m !== 'auto', isApproval: m === 'approval', notApproval: m !== 'approval', isNever: m === 'never', notNever: m !== 'never', setAuto: set(r.id, 'auto'), setApproval: set(r.id, 'approval'), setNever: set(r.id, 'never') };
});
return {
rules,
autoCount: rules.filter((r) => r.isAuto).length,
approvalCount: rules.filter((r) => r.isApproval).length,
neverCount: rules.filter((r) => r.isNever).length
};
}.call(ctx);
  const { approvalCount, autoCount, neverCount, rules } = vals;
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="reglas" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px", maxWidth: "720px" }}>Reglas y aprobaciones. <span style={{ color: "var(--muted)" }}>Decide qué hace solo cada agente, qué te pregunta y qué no hace nunca.</span></h1>
<a href="/plataforma/autonomia" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/21px var(--font-display)", textDecoration: "none" }}>Techo de autonomía</a>
<button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)" }}>Guardar cambios</button>
</div>

<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ padding: "10px 16px", borderRadius: "12px", background: "var(--green-bg)", color: "var(--green-fg)" }}>● {autoCount} automáticas</span>
<span style={{ padding: "10px 16px", borderRadius: "12px", background: "var(--amber-bg)", color: "var(--amber-fg)" }}>! {approvalCount} con aprobación</span>
<span style={{ padding: "10px 16px", borderRadius: "12px", background: "var(--rose-bg)", color: "var(--rose-fg)" }}>× {neverCount} nunca</span>
</div>

<section style={{ background: "var(--paper)", borderRadius: "12px", overflowX: "auto" }}>
<div style={{ minWidth: "760px" }}>
<div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 2.2fr 1.1fr", gap: "16px", padding: "12px 24px", background: "var(--sunken)", fontSize: "14px", lineHeight: "21px", fontWeight: "500" }}><span>Acción</span><span>Agente</span><span>Qué puede hacer</span><span>Quién aprueba</span></div>
{(rules).map((r, $index) => (<Fragment key={$index}>
<div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 2.2fr 1.1fr", gap: "16px", alignItems: "center", padding: "12px 24px", borderTop: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px" }}>
<span><span style={{ display: "block", fontWeight: "500" }}>{r.name}</span><span style={{ display: "block", fontSize: "12px", color: "var(--muted-2)" }}>{r.desc}</span></span>
<span style={{ color: "var(--muted)" }}>{r.agent}</span>
<span role="radiogroup" aria-label={r.name} style={{ display: "flex", padding: "3px", borderRadius: "800px", background: "var(--canvas)", width: "max-content" }}>
{(r.isAuto) ? (<><button data-demo="" type="button" role="radio" aria-checked="true" style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "#004c39", color: "#ffffff", font: "400 13px/18px var(--font-display)" }}>Automático</button></>) : null}
{(r.notAuto) ? (<><button type="button" role="radio" aria-checked="false" onClick={r.setAuto} style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "transparent", color: "var(--muted)", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>Automático</button></>) : null}
{(r.isApproval) ? (<><button data-demo="" type="button" role="radio" aria-checked="true" style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "var(--amber-bg)", color: "var(--amber-fg)", font: "400 13px/18px var(--font-display)", boxShadow: "inset 0 0 0 1px #8e4e0040" }}>Con aprobación</button></>) : null}
{(r.notApproval) ? (<><button type="button" role="radio" aria-checked="false" onClick={r.setApproval} style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "transparent", color: "var(--muted)", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>Con aprobación</button></>) : null}
{(r.isNever) ? (<><button data-demo="" type="button" role="radio" aria-checked="true" style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "#a30042", color: "#ffffff", font: "400 13px/18px var(--font-display)" }}>Nunca</button></>) : null}
{(r.notNever) ? (<><button type="button" role="radio" aria-checked="false" onClick={r.setNever} style={{ padding: "7px 12px", borderRadius: "800px", border: "0", background: "transparent", color: "var(--muted)", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>Nunca</button></>) : null}
</span>
{(r.isApproval) ? (<><select aria-label={`Quién aprueba: ${r.name ?? "regla"}`} defaultValue={r.approver} style={{ appearance: "auto", border: "1px solid var(--line)", borderRadius: "800px", background: "var(--paper)", padding: "6px 10px", font: "400 13px/16px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}><option value="Dueña">Dueña</option><option value="Gerente">Gerente</option><option value="Recepción">Recepción</option></select></>) : null}
{(r.notApproval) ? (<><span style={{ color: "var(--muted-2)" }}>–</span></>) : null}
</div>
</Fragment>))}
</div>
</section>

<div style={{ borderRadius: "12px", background: "var(--linen)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}><span style={{ flex: "1 1 320px" }}><strong style={{ fontWeight: "500" }}>Consejo:</strong> empieza con más cosas «con aprobación». Cuando veas que el agente acierta, pásalas a automático.</span><a href="/plataforma/aprobaciones" style={{ padding: "10px 16px", borderRadius: "800px", background: "var(--paper)", fontSize: "14px" }}>Ver aprobaciones</a></div>
</main>
</div>
</>
  );
}
