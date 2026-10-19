"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { pageData, AGENT_TABLE_COLOR } from "@/components/sede-data";
import Pills from "@/components/pills";

// Informes por sede (ver sede-data). «Todas las sedes» suma los totales de la
// organización; las medias (%, segundos) no se suman.
const BAR_STACK = [
  { flex: 1, color: "var(--amber-fg)", radius: "4px 4px 0 0" },
  { flex: 2, color: "#9dbecc" },
  { flex: 3, color: "var(--green-fg)" },
];

// El periodo cambia el rango, escala las cifras y fija la granularidad del gráfico
// (semana → por día, mes → por semana, año → por mes).
const PERIODS = [["semana", "Semana"], ["mes", "Mes"], ["año", "Año"]];
const P = {
  semana: { f: 0.23, range: "22–28 sep", title: "Última semana de septiembre", chart: "por día", bars: (b) => [62, 74, 81, 77, 92, 41, 18].map((v) => Math.round((v * b[3]) / 88)), labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] },
  mes: { f: 1, range: "1–30 sep", title: "Septiembre", chart: "por semana", bars: (b) => b, labels: null },
  año: { f: 9, range: "Ene–sep 2026", title: "Enero a septiembre", chart: "por mes", bars: (b) => [34, 39, 44, 48, 52, 57, 61, 66, Math.round(b.reduce((t, x) => t + x, 0) / b.length)], labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"] },
};
const scaleVal = (v, f) => {
  const str = String(v);
  if (str.includes("%") || /\d\s*s$/.test(str)) return v; // medias: no escalan
  const n = parseFloat(str.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
  const r = Math.round(n * f);
  if (str.includes("€")) return `${r.toLocaleString("es-ES")} €`;
  if (str.includes("h")) return `${r.toLocaleString("es-ES")} h`;
  return r.toLocaleString("es-ES");
};

export default function Screen() {
  const { sede } = useSede();
  const base = pageData("informes", sede);
  const [period, setPeriod] = useState("mes");
  const per = P[period];
  const bars = per.bars(base.bars);
  const d = { ...base, hours: scaleVal(base.hours, per.f), stats: Object.fromEntries(Object.entries(base.stats).map(([k, v]) => [k, scaleVal(v, per.f)])), bars, barLabels: per.labels ?? base.barLabels };
  const maxBar = Math.max(...d.bars);
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="informes" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Informes. <span style={{ color: "var(--muted)" }}>Lo que tus agentes han hecho por ti.</span></h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <Pills label="Periodo" variant="segmented" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
            <span style={{ padding: "10px 14px", borderRadius: "800px", background: "var(--paper)", fontSize: "14px", lineHeight: "20px", color: "var(--muted)" }}>{per.range}</span>
            <button data-demo="" type="button" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/20px var(--font-display)" }}>CSV</button>
            <button data-demo="" type="button" style={{ padding: "10px 16px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/20px var(--font-display)" }}>PDF</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 360px", borderRadius: "12px", background: "#004c39", color: "#ffffff", padding: "28px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>{per.title} · tiempo ahorrado a tu equipo</span>
            <span style={{ fontSize: "52px", lineHeight: "57px", letterSpacing: "-2.08px" }}>{d.hours}</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>{d.heroSub}</span>
          </div>
          <div style={{ flex: "3 1 480px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
            {Object.entries(d.stats).map(([k, v]) => (
              <div key={k} style={{ background: "var(--paper)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted)" }}>{k}</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{v}</span></div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "stretch" }}>
          <section style={{ flex: "3 1 460px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tareas completadas {per.chart}</h2>
              <span style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "12px", lineHeight: "18px", color: "var(--muted)" }}><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#004c39" }}></span>Recepción</span><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--mist)" }}></span>Atención</span><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#8e4e00" }}></span>Administración</span></span></div>
            <div role="img" aria-label={`Gráfico de barras ilustrativo: tareas ${per.chart} y agente`} style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "220px", padding: "0 4px", borderBottom: "1px solid var(--line)" }}>
              {d.bars.map((h, i) => (
                <div key={i} style={{ flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "12px", color: h === maxBar ? "var(--ink)" : "var(--muted)", fontWeight: h === maxBar ? "500" : "400" }}>{h}</span>
                  <div style={{ width: "100%", maxWidth: "64px", display: "flex", flexDirection: "column", gap: "2px", height: `${h}%` }}>
                    {BAR_STACK.map((b, j) => (<div key={j} style={{ flex: b.flex, background: b.color, borderRadius: b.radius || "0" }}></div>))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "20px", padding: "0 4px", fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{d.barLabels.map((l) => (<span key={l} style={{ flex: "1", textAlign: "center" }}>{l}</span>))}</div>
          </section>

          <section style={{ flex: "2 1 300px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" }}>
            <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Por canal</h2>
            {d.channels.map((ch) => (
              <div key={ch.name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span>{ch.name}</span><span>{ch.pct}%</span></span><span style={{ height: "8px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: `${ch.pct}%`, height: "8px", borderRadius: "800px", background: "var(--ink)" }}></span></span></div>
            ))}
            <div style={{ marginTop: "auto", borderRadius: "12px", background: "var(--linen)", padding: "14px", color: "var(--ink)" }}><strong style={{ fontWeight: "500" }}>Dato útil:</strong> {d.tip}</div>
          </section>
        </div>

        <section style={{ background: "var(--paper)", borderRadius: "12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "620px" }}>
            <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th style={{ padding: "12px 24px", fontWeight: "500" }}>Agente</th><th style={{ padding: "12px", fontWeight: "500" }}>Tareas</th><th style={{ padding: "12px", fontWeight: "500" }}>Resueltas solas</th><th style={{ padding: "12px", fontWeight: "500" }}>Con tu aprobación</th><th style={{ padding: "12px 24px", fontWeight: "500" }}>Pasadas a una persona</th></tr></thead>
            <tbody>
              {d.agents.map((a) => (
                <tr key={a.key} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "12px 24px" }}><span style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: AGENT_TABLE_COLOR[a.key] }}></span><a href={`/plataforma/agente?a=${a.key}`} style={{ color: "inherit" }}>{a.name}</a></span></td>
                  <td style={{ padding: "12px" }}>{a.tasks}</td><td style={{ padding: "12px" }}>{a.solo}</td><td style={{ padding: "12px" }}>{a.approve}</td><td style={{ padding: "12px 24px" }}>{a.human}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
