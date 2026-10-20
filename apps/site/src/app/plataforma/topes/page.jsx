"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import ModelosTabs from "@/components/modelos-tabs";

// A6 — Topes de gasto y circuit breaker (ADR 0019). Tope € por ámbito con aviso
// al acercarse y corte al alcanzarlo; panel de fiabilidad que degrada a fallback
// un proveedor con problemas. El coste de Moodly está en la IA; esto lo acota.
// TODO(backend): usage_limits(ámbito, tope, aviso%) + medición en usage_records;
// circuit breaker por proveedor en el enrutador; al cortar → fallback o humano.
const CARD = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnLight = { padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const CAPS = [
  { id: "org", name: "Toda la organización", cap: 600, spent: 312, sub: "Gasto total de IA al mes" },
  { id: "advanced", name: "Modelo avanzado", cap: 150, spent: 128, sub: "Tareas marcadas (razonamiento, presupuestos)" },
  { id: "voice", name: "Voz", cap: 120, spent: 41, sub: "Llamadas y notas de voz · por minuto" },
  { id: "flow", name: "Flujo «recuperar presupuestos»", cap: 60, spent: 60, sub: "Campaña automática" },
];
const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", via: "AWS Bedrock · UE" },
  { id: "openai", name: "OpenAI", via: "Azure · UE" },
  { id: "google", name: "Google", via: "Vertex · UE" },
];

export default function Topes() {
  const [caps, setCaps] = useState(CAPS);
  const [degraded, setDegraded] = useState(false);
  const setCap = (id, v) => setCaps((s) => s.map((c) => (c.id === id ? { ...c, cap: Math.max(0, Number(v) || 0) } : c)));

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Topes de gasto y fiabilidad</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>Pon un techo al gasto de IA por ámbito; avisamos al 80 % y cortamos al llegar. Si un proveedor falla, el enrutador pasa al siguiente sin que lo notes.</span>
        </div>
        <ModelosTabs active="topes" />

        <section style={{ ...CARD, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "16px", fontWeight: 500 }}>Topes de gasto (mes en curso)</div>
          {caps.map((c, i) => {
            const pct = c.cap > 0 ? Math.min(100, Math.round((c.spent / c.cap) * 100)) : 100;
            const reached = c.spent >= c.cap;
            const near = !reached && pct >= 80;
            const col = reached ? ["var(--rose-bg)", "var(--rose-fg)"] : near ? ["var(--amber-bg)", "var(--amber-fg)"] : ["var(--green-bg)", "var(--green-fg)"];
            return (
              <div key={c.id} style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--line-soft)" : 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: "12px", ...muted }}>{c.sub}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "none" }}>
                    <span style={{ fontSize: "13px", ...muted }}>{`${c.spent} € de`}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><input type="number" aria-label={`Tope de gasto · ${c.name}`} value={c.cap} onChange={(e) => setCap(c.id, e.target.value)} style={{ width: "72px", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)", font: "500 14px/18px var(--font-body)", textAlign: "right" }} /> €</span>
                  </div>
                </div>
                <div style={{ height: "8px", borderRadius: "800px", background: "var(--paper-2d)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: col[1], borderRadius: "800px", transition: "width .3s ease" }} /></div>
                <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "800px", background: col[0], color: col[1], fontSize: "12px" }}>{reached ? "Tope alcanzado · en pausa" : near ? `${pct}% · cerca del tope` : `${pct}% usado`}</span>
              </div>
            );
          })}
        </section>

        <section style={{ ...CARD, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>Fiabilidad · circuit breaker</span>
            <button type="button" onClick={() => setDegraded(!degraded)} style={btnLight}>{degraded ? "Restablecer" : "Simular incidencia"}</button>
          </div>
          {PROVIDERS.map((p, i) => {
            const bad = degraded && p.id === "openai";
            return (
              <div key={p.id} style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line-soft)" : 0, display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: "12px", ...muted }}>{p.via}{bad ? " · se enruta a Anthropic" : ""}</span>
                </div>
                <span style={{ display: "inline-flex", gap: "6px", alignItems: "center", padding: "4px 11px", borderRadius: "800px", fontSize: "12px", flex: "none", ...(bad ? { background: "var(--amber-bg)", color: "var(--amber-fg)" } : { background: "var(--green-bg)", color: "var(--green-fg)" }) }}><span style={{ width: "7px", height: "7px", borderRadius: "800px", background: bad ? "#8e4e00" : "#1a8f5a" }} />{bad ? "Degradado → fallback" : "Operativo"}</span>
              </div>
            );
          })}
          {degraded && <div role="status" style={{ margin: "0 20px 16px", padding: "12px 14px", borderRadius: "10px", background: "var(--slate-bg)", color: "var(--slate-fg)", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}>El enrutador detectó latencia alta en OpenAI y pasó su tráfico al siguiente equivalente dentro de tu residencia. Sin interrupción para los clientes. Si ninguno cumpliera, pasaría a humano.</div>}
        </section>
      </main>
    </div>
  );
}
