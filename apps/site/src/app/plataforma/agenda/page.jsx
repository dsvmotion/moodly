"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { agendaFor } from "@/components/sede-data";

// Agenda semanal por sede (ver sede-data). El calendario es por local; «Todas las
// sedes» muestra la vista combinada y la organización en el resumen.
// Semana actual: lunes 6 de octubre de 2026. ‹ › cambian de semana; «Hoy» vuelve.
const MONDAY = new Date(2026, 9, 6);
const WD = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function weekOf(offset) {
  const days = WD.map((w, i) => { const dt = new Date(MONDAY); dt.setDate(MONDAY.getDate() + offset * 7 + i); return { col: i + 2, label: `${w} ${dt.getDate()}`, today: offset === 0 && i === 0, dt }; });
  const a = days[0].dt, b = days[4].dt;
  const title = a.getMonth() === b.getMonth() ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MONTH[b.getMonth()]}` : `Semana del ${a.getDate()} de ${MONTH[a.getMonth()]} al ${b.getDate()} de ${MONTH[b.getMonth()]}`;
  return { days, title };
}
const PRO_RE = /(Dra?\. \w+)/;
// Otras semanas: mismas citas recolocadas (la demo no tiene más agenda) y sin avisos pendientes.
const shiftEvents = (events, offset) => offset === 0 ? events : events.filter((e) => !e.fg).map((e) => ({ ...e, ring: false, col: (((e.col - 2 + offset * 2) % 5) + 5) % 5 + 2 }));
const HOURS = [{ row: 2, t: "9:00" }, { row: 4, t: "10:00" }, { row: 6, t: "11:00" }, { row: 8, t: "12:00" }, { row: 10, t: "13:00" }, { row: 12, t: "14:00" }];

export default function Screen() {
  const { sede } = useSede();
  const d = agendaFor(sede);
  const [offset, setOffset] = useState(0);
  const [pro, setPro] = useState("todos");
  const [notified, setNotified] = useState(false);
  const { days: DAYS, title } = weekOf(offset);
  const pros = [...new Set(d.events.map((e) => (e.sub ?? "").match(PRO_RE)?.[1]).filter(Boolean))];
  const events = shiftEvents(d.events, offset).filter((e) => pro === "todos" || (e.sub ?? "").includes(pro));
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agenda" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Agenda. <span style={{ color: "var(--muted)" }}>{title}.</span></h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)" , cursor: "pointer" }}>‹</button>
            <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)" , cursor: offset === 0 ? "default" : "pointer", opacity: offset === 0 ? 0.5 : 1 }}>Hoy</button>
            <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Semana siguiente" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)" , cursor: "pointer" }}>›</button>
            <label style={{ position: "relative" }}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Profesional</span><select value={pro} onChange={(e) => setPro(e.target.value)} style={{ padding: "9px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/14px var(--font-display)", color: "var(--ink)", cursor: "pointer" }}><option value="todos">{d.pro}</option>{pros.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", lineHeight: "18px", color: "var(--muted)" }}>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "var(--sage)" }}></span>Reservada por Recepción</span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "var(--paper)", boxShadow: "inset 0 0 0 1px var(--line)" }}></span>Añadida a mano</span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "var(--amber-bg)" }}></span>Pendiente de aprobación</span>
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(5, minmax(150px, 1fr))", gridTemplateRows: "48px repeat(12, 52px)", minWidth: "820px", fontSize: "12px", lineHeight: "16px" }}>
            <div style={{ gridColumn: "1", gridRow: "1", borderBottom: "1px solid var(--line)" }}></div>
            {DAYS.map((day) => (
              <div key={day.col} style={{ gridColumn: String(day.col), gridRow: "1", padding: "12px", borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px" }}>{day.today ? <><span style={{ fontWeight: "500" }}>{day.label}</span> <span style={{ color: "var(--blue-fg)" }}>· hoy</span></> : day.label}</div>
            ))}
            {HOURS.map((h) => (<div key={h.t} style={{ gridColumn: "1", gridRow: String(h.row), padding: "4px 8px", color: "var(--muted-2)", textAlign: "right" }}>{h.t}</div>))}
            {[4, 6, 8, 10, 12].map((r) => (<div key={r} style={{ gridColumn: "2 / 7", gridRow: String(r), borderTop: "1px solid var(--line-soft)" }}></div>))}
            {[3, 4, 5, 6].map((c) => (<div key={c} style={{ gridColumn: String(c), gridRow: "2 / 14", borderLeft: "1px solid var(--line-soft)" }}></div>))}
            {events.map((e, i) => { const Tag = e.fg && e.title.includes("citas a mover") ? "a" : "div"; return (
              <Tag key={i} {...(Tag === "a" ? { href: "/plataforma/aprobaciones?i=citas" } : {})} style={{ textDecoration: "none", gridColumn: String(e.col), gridRow: `${e.rs} / ${e.re}`, margin: "3px 6px", borderRadius: "8px", background: e.bg, color: e.fg || "var(--ink)", padding: "6px 8px", boxShadow: e.ring ? "inset 0 0 0 2px var(--green-fg)" : e.border ? "inset 0 0 0 1px var(--line)" : "none" }}>
                <div style={{ fontWeight: "500" }}>{e.title}</div>
                {e.sub ? <div style={{ color: e.subMuted ? "var(--muted-2)" : "inherit" }}>{e.sub}</div> : null}
              </Tag>
            ); })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", borderRadius: "12px", background: "var(--sage)", padding: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}><span style={{ fontSize: "12px" }}>{offset === 0 ? "Esta semana" : offset < 0 ? "Esa semana" : "Previsto esa semana"} Recepción</span><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{d.booked}</span><span>{d.reminders}</span></div>
          <div style={{ flex: "2 1 420px", borderRadius: "12px", background: "var(--paper)", border: "1px solid var(--line)", padding: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
            <span style={{ flex: "1 1 260px" }}><strong style={{ fontWeight: "500" }}>{d.waitlist.strong}</strong> <span style={{ color: "var(--muted)" }}>{d.waitlist.rest}</span></span>
            {notified ? <span style={{ padding: "10px 18px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "14px", lineHeight: "14px" }}>✓ Lista de espera avisada</span> : <button data-demo="" type="button" onClick={() => setNotified(true)} style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)" , cursor: "pointer" }}>Avisar lista de espera</button>}
          </div>
        </div>
      </main>
    </div>
  );
}
