"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { AGENT_DOT, dashboardFor } from "@/components/sede-data";
import Pills from "@/components/pills";

// Inicio del panel. Los datos salen de la sede activa (ver sede-data): cada sede
// tiene los suyos y «Todas las sedes» muestra la organización agregada. Cada agente
// abre su ficha (?a=), cada aprobación la suya (?i=) y el periodo escala los KPI.
const PERIODS = [["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"]];
const FACTOR = { hoy: 1, semana: 5, mes: 21 };
const scale = (v, f) => {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  const isH = String(v).includes("h");
  const r = n * f;
  return isH ? `${r.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h` : Math.round(r).toLocaleString("es-ES");
};

const KPI = [
  { key: "conversaciones", label: "Conversaciones atendidas", bg: "var(--sage)", fg: "var(--ink)" },
  { key: "citas", label: "Citas reservadas", bg: "var(--mist)", fg: "var(--ink)" },
  { key: "leads", label: "Leads registrados", bg: "#a30042", fg: "#ffffff" },
  { key: "horas", label: "Horas ahorradas", bg: "var(--linen)", fg: "var(--ink)" },
];

export default function Screen() {
  const { sede } = useSede();
  const d = dashboardFor(sede);
  const btn = { padding: "8px 14px", borderRadius: "800px", font: "500 14px/14px var(--font-display)", textDecoration: "none", cursor: "pointer" };
  const [period, setPeriod] = useState("hoy");
  const [done, setDone] = useState({}); // aprobaciones resueltas desde Inicio
  const approvals = d.approvals.filter((a) => !done[a.id]);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="inicio" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{`Lunes, 6 de octubre · ${sede}`}</span>
            <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>{`Buenos días, ${d.greetingName}. `}<span style={{ color: "var(--muted)" }}>{`Tus agentes llevan ${scale(d.tasks, FACTOR[period])} tareas ${period === "hoy" ? "hoy" : period === "semana" ? "esta semana" : "este mes"}.`}</span></h1>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Pills label="Periodo" variant="segmented" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
            <a href="/plataforma/agente-nuevo" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", fontSize: "14px", lineHeight: "14px", fontWeight: "500", textDecoration: "none" }}>Añadir agente</a>
          </div>
        </div>

        {sede !== "Sede Norte" && (
          <a href="/plataforma/tomar" style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", borderRadius: "12px", background: "var(--rose-bg)", color: "var(--rose-fg)", padding: "14px 18px", textDecoration: "none", fontSize: "14px", lineHeight: "21px" }}>
            <span aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "800px", background: "#a30042", flex: "none" }} />
            <span style={{ flex: "1 1 260px" }}><strong style={{ fontWeight: 500 }}>Laura Martín pide hablar con una persona.</strong> Molestias tras un implante · WhatsApp · hace 2 min</span>
            <span style={{ fontWeight: 500 }}>Atender →</span>
          </a>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {KPI.map((k) => (
            <div key={k.key} style={{ borderRadius: "12px", background: k.bg, color: k.fg, padding: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", lineHeight: "18px" }}>{k.label}</span>
              <span style={{ fontSize: "32px", lineHeight: "35px", letterSpacing: "-1.28px" }}>{scale(d.kpis[k.key], FACTOR[period])}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "3 1 460px", minWidth: "0", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--line-soft)" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Pendiente de tu aprobación</h2><a href="/plataforma/aprobaciones" style={{ fontSize: "14px", color: "var(--blue-fg)" }}>Ver todo</a></div>
            {approvals.length === 0 && <p style={{ margin: 0, padding: "18px 20px", fontSize: "14px", color: "var(--muted)" }}>Todo al día. No hay nada pendiente de tu aprobación.</p>}
            {approvals.map((a, i) => (
              <div key={a.id ?? i} style={{ padding: "16px 20px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", borderBottom: i < approvals.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <span style={{ padding: "4px 10px", borderRadius: "800px", background: a.tint, color: a.fg, fontSize: "12px", lineHeight: "16px" }}>{a.agent}</span>
                <span style={{ flex: "1 1 220px", fontSize: "14px", lineHeight: "21px" }}>{a.text}{a.sede ? <span style={{ color: "var(--muted-2)" }}> · {a.sede}</span> : null}</span>
                <span style={{ display: "flex", gap: "6px" }}>
                  <a href={`/plataforma/aprobaciones?i=${a.id}`} style={{ ...btn, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}>Revisar</a>
                  <button data-demo="" type="button" onClick={() => setDone((x) => ({ ...x, [a.id]: true }))} style={{ ...btn, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)" }}>Aprobar</button>
                </span>
              </div>
            ))}
          </section>

          <section style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tus agentes</h2>
            {d.agents.map((ag) => (
              <a key={ag.key} href={`/plataforma/agente?a=${ag.key}`} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", alignItems: "center", textDecoration: "none", color: "var(--ink)" }}>
                <span style={{ width: "36px", height: "36px", borderRadius: "800px", background: AGENT_DOT[ag.key], flex: "none" }}></span>
                <span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "14px", fontWeight: "500" }}>{ag.name}</span><span style={{ display: "block", fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{ag.stack}</span></span>
                <span style={{ padding: "4px 10px", borderRadius: "800px", background: ag.status.bg, color: ag.status.fg, fontSize: "12px", whiteSpace: "nowrap" }}>{ag.status.label}</span>
              </a>
            ))}
          </section>
        </div>

        <section style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line-soft)" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Actividad reciente</h2></div>
          {d.activity.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "14px", padding: "14px 20px", borderBottom: i < d.activity.length - 1 ? "1px solid var(--line-soft)" : "none", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}>
              <span style={{ width: "52px", color: "var(--muted-2)" }}>{e.time}</span>
              <span style={{ flex: "1 1 260px" }}>{e.text}{e.sede ? <span style={{ color: "var(--muted-2)" }}> · {e.sede}</span> : null}</span>
              <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{e.via}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
