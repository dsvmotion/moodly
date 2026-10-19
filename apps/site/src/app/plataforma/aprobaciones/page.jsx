"use client";
import { Fragment, useEffect, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { approvalsFor } from "@/components/sede-data";

// Aprobaciones por sede (fuente única en sede-data) con estado local. Admite ?i=id
// para abrir una concreta (desde Inicio). TODO(backend): leer y resolver `approvals`.

const pill = (on) => ({ padding: "8px 14px", borderRadius: "800px", border: 0, background: on ? "#000000" : "transparent", boxShadow: on ? "none" : "inset 0 0 0 1px #0000001a", color: on ? "#ffffff" : "#000000", font: "400 14px/14px var(--font-display)", cursor: "pointer" });
const btn = (kind) => ({ padding: "10px 18px", borderRadius: "800px", border: kind === "primary" ? "1px solid #000000" : "1px solid #0000001a", background: kind === "primary" ? "#000000" : "#ffffff", color: kind === "primary" ? "#ffffff" : kind === "danger" ? "#a30042" : "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" });

export default function Aprobaciones() {
  const { sede } = useSede();
  const ITEMS = approvalsFor(sede);
  const [status, setStatus] = useState({});
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState(null);
  // ?i=id → abre esa aprobación (desde Inicio o una conversación).
  useEffect(() => { const i = new URLSearchParams(window.location.search).get("i"); if (i) setSelected(i); }, []);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const list = ITEMS.filter((i) => (status[i.id] || "pending") === tab);
  const current = ITEMS.find((i) => i.id === selected && (status[i.id] || "pending") === tab) || list[0];
  const pending = ITEMS.filter((i) => !status[i.id]).length;

  const resolve = (value) => {
    const next = { ...status, [current.id]: value };
    setStatus(next); setEditing(false);
    const rest = ITEMS.filter((i) => !next[i.id]);
    if (rest[0]) setSelected(rest[0].id);
  };
  const count = (s) => ITEMS.filter((i) => (status[i.id] || "pending") === s).length;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="aprobaciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-1.28px" }}>Aprobaciones. <span style={{ color: "#5f5f63" }}>{pending ? `${pending} ${pending === 1 ? "tarea espera" : "tareas esperan"} tu visto bueno.` : "Todo al día."}</span></h1>
          <div role="tablist" aria-label="Estado" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[["pending", "Pendientes"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setEditing(false); }} style={pill(tab === id)}>{label} · {count(id)}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section aria-label="Tareas" style={{ flex: "2 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {list.length === 0 && <p style={{ margin: 0, padding: "24px", background: "#ffffff", borderRadius: "12px", color: "#5f5f63", fontSize: "14px" }}>No hay tareas en esta lista.</p>}
            {list.map((i) => (
              <button key={i.id} type="button" aria-pressed={current && current.id === i.id} onClick={() => { setSelected(i.id); setEditing(false); }} style={{ textAlign: "left", background: "#ffffff", border: current && current.id === i.id ? "2px solid #000000" : "1px solid #0000001a", borderRadius: "12px", padding: current && current.id === i.id ? "17px" : "18px", display: "flex", flexDirection: "column", gap: "8px", font: "inherit", color: "inherit", cursor: "pointer" }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: "8px", width: "100%" }}><span style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "20px", height: "20px", borderRadius: "800px", background: i.color }} /><span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{i.agent} · {i.when}{i.sede ? ` · ${i.sede}` : ""}</span></span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", fontSize: "12px", lineHeight: "18px" }}>! {i.tag}</span></span>
                <span style={{ fontSize: "14px", lineHeight: "21px", fontWeight: 500 }}>{i.title}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{i.note}</span>
              </button>
            ))}
          </section>

          {current && (
            <section aria-label="Detalle" style={{ flex: "3 1 460px", minWidth: 0, background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #0000000f", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>Preparado por {current.agent}</span>
                  <h2 style={{ margin: 0, fontSize: "24px", lineHeight: "26.4px", fontWeight: 400, letterSpacing: "-0.48px" }}>{current.head}</h2>
                </div>
                {current.tag === "Factura" && <a href="/plataforma/revisar" style={{ fontSize: "14px", color: "#2457f5", textDecoration: "none", flex: "none" }}>Ver factura completa →</a>}
              </div>
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
                {current.lines && (
                  <div style={{ border: "1px solid #0000001a", borderRadius: "12px", padding: "20px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 24px" }}>
                    {current.lines.map(([a, b]) => (<Fragment key={a}><span>{a}</span><span style={{ textAlign: "right" }}>{b}</span></Fragment>))}
                    {current.total && (<><span style={{ fontWeight: 500, borderTop: "1px solid #0000000f", paddingTop: "8px" }}>Total</span><span style={{ fontWeight: 500, borderTop: "1px solid #0000000f", paddingTop: "8px", textAlign: "right" }}>{current.total}</span></>)}
                  </div>
                )}
                {current.quote && <blockquote style={{ margin: 0, padding: "14px 16px", borderRadius: "12px", background: "#f4f4f5" }}>{current.quote}</blockquote>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label htmlFor="msg" style={{ fontSize: "12px", color: "#6b6b70" }}>Mensaje que se enviará</label>
                  {editing
                    ? <textarea id="msg" rows={4} value={drafts[current.id] ?? current.message} onChange={(e) => setDrafts({ ...drafts, [current.id]: e.target.value })} style={{ font: "400 14px/21px var(--font-body)", padding: "12px 14px", borderRadius: "12px", border: "1px solid #0000001a", resize: "vertical" }} />
                    : <div id="msg" style={{ alignSelf: "flex-start", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{drafts[current.id] ?? current.message}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#5f5f63" }}>
                  <span style={{ fontSize: "12px", color: "#6b6b70" }}>Por qué necesita aprobación</span>
                  <span>{current.rule} <a href="/plataforma/reglas" style={{ color: "#2457f5" }}>Cambiar regla</a></span>
                </div>
              </div>
              {tab === "pending" ? (
                <div style={{ marginTop: "auto", padding: "16px 24px", borderTop: "1px solid #0000000f", display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => resolve("rejected")} style={btn("danger")}>Rechazar</button>
                  <span style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={() => setEditing(!editing)} style={btn()}>{editing ? "Listo" : "Editar"}</button>
                    <button type="button" onClick={() => resolve("approved")} style={btn("primary")}>Aprobar y enviar</button>
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: "auto", padding: "16px 24px", borderTop: "1px solid #0000000f", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" }}>
                  <span style={{ color: tab === "approved" ? "#004c39" : "#a30042" }}>{tab === "approved" ? "✓ Aprobada y enviada" : "× Rechazada: el agente no lo hará"}</span>
                  <button type="button" onClick={() => { const n = { ...status }; delete n[current.id]; setStatus(n); setTab("pending"); setSelected(current.id); }} style={btn()}>Deshacer</button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
