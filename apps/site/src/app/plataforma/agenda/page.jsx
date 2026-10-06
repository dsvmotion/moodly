"use client";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { agendaFor } from "@/components/sede-data";

// Agenda semanal por sede (ver sede-data). El calendario es por local; «Todas las
// sedes» muestra la vista combinada y la organización en el resumen.
const DAYS = [{ col: 2, label: "Lun 6", today: true }, { col: 3, label: "Mar 7" }, { col: 4, label: "Mié 8" }, { col: 5, label: "Jue 9" }, { col: 6, label: "Vie 10" }];
const HOURS = [{ row: 2, t: "9:00" }, { row: 4, t: "10:00" }, { row: 6, t: "11:00" }, { row: 8, t: "12:00" }, { row: 10, t: "13:00" }, { row: 12, t: "14:00" }];

export default function Screen() {
  const { sede } = useSede();
  const d = agendaFor(sede);
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agenda" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px" }}>Agenda. <span style={{ color: "#5f5f63" }}>Semana del 6 al 10 de octubre.</span></h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button data-demo="" type="button" aria-label="Semana anterior" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>‹</button>
            <button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Hoy</button>
            <button data-demo="" type="button" aria-label="Semana siguiente" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>›</button>
            <span style={{ padding: "8px 14px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", fontSize: "14px", lineHeight: "14px" }}>{d.pro} ⌄</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", lineHeight: "18px", color: "#5f5f63" }}>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#a3c2a7" }}></span>Reservada por Recepción</span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#ffffff", boxShadow: "inset 0 0 0 1px #0000001a" }}></span>Añadida a mano</span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#ffe8d6" }}></span>Pendiente de aprobación</span>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(5, minmax(150px, 1fr))", gridTemplateRows: "48px repeat(12, 52px)", minWidth: "820px", fontSize: "12px", lineHeight: "16px" }}>
            <div style={{ gridColumn: "1", gridRow: "1", borderBottom: "1px solid #0000001a" }}></div>
            {DAYS.map((day) => (
              <div key={day.col} style={{ gridColumn: String(day.col), gridRow: "1", padding: "12px", borderBottom: "1px solid #0000001a", borderLeft: "1px solid #0000000f", fontSize: "14px", lineHeight: "21px" }}>{day.today ? <><span style={{ fontWeight: "500" }}>{day.label}</span> <span style={{ color: "#2457f5" }}>· hoy</span></> : day.label}</div>
            ))}
            {HOURS.map((h) => (<div key={h.t} style={{ gridColumn: "1", gridRow: String(h.row), padding: "4px 8px", color: "#6b6b70", textAlign: "right" }}>{h.t}</div>))}
            {[4, 6, 8, 10, 12].map((r) => (<div key={r} style={{ gridColumn: "2 / 7", gridRow: String(r), borderTop: "1px solid #0000000f" }}></div>))}
            {[3, 4, 5, 6].map((c) => (<div key={c} style={{ gridColumn: String(c), gridRow: "2 / 14", borderLeft: "1px solid #0000000f" }}></div>))}
            {d.events.map((e, i) => (
              <div key={i} style={{ gridColumn: String(e.col), gridRow: `${e.rs} / ${e.re}`, margin: "3px 6px", borderRadius: "8px", background: e.bg, color: e.fg || "#000000", padding: "6px 8px", boxShadow: e.ring ? "inset 0 0 0 2px #004c39" : e.border ? "inset 0 0 0 1px #0000001a" : "none" }}>
                <div style={{ fontWeight: "500" }}>{e.title}</div>
                {e.sub ? <div style={{ color: e.subMuted ? "#6b6b70" : "inherit" }}>{e.sub}</div> : null}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", borderRadius: "12px", background: "#a3c2a7", padding: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}><span style={{ fontSize: "12px" }}>Esta semana Recepción</span><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{d.booked}</span><span>{d.reminders}</span></div>
          <div style={{ flex: "2 1 420px", borderRadius: "12px", background: "#ffffff", border: "1px solid #0000001a", padding: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
            <span style={{ flex: "1 1 260px" }}><strong style={{ fontWeight: "500" }}>{d.waitlist.strong}</strong> <span style={{ color: "#5f5f63" }}>{d.waitlist.rest}</span></span>
            <button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Avisar lista de espera</button>
          </div>
        </div>
      </main>
    </div>
  );
}
