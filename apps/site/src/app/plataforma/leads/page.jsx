"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { pageData } from "@/components/sede-data";

// Leads por sede (ver sede-data): tablero por etapas. El filtro de origen filtra;
// cada tarjeta abre su ficha en un panel; «Mover a la siguiente etapa» la cambia
// de columna (estado local). TODO(backend): deals.stage + audit_logs.
const ORIGINS = [["todos", "Todos los orígenes"], ["WhatsApp", "WhatsApp"], ["Web", "Web"], ["Instagram", "Instagram"]];
const CLIENTS = ["Ana Torres", "Javier Ramos", "Diego Cuevas", "Nuria Ferrer", "Laura Martín", "Pedro García", "Jorge López", "Sara Pérez", "Marta Lillo"];
const btn = (dark) => ({ padding: "10px 16px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "500 14px/14px var(--font-display)", textDecoration: "none", cursor: "pointer", textAlign: "center" });

export default function Screen() {
  const { sede } = useSede();
  const d = pageData("leads", sede);
  const [origin, setOrigin] = useState("todos");
  const [moves, setMoves] = useState({}); // "sede|nombre" → índice de columna
  const [open, setOpen] = useState(null);  // nombre del lead abierto
  const idOf = (c) => `${sede}|${c.name}`;

  // Reparte las tarjetas según los movimientos hechos aquí.
  const cols = d.columns.map((col) => ({ ...col, cards: [] }));
  d.columns.forEach((col, ci) => col.cards.forEach((c) => {
    const to = c.won ? ci : (moves[idOf(c)] ?? ci);
    cols[to].cards.push({ ...c, stage: ci });
  }));
  const lead = open ? cols.flatMap((col, ci) => col.cards.map((c) => ({ ...c, col: ci }))).find((c) => c.name === open) : null;
  const moveNext = (c) => setMoves((m) => ({ ...m, [idOf(c)]: Math.min(c.col + 1, cols.length - 1) }));

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="leads" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Leads. <span style={{ color: "#5f5f63" }}>{d.open} oportunidades abiertas · {d.budget} en presupuestos.</span></h1>
          <Pills label="Origen" options={ORIGINS} value={origin} onChange={setOrigin} size="sm" />
        </div>

        <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(240px, 1fr))`, gap: "16px", minWidth: "1000px", fontSize: "14px", lineHeight: "21px" }}>
            {cols.map((col) => {
              const shown = col.cards.filter((c) => c.won || origin === "todos" || c.via === origin);
              const real = shown.filter((c) => !c.won).length;
              const rest = origin === "todos" ? Math.max(0, col.count - col.cards.filter((c) => !c.won).length) : 0;
              return (
                <section key={col.title} style={{ background: "#ebebed", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px" }}><span style={{ fontWeight: "500" }}>{col.title}</span><span style={{ color: "#5f5f63" }}>{origin === "todos" ? col.count : real}</span></div>
                  {shown.map((c, i) => c.won ? (
                    <div key={`w${i}`} style={{ background: "#a30042", color: "#ffffff", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ opacity: ".75" }}>{c.label}</span><span style={{ fontSize: "24px", lineHeight: "26px", letterSpacing: "-0.48px" }}>{c.value}</span></div>
                  ) : (
                    <button key={c.name} type="button" onClick={() => setOpen(c.name)} aria-pressed={open === c.name} style={{ textAlign: "left", background: "#ffffff", border: open === c.name ? "2px solid #000000" : "2px solid transparent", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", font: "inherit", color: "#000000", cursor: "pointer" }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "500" }}>{c.name}</span>{c.pill ? <span style={{ padding: "0 8px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "20px" }}>{c.pill}</span> : null}</span>
                      <span style={{ color: "#5f5f63" }}>{c.sub}</span>
                      {c.tag ? <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "800px", background: c.tagBg, color: c.tagFg, fontSize: "12px" }}>{c.tag}</span> : null}
                      {c.note ? <span style={{ fontSize: "12px", color: "#6b6b70" }}>{c.note}</span> : null}
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b6b70" }}><span>{c.via}{c.sede ? ` · ${c.sede}` : ""}</span><span>{c.when ?? ""}</span></span>
                    </button>
                  ))}
                  {real === 0 && !shown.some((c) => c.won) && <span style={{ padding: "8px 6px", fontSize: "12px", color: "#6b6b70" }}>Sin leads de este origen.</span>}
                  {rest > 0 && <span style={{ padding: "2px 6px", fontSize: "12px", color: "#6b6b70" }}>+ {rest} más en esta etapa</span>}
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {lead && (
        <div role="dialog" aria-modal="true" aria-label={`Lead ${lead.name}`} onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "#00000040", display: "flex", justifyContent: "flex-end" }}>
          <aside onClick={(e) => e.stopPropagation()} style={{ width: "min(420px, 100%)", height: "100%", background: "#ffffff", boxShadow: "-12px 0 40px #00000026", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto", fontSize: "14px", lineHeight: "21px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: "800px", background: "#fbe1ea", color: "#a30042", fontSize: "12px" }}>{cols[lead.col].title}</span>
                <span style={{ fontSize: "24px", lineHeight: "28px", letterSpacing: "-0.48px" }}>{lead.name}</span>
                <span style={{ color: "#5f5f63" }}>{lead.sub}</span>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Cerrar" style={{ width: "32px", height: "32px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", cursor: "pointer", flex: "none" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}>
              {[["Origen", lead.via], ["Etapa", cols[lead.col].title], ["Lo lleva", "Comercial"], lead.sede ? ["Sede", lead.sede] : null, lead.when ? ["Entró", lead.when] : null].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ color: "#5f5f63" }}>{k}</span><span>{v}</span></div>
              ))}
            </div>
            {(lead.note || lead.tag) && <div style={{ background: "#f6f2e8", borderRadius: "12px", padding: "12px 14px" }}>{lead.tag ?? ""}{lead.tag && lead.note ? " · " : ""}{lead.note ?? ""}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
              {lead.col < cols.length - 1 && <button type="button" onClick={() => moveNext(lead)} style={btn(true)}>Mover a «{cols[lead.col + 1].title}»</button>}
              <a href={`/plataforma/conversaciones?c=${encodeURIComponent(lead.name)}`} style={btn(false)}>Escribir</a>
              {CLIENTS.includes(lead.name) ? <a href={`/plataforma/clientes?c=${encodeURIComponent(lead.name)}`} style={btn(false)}>Ver ficha de cliente</a> : <span style={{ textAlign: "center", fontSize: "12px", color: "#6b6b70" }}>Aún no es cliente: tendrá ficha al reservar su primera visita.</span>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
