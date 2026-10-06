"use client";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { AGENT_DOT, dashboardFor } from "@/components/sede-data";

// Inicio del panel. Los datos salen de la sede activa (ver sede-data): cada sede
// tiene los suyos y «Todas las sedes» muestra la organización agregada.

const KPI = [
  { key: "conversaciones", label: "Conversaciones atendidas", bg: "#a3c2a7", fg: "#000000" },
  { key: "citas", label: "Citas reservadas", bg: "#9dbecc", fg: "#000000" },
  { key: "leads", label: "Leads registrados", bg: "#a30042", fg: "#ffffff" },
  { key: "horas", label: "Horas ahorradas", bg: "#f6f2e8", fg: "#000000" },
];

export default function Screen() {
  const { sede } = useSede();
  const d = dashboardFor(sede);
  const btn = { padding: "8px 14px", borderRadius: "800px", font: "500 14px/14px var(--font-display)" };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="inicio" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>Lunes, 6 de octubre · {sede}</span>
            <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Buenos días, {d.greetingName}. <span style={{ color: "#5f5f63" }}>Tus agentes llevan {d.tasks} tareas hoy.</span></h1>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Hoy ⌄</button>
            <a href="/plataforma/onboarding" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "14px", fontWeight: "500" }}>Añadir agente</a>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {KPI.map((k) => (
            <div key={k.key} style={{ borderRadius: "12px", background: k.bg, color: k.fg, padding: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", lineHeight: "18px" }}>{k.label}</span>
              <span style={{ fontSize: "32px", lineHeight: "35px", letterSpacing: "-1.28px" }}>{d.kpis[k.key]}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "3 1 460px", minWidth: "0", background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #0000000f" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Pendiente de tu aprobación</h2><a href="/plataforma/aprobaciones" style={{ fontSize: "14px", color: "#2457f5" }}>Ver todo</a></div>
            {d.approvals.map((a, i) => (
              <div key={i} style={{ padding: "16px 20px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", borderBottom: i < d.approvals.length - 1 ? "1px solid #0000000f" : "none" }}>
                <span style={{ padding: "4px 10px", borderRadius: "800px", background: a.tint, color: a.fg, fontSize: "12px", lineHeight: "16px" }}>{a.agent}</span>
                <span style={{ flex: "1 1 220px", fontSize: "14px", lineHeight: "21px" }}>{a.text}{a.sede ? <span style={{ color: "#6b6b70" }}> · {a.sede}</span> : null}</span>
                <span style={{ display: "flex", gap: "6px" }}>
                  <button data-demo="" type="button" style={{ ...btn, border: "1px solid #0000001a", background: "#ffffff", color: "#000000" }}>Revisar</button>
                  <button data-demo="" type="button" style={{ ...btn, border: "1px solid #000000", background: "#000000", color: "#ffffff" }}>Aprobar</button>
                </span>
              </div>
            ))}
          </section>

          <section style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tus agentes</h2>
            {d.agents.map((ag) => (
              <a key={ag.key} href={ag.key === "recepcion" ? "/plataforma/agente" : "#"} data-demo={ag.key === "recepcion" ? undefined : ""} style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", alignItems: "center", textDecoration: "none", color: "#000000" }}>
                <span style={{ width: "36px", height: "36px", borderRadius: "800px", background: AGENT_DOT[ag.key], flex: "none" }}></span>
                <span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "14px", fontWeight: "500" }}>{ag.name}</span><span style={{ display: "block", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{ag.stack}</span></span>
                <span style={{ padding: "4px 10px", borderRadius: "800px", background: ag.status.bg, color: ag.status.fg, fontSize: "12px", whiteSpace: "nowrap" }}>{ag.status.label}</span>
              </a>
            ))}
          </section>
        </div>

        <section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #0000000f" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Actividad reciente</h2></div>
          {d.activity.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "14px", padding: "14px 20px", borderBottom: i < d.activity.length - 1 ? "1px solid #0000000f" : "none", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}>
              <span style={{ width: "52px", color: "#6b6b70" }}>{e.time}</span>
              <span style={{ flex: "1 1 260px" }}>{e.text}{e.sede ? <span style={{ color: "#6b6b70" }}> · {e.sede}</span> : null}</span>
              <span style={{ fontSize: "12px", color: "#6b6b70" }}>{e.via}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
