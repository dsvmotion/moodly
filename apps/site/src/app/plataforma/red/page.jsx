import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

// Vista del FRANQUICIADOR (red/grupo). Modela la entidad `networks` del backend
// (auditoría de plataforma §4.1): cada franquiciado es su propia organización con
// sus datos y su RGPD; la central solo ve métricas agregadas o lo que cada
// franquiciado comparte, y publica plantillas y políticas de red bloqueadas.
const KPIS = [
  { label: "Franquiciados activos", value: "12", bg: "var(--sage)" },
  { label: "Sedes en la red", value: "34", bg: "var(--mist)" },
  { label: "Conversaciones (mes)", value: "18.420", bg: "var(--linen)" },
  { label: "Satisfacción media", value: "4,6", bg: "var(--linen)" },
];

// `shares`: qué comparte cada franquiciado. "agg" = solo agregados; "full" = agregados + conversaciones.
const FRANCHISEES = [
  { name: "Dental Sol Centro", owner: "Marta Ruiz", sedes: 3, agents: 4, convs: "2.140", compliance: 100, shares: "full", status: "Al día", statusColor: "var(--green-fg)", statusBg: "var(--green-bg)" },
  { name: "Dental Sol Norte", owner: "Javier Pons", sedes: 2, agents: 4, convs: "1.580", compliance: 96, shares: "full", status: "Al día", statusColor: "var(--green-fg)", statusBg: "var(--green-bg)" },
  { name: "Clínica Vallès", owner: "Núria Camps", sedes: 4, agents: 3, convs: "—", compliance: 88, shares: "agg", status: "Revisar plantilla", statusColor: "var(--amber-fg)", statusBg: "var(--amber-bg)" },
  { name: "SonrisaMar", owner: "Luis Ferrer", sedes: 5, agents: 4, convs: "3.010", compliance: 72, shares: "full", status: "Fuera de política", statusColor: "var(--rose-fg)", statusBg: "var(--rose-bg-3)" },
  { name: "Dental Sol Levante", owner: "Ana Gil", sedes: 6, agents: 2, convs: "—", compliance: 91, shares: "agg", status: "Al día", statusColor: "var(--green-fg)", statusBg: "var(--green-bg)" },
];

// Lo que la central fija para toda la red (claves bloqueadas: el franquiciado no las relaja).
const POLICIES = [
  { t: "Tono y lenguaje de marca", locked: true },
  { t: "Nunca dar consejo clínico por chat", locked: true },
  { t: "Techo de autonomía: dinero siempre con aprobación", locked: true },
  { t: "Horario de atención", locked: false },
  { t: "Catálogo de servicios y precios", locked: false },
];

export default function Screen() {
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="red" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Red. <span style={{ color: "var(--muted)" }}>Grupo Dental Sol · 12 franquiciados · 34 sedes.</span></h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)" }}>Publicar plantilla</button>
            <button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)" }}>Invitar franquiciado</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", borderRadius: "12px", background: "var(--linen)", padding: "14px 18px", fontSize: "14px", lineHeight: "21px" }}>
          <span aria-hidden="true" style={{ flex: "none", marginTop: "1px" }}>🔒</span>
          <span><strong style={{ fontWeight: "500" }}>Separación de datos.</strong> Cada franquiciado es su propia empresa. Solo ves métricas agregadas y lo que cada uno decide compartir — nunca sus conversaciones ni los datos de sus clientes.</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {KPIS.map((k, i) => (
            <div key={i} style={{ borderRadius: "12px", background: k.bg, padding: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", lineHeight: "18px" }}>{k.label}</span>
              <span style={{ fontSize: "32px", lineHeight: "35px", letterSpacing: "-1.28px" }}>{k.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "3 1 480px", minWidth: "0", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--line-soft)" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Franquiciados</h2>
              <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Cumplimiento de plantilla de red</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "620px" }}>
              <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}>
                <th style={{ padding: "10px 20px", fontWeight: "500" }}>Franquiciado</th>
                <th style={{ padding: "10px", fontWeight: "500" }}>Sedes</th>
                <th style={{ padding: "10px", fontWeight: "500" }}>Agentes</th>
                <th style={{ padding: "10px", fontWeight: "500" }}>Conversaciones</th>
                <th style={{ padding: "10px", fontWeight: "500" }}>Cumplimiento</th>
                <th style={{ padding: "10px 20px", fontWeight: "500" }}>Estado</th>
              </tr></thead>
              <tbody>
                {FRANCHISEES.map((f, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "12px 20px" }}><span style={{ display: "block", fontWeight: "500" }}>{f.name}</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{f.owner}</span></td>
                    <td style={{ padding: "12px 10px" }}>{f.sedes}</td>
                    <td style={{ padding: "12px 10px" }}>{f.agents}</td>
                    <td style={{ padding: "12px 10px", color: f.convs === "—" ? "var(--muted-4)" : "var(--ink)" }}>{f.convs}{f.shares === "agg" ? <span style={{ display: "block", fontSize: "12px", color: "var(--muted-4)" }}>solo agregados</span> : null}</td>
                    <td style={{ padding: "12px 10px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "48px", height: "6px", borderRadius: "800px", background: "var(--sunken)", flex: "none" }}><span style={{ display: "block", width: `${f.compliance}%`, height: "6px", borderRadius: "800px", background: f.compliance >= 90 ? "#004c39" : f.compliance >= 80 ? "#8e4e00" : "#a30042" }}></span></span>
                        <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{f.compliance}%</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px" }}><span style={{ padding: "4px 10px", borderRadius: "800px", background: f.statusBg, color: f.statusColor, fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" }}>{f.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Lo que fija la central</h2>
                <span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>Entra como un nivel más de herencia: red → empresa → sede.</span>
              </div>
              {POLICIES.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "14px 20px", borderTop: i === 0 ? "0" : "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px" }}>
                  <span style={{ flex: "1" }}>{p.t}</span>
                  {p.locked ? <span style={{ padding: "4px 10px", borderRadius: "800px", background: "var(--sunken)", color: "var(--muted)", fontSize: "12px" }}>🔒 Bloqueado</span> : <span style={{ padding: "4px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>La sede ajusta</span>}
                </div>
              ))}
            </div>
            <div style={{ borderRadius: "12px", background: "#004c39", color: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>Mejora de la red este mes</span>
              <span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>+1.240 citas</span>
              <span style={{ opacity: 0.85 }}>desde que la plantilla de Recepción se publicó a toda la red.</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
