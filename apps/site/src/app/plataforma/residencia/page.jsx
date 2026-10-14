"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import ModelosTabs from "@/components/modelos-tabs";

// A4 — Residencia y fallback (ADR 0019). La residencia es una política por
// tenant: "sin restricción" por defecto (máxima disponibilidad), o acotada a una
// región. El enrutador y su cadena de fallback NUNCA cruzan la frontera elegida;
// si ningún modelo cumple la calidad mínima dentro de la política → paso a humano.
// TODO(backend): org_model_settings(residencia, calidad_min, fallback[]); el
// enrutador filtra vías por región; cada llamada registra región+vía en agent_runs.
const box = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const POLICIES = [
  { id: "none", label: "Sin restricción", desc: "Máxima disponibilidad y mejor coste. El enrutador elige región por calidad, latencia y coste.", tag: "Recomendado" },
  { id: "eu", label: "Solo UE", desc: "Todo el procesado se queda en la Unión Europea. Para clínicas con dato clínico sensible.", tag: "" },
  { id: "us", label: "Solo EE. UU.", desc: "Procesado en EE. UU. Útil si tu matriz lo exige.", tag: "" },
];

// Cadena de fallback del agente de Atención. Cada paso declara en qué regiones
// está disponible; la política filtra los que no encajan.
const CHAIN = [
  { n: "Claude Haiku 5.5", role: "Rápido · por defecto", type: "chat", via: "AWS Bedrock", regions: ["eu", "us"] },
  { n: "GPT-5.6 Luna", role: "Fallback equivalente", type: "chat", via: "Azure OpenAI", regions: ["eu", "us"] },
  { n: "Claude Sonnet 5.5", role: "Avanzado · tareas marcadas", type: "razon", via: "Google Vertex", regions: ["eu", "us"] },
  { n: "GPT-6 Astra", role: "Avanzado · fallback", type: "razon", via: "API directa", regions: ["us"] },
];
const TYPE = { chat: ["Chat", "#e8edff", "#2457f5"], razon: ["Razonamiento", "#efe6ff", "#6b3fd4"] };
const REGION_LABEL = { eu: "UE", us: "EE. UU." };

export default function Residencia() {
  const [policy, setPolicy] = useState("none");
  const [human, setHuman] = useState(true);

  const regionOf = (step) => policy === "none" ? (step.regions.includes("eu") ? "eu" : step.regions[0]) : (step.regions.includes(policy) ? policy : null);
  const active = CHAIN.filter((s) => regionOf(s) !== null);
  const dropped = CHAIN.filter((s) => regionOf(s) === null);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Residencia y fallback</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>Dónde se pueden procesar los datos. El enrutador y sus alternativas respetan siempre esta frontera; nunca cruzan de región en silencio.</span>
        </div>
        <ModelosTabs active="residencia" />

        <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "16px", fontWeight: 500 }}>Política de residencia</span>
          <div role="radiogroup" aria-label="Residencia" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {POLICIES.map((p) => {
              const sel = policy === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => setPolicy(p.id)} style={{ textAlign: "left", padding: "14px 16px", borderRadius: "10px", border: "1px solid", borderColor: sel ? "#000000" : "#0000001a", background: sel ? "#fafafa" : "#ffffff", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px", outline: sel ? "1px solid #000000" : "none" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "14px", fontWeight: 500 }}>{p.label}</span>{p.tag && <span style={{ padding: "2px 8px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "11px" }}>{p.tag}</span>}</span>
                  <span style={{ fontSize: "12px", lineHeight: "17px", color: "#6b6b70", fontFamily: "var(--font-body)" }}>{p.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>Cadena de fallback · agente de Atención</span>
            <span style={{ fontSize: "12px", ...muted }}>{policy === "none" ? "Sin restricción de región" : `Filtrada a ${REGION_LABEL[policy]}`}</span>
          </div>

          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0" }}>
            {active.map((s, i) => {
              const t = TYPE[s.type]; const reg = regionOf(s);
              return (
                <li key={s.n} style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: "24px" }}>
                    <span style={{ width: "24px", height: "24px", borderRadius: "800px", background: i === 0 ? "#000000" : "#ffffff", color: i === 0 ? "#ffffff" : "#000000", border: "1px solid " + (i === 0 ? "#000000" : "#0000001a"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>{i + 1}</span>
                    <span style={{ flex: 1, width: "1px", background: "#0000001a", minHeight: "12px" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, marginBottom: "12px", padding: "12px 14px", borderRadius: "10px", border: "1px solid #0000001a", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                      <span style={{ fontSize: "14px", fontWeight: 500 }}>{s.n}</span>
                      <span style={{ fontSize: "12px", ...muted }}>{s.role} · {s.via}</span>
                    </div>
                    <span style={{ display: "flex", gap: "6px", flex: "none", flexWrap: "wrap" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "800px", background: t[1], color: t[2], fontSize: "12px" }}>{t[0]}</span>
                      <span style={{ padding: "3px 10px", borderRadius: "800px", background: reg === "eu" ? "#dcebdd" : "#eef1f6", color: reg === "eu" ? "#004c39" : "#3a4a63", fontSize: "12px" }}>{REGION_LABEL[reg]}</span>
                    </span>
                  </div>
                </li>
              );
            })}
            <li style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: "24px" }}>
                <span style={{ width: "24px", height: "24px", borderRadius: "800px", background: "#f6f2e8", border: "1px solid #0000001a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }} aria-hidden="true">✋</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: "10px", background: "#f6f2e8", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", lineHeight: "20px" }}>Si ningún modelo cumple la política → <strong style={{ fontWeight: 500 }}>paso a humano</strong></span>
                <label style={{ display: "inline-flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "#6b6b70", flex: "none" }}><input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} disabled />Siempre activo</label>
              </div>
            </li>
          </ol>

          {dropped.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}>
              <span style={{ fontSize: "12px", ...muted }}>Queda fuera por la política «{POLICIES.find((p) => p.id === policy).label}»</span>
              {dropped.map((s) => (
                <div key={s.n} style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", fontSize: "13px", color: "#9a9a9e", flexWrap: "wrap" }}>
                  <span style={{ textDecoration: "line-through" }}>{s.n} · {s.via}</span>
                  <span style={{ padding: "2px 9px", borderRadius: "800px", background: "#f4f4f5", fontSize: "11px" }}>solo {s.regions.map((r) => REGION_LABEL[r]).join(", ")}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" style={btnDark}>Guardar política</button></div>
      </main>
    </div>
  );
}
