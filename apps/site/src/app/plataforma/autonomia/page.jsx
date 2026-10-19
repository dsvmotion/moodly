"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { SEDES as SEDE_LIST, useSede } from "@/components/use-sede";
import { useAgentParam } from "@/components/agent-param";

// B4 — Techo de autonomía (motor de políticas). Por cada acción se fija si el
// agente la hace solo, con aprobación o nunca, por agente y sede. Es el recorrido
// de edición que faltaba sobre la pantalla Reglas.
// TODO(backend): business_rules (acción × ámbito × modo); 🔒 cambiar un techo
// pasa por el motor de políticas y queda en audit_logs. Las acciones sensibles
// (dinero, datos) parten de "nunca/aprobación" (lista blanca).
const CARD = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const sel = { padding: "7px 12px", borderRadius: "800px", border: 0, font: "500 13px/13px var(--font-display)", cursor: "pointer" };

const MODES = [
  { id: "auto", label: "Solo", on: { background: "#dcebdd", color: "#004c39" } },
  { id: "approval", label: "Con aprobación", on: { background: "#ffe8d6", color: "#8e4e00" } },
  { id: "never", label: "Nunca", on: { background: "#fbe1ea", color: "#a30042" } },
];
const GROUPS = [
  { g: "Agenda", items: [["cita_crear", "Crear una cita", "auto", false], ["cita_mover", "Mover o cancelar una cita", "approval", false], ["lista_espera", "Avisar a la lista de espera", "auto", false]] },
  { g: "Mensajería", items: [["responder", "Responder dudas", "auto", false], ["plantilla", "Enviar una plantilla de WhatsApp", "auto", false], ["campania", "Enviar una campaña", "approval", false]] },
  { g: "Dinero", items: [["factura", "Enviar una factura", "approval", true], ["cobro", "Cobrar o pago a plazos", "never", true]] },
  { g: "Datos del cliente", items: [["compartir", "Compartir datos con un tercero", "never", true], ["borrar", "Borrar datos de un cliente", "never", true]] },
];
const AGENTS = ["Recepción", "Atención al cliente", "Comercial", "Administración"];
const SEDES = ["Toda la organización", ...SEDE_LIST.filter((x) => x !== "Todas las sedes")];

export default function Autonomia() {
  const init = {}; GROUPS.forEach((gr) => gr.items.forEach(([id, , def]) => { init[id] = def; }));
  const [state, setState] = useState(init);
  const { name: agentFromUrl } = useAgentParam();
  const { sede: globalSede } = useSede();
  const [agentPick, setAgent] = useState(null);
  const [sedePick, setSede] = useState(null);
  const agent = agentPick ?? agentFromUrl;
  const sede = sedePick ?? (globalSede === "Todas las sedes" ? "Toda la organización" : globalSede);
  const sensitive = {}; GROUPS.forEach((gr) => gr.items.forEach(([id, , , s]) => { sensitive[id] = s; }));

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="reglas" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href="/plataforma/reglas" style={{ fontSize: "14px", color: "#5f5f63" }}>‹ Reglas y aprobaciones</a>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Techo de autonomía</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>Qué puede hacer el agente solo, qué te pide aprobar y qué no hace nunca. Lo sensible (dinero y datos) parte restringido; ampliarlo queda registrado.</span>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Agente<select value={agent} onChange={(e) => setAgent(e.target.value)} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000" }}>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Sede<select value={sede} onChange={(e) => setSede(e.target.value)} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000" }}>{SEDES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {GROUPS.map((gr) => (
            <section key={gr.g} style={{ ...CARD, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #0000000f", fontSize: "14px", fontWeight: 500 }}>{gr.g}</div>
              {gr.items.map(([id, label], i) => {
                const warn = sensitive[id] && state[id] === "auto";
                return (
                  <div key={id} style={{ padding: "14px 20px", borderTop: i ? "1px solid #0000000f" : 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "14px", display: "inline-flex", gap: "8px", alignItems: "center" }}>{label}{sensitive[id] && <span style={{ padding: "2px 8px", borderRadius: "800px", background: "#f4f4f5", fontSize: "11px", color: "#6b6b70" }}>sensible</span>}</span>
                      <div role="radiogroup" aria-label={label} style={{ display: "inline-flex", gap: "4px", background: "#f4f4f5", borderRadius: "800px", padding: "3px" }}>
                        {MODES.map((m) => {
                          const active = state[id] === m.id;
                          return <button key={m.id} type="button" role="radio" aria-checked={active} onClick={() => setState((s) => ({ ...s, [id]: m.id }))} style={{ ...sel, ...(active ? m.on : { background: "transparent", color: "#5f5f63" }) }}>{m.label}</button>;
                        })}
                      </div>
                    </div>
                    {warn && <span role="alert" style={{ fontSize: "12px", lineHeight: "17px", color: "#a30042", fontFamily: "var(--font-body)" }}>⚠︎ Acción sensible en automático. El agente la hará sin pedirte permiso; asegúrate de que es lo que quieres.</span>}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #0000000f", paddingTop: "16px" }}>
          <span style={{ fontSize: "13px", ...muted }}>Para «{agent}» en «{sede}». Las sedes sin valor propio heredan el de la organización.</span>
          <button type="button" style={btnDark}>Guardar techo</button>
        </div>
      </main>
    </div>
  );
}
