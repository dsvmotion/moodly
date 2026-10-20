"use client";
import { useState } from "react";
import MobileFrame from "@/components/mobile-frame";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { pageData, AGENT_TABLE_COLOR } from "@/components/sede-data";

// Informes (móvil): mismas cifras que escritorio (sede-data) y mismo selector de
// periodo, que escala los totales (las medias no se escalan).
const F = { semana: 0.23, mes: 1, año: 9 };
const TITLE = { semana: "Última semana", mes: "Septiembre", año: "Enero a septiembre" };
const scale = (v, f) => {
  const s = String(v);
  if (s.includes("%") || /\d\s*s$/.test(s)) return v;
  const n = Math.round((parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0) * f);
  return s.includes("€") ? `${n.toLocaleString("es-ES")} €` : s.includes("h") ? `${n.toLocaleString("es-ES")} h` : n.toLocaleString("es-ES");
};

export default function Screen() {
  const { sede } = useSede();
  const d = pageData("informes", sede);
  const [period, setPeriod] = useState("mes");
  const f = F[period];
  const max = Math.max(...d.agents.map((a) => parseFloat(String(a.tasks).replace(/\./g, "")) || 0));
  return (
    <MobileFrame active="mas" back="/plataforma/movil/mas" title="Informes">
      <Pills label="Periodo" variant="segmented" options={[["semana", "Semana"], ["mes", "Mes"], ["año", "Año"]]} value={period} onChange={setPeriod} size="sm" />
      <div style={{ borderRadius: "12px", background: "var(--sage)", padding: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "12px" }}>{`${TITLE[period]} · tiempo ahorrado`}</span>
        <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-1px" }}>{scale(d.hours, f)}</span>
        <span style={{ fontSize: "13px" }}>{d.heroSub}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {Object.entries(d.stats).slice(0, 4).map(([k, v]) => (
          <div key={k} style={{ background: "var(--paper)", borderRadius: "12px", padding: "14px" }}><span style={{ display: "block", fontSize: "12px", color: "var(--muted)" }}>{k}</span><span style={{ fontSize: "22px", letterSpacing: "-0.4px" }}>{scale(v, f)}</span></div>
        ))}
      </div>
      <div style={{ background: "var(--paper)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <span style={{ fontWeight: 500 }}>Por agente</span>
        {d.agents.map((a) => { const t = parseFloat(String(a.tasks).replace(/\./g, "")) || 0; return (
          <span key={a.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ display: "flex", justifyContent: "space-between" }}><span>{a.name}</span><span style={{ color: "var(--muted-2)" }}>{`${scale(a.tasks, f)} tareas`}</span></span>
            <span style={{ height: "6px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: `${max ? (t / max) * 100 : 0}%`, height: "6px", borderRadius: "800px", background: AGENT_TABLE_COLOR[a.key] }} /></span>
          </span>
        ); })}
      </div>
    </MobileFrame>
  );
}
