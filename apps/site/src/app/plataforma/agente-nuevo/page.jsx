"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { SEDES as SEDE_LIST } from "@/components/use-sede";

// B1 — Crear/clonar agente desde plantilla (agent_type × vertical). El paso que
// faltaba entre "Mis agentes" y tener un agente configurado: tipo + plantilla →
// alcance → modelo/vía → borrador. Se activa tras probarlo (ver /plataforma/probar).
// TODO(backend): agents + agent_types(catálogo) + plantillas por vertical
// (packages/templates); nace en estado 'draft'; modelo/vía desde org_model_settings.
const CARD = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "12px 20px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const H = { margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" };
const SUB = { fontSize: "15px", lineHeight: "23px", ...muted };
const field = { padding: "11px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000", width: "100%", boxSizing: "border-box" };

const TYPES = [
  { id: "reception", name: "Recepción", color: "#004c39", bg: "#dcebdd", desc: "Atiende el primer contacto, agenda citas y resuelve dudas básicas." },
  { id: "customer", name: "Atención al cliente", color: "#2c5868", bg: "#dbe9ef", desc: "Resuelve incidencias, hace seguimiento y cuida la relación." },
  { id: "sales", name: "Comercial", color: "#a30042", bg: "#fbe1ea", desc: "Cualifica leads, propone tratamientos y recupera presupuestos." },
  { id: "admin", name: "Administración", color: "#8e4e00", bg: "#ffe8d6", desc: "Factura, cobra y lleva el día a día administrativo." },
];
const STEP_LABELS = ["Tipo y plantilla", "Alcance", "Modelo", "Listo"];
const SEDES = ["Toda la organización", ...SEDE_LIST.filter((x) => x !== "Todas las sedes")];

export default function AgenteNuevo() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState("reception");
  const [name, setName] = useState("Recepción");
  const [sede, setSede] = useState("Sede Centro");
  const [model, setModel] = useState("fast");
  const [advanced, setAdvanced] = useState(true);
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const t = TYPES.find((x) => x.id === type);
  const pick = (id) => { setType(id); setName(TYPES.find((x) => x.id === id).name); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-rise{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 460px", minWidth: 0, maxWidth: "820px", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <a href="/plataforma/agente" style={{ fontSize: "14px", color: "#5f5f63" }}>‹ Mis agentes</a>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "13px" }}>
            {STEP_LABELS.map((l, i) => { const n = i + 1; const cur = step === n; const done = step > n; return <li key={l} aria-current={cur ? "step" : undefined} style={{ padding: "6px 12px", borderRadius: "800px", ...(cur ? { background: "#000000", color: "#ffffff" } : done ? { background: "#dcebdd", color: "#004c39" } : { boxShadow: "inset 0 0 0 1px #0000001a", color: "#5f5f63" }) }}>{done ? "✓" : n} · {l}</li>; })}
          </ol>
        </div>

        {step === 1 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>¿Qué agente creamos?</h1><span style={SUB}>Parte de una plantilla para <strong style={{ fontWeight: 500, color: "#000000" }}>Clínicas</strong> y ajústalo luego. Puedes tener varios del mismo tipo por sede.</span></div>
            <div role="radiogroup" aria-label="Tipo de agente" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {TYPES.map((x) => {
                const sel = type === x.id;
                return (
                  <button key={x.id} type="button" role="radio" aria-checked={sel} onClick={() => pick(x.id)} style={{ ...CARD, textAlign: "left", padding: "18px", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer", borderColor: sel ? "#000000" : "#0000001a", outline: sel ? "1px solid #000000" : "none" }}>
                    <span style={{ alignSelf: "flex-start", padding: "4px 11px", borderRadius: "800px", background: x.bg, color: x.color, fontSize: "12px", fontWeight: 500 }}>{x.name}</span>
                    <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }}>{x.desc}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={() => setStep(2)} style={btnDark}>Continuar</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Dónde trabaja</h1><span style={SUB}>Ponle nombre y dime a qué alcance responde. El agente hereda el contexto de esa sede.</span></div>
            <div style={{ ...CARD, padding: "22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Nombre del agente<input value={name} onChange={(e) => setName(e.target.value)} style={field} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Alcance<select value={sede} onChange={(e) => setSede(e.target.value)} style={field}>{SEDES.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}><button type="button" onClick={() => setStep(1)} style={btnLight}>Atrás</button><button type="button" onClick={() => setStep(3)} style={btnDark}>Continuar</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Qué modelo usa</h1><span style={SUB}>Por defecto, un modelo rápido y barato. El avanzado solo para tareas marcadas, con tope. Dónde se procesa lo decide tu <a href="/plataforma/residencia" style={{ color: "#2457f5" }}>política de residencia</a>.</span></div>
            <div role="radiogroup" aria-label="Modelo por defecto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {[["fast", "Rápido (recomendado)", "Claude Haiku 5.5 · ~0,005 €/conversación", "Para el 90 % de los mensajes."], ["balanced", "Equilibrado", "GPT-5.6 Luna · coste medio", "Si quieres algo más de matiz."]].map(([id, n, m, d]) => {
                const sel = model === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={sel} onClick={() => setModel(id)} style={{ ...CARD, textAlign: "left", padding: "16px", display: "flex", flexDirection: "column", gap: "4px", cursor: "pointer", borderColor: sel ? "#000000" : "#0000001a", outline: sel ? "1px solid #000000" : "none" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{n}</span>
                    <span style={{ fontSize: "13px", ...muted }}>{m}</span>
                    <span style={{ fontSize: "12px", color: "#6b6b70", fontFamily: "var(--font-body)" }}>{d}</span>
                  </button>
                );
              })}
            </div>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", ...CARD, padding: "14px 16px", cursor: "pointer" }}>
              <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} style={{ marginTop: "2px" }} />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "14px", fontWeight: 500 }}>Usar modelo avanzado en tareas marcadas</span><span style={{ fontSize: "13px", ...muted }}>Razonar sobre un caso difícil o redactar un presupuesto. Con tope de gasto.</span></span>
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}><button type="button" onClick={() => setStep(2)} style={btnLight}>Atrás</button><button type="button" onClick={() => setStep(4)} style={btnDark}>Crear agente</button></div>
          </div>
        )}

        {step === 4 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <span style={{ width: "44px", height: "44px", borderRadius: "800px", background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flex: "none" }}>✓</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><h1 style={H}>«{name}» creado como borrador</h1><span style={SUB}>Aún no responde a clientes. Pruébalo y pasa las comprobaciones antes de activarlo.</span></div>
            </div>
            <div style={{ ...CARD, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[["Tipo", t.name], ["Alcance", sede], ["Modelo", model === "fast" ? "Claude Haiku 5.5 (rápido)" : "GPT-5.6 Luna"], ["Avanzado en tareas marcadas", advanced ? "Sí" : "No"], ["Estado", "Borrador"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}><span style={muted}>{k}</span><span style={{ fontWeight: 500 }}>{v}</span></div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}><a href={`/plataforma/agente?a=${type}`} style={btnLight}>Ir a mis agentes</a><a href={`/plataforma/probar?a=${type}`} style={btnDark}>Probar antes de activar</a></div>
          </div>
        )}
      </main>
    </div>
  );
}
