"use client";
import { useState } from "react";
import MobileFrame from "@/components/mobile-frame";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { pageData, clientDetail } from "@/components/sede-data";

// Clientes (móvil): mismos datos que escritorio. Filtros y buscador reales; tocar
// un cliente despliega su ficha rápida con acciones.
const FILTERS = [["todos", "Todos"], ["cita", "Cita próxima"], ["inactivo", "Sin venir 6+ meses"]];

export default function Screen() {
  const { sede } = useSede();
  const d = pageData("clientes", sede);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const visible = d.list.filter((c) => (filter === "todos" || (c.seg ?? []).includes(filter)) && (!q.trim() || `${c.name} ${c.sub}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <MobileFrame active="mas" back="/plataforma/movil/mas" title="Clientes" right={<button data-demo="" type="button" aria-label="Añadir cliente" style={{ width: "36px", height: "36px", borderRadius: "800px", border: 0, background: "var(--ink)", color: "var(--on-ink)", fontSize: "18px", cursor: "pointer" }}>+</button>}>
      <label htmlFor="q" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar</label>
      <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o motivo" style={{ padding: "12px 16px", borderRadius: "800px", border: 0, background: "var(--paper)", font: "400 15px/20px var(--font-display)", color: "var(--ink)" }} />
      <Pills label="Filtrar clientes" options={FILTERS} value={filter} onChange={setFilter} size="sm" />
      <div style={{ background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
        {visible.length === 0 && <p style={{ margin: 0, padding: "16px 14px", color: "var(--muted)" }}>Ningún cliente con este filtro.</p>}
        {visible.map((c, i) => {
          const on = open === c.name; const det = on ? clientDetail(c) : null;
          return (
            <div key={`${c.name}${c.sede ?? ""}`} style={{ borderTop: i ? "1px solid var(--line-soft)" : 0 }}>
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : c.name)} style={{ width: "100%", textAlign: "left", display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", border: 0, background: on ? "var(--tint-a)" : "transparent", font: "inherit", color: "var(--ink)", cursor: "pointer" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "800px", background: c.color, boxShadow: c.color === "var(--linen)" ? "inset 0 0 0 1px var(--line)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flex: "none" }}>{c.initials}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 500 }}>{c.name}</span><span style={{ display: "block", fontSize: "12px", color: "var(--muted-2)" }}>{c.sub}{c.sede ? ` · ${c.sede}` : ""}</span></span>
                <span aria-hidden="true" style={{ color: "var(--muted-2)" }}>{on ? "⌃" : "⌄"}</span>
              </button>
              {det && (
                <div style={{ padding: "0 14px 14px 66px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <span style={{ color: "var(--muted)" }}>{det.meta}</span>
                  <span style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>{Object.entries(det.stats).map(([k, v]) => <span key={k}><span style={{ color: "var(--muted-2)" }}>{k}: </span>{v}</span>)}</span>
                  <span style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <a href={`/plataforma/movil/conversacion?c=${encodeURIComponent(c.name.split(" ")[0])}`} style={{ padding: "8px 14px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", textDecoration: "none" }}>Escribir</a>
                    <a href="/plataforma/movil/agenda" style={{ padding: "8px 14px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px var(--line)", color: "var(--ink)", textDecoration: "none" }}>Nueva cita</a>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MobileFrame>
  );
}
