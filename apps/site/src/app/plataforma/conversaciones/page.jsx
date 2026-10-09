"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { convsFor } from "@/components/sede-data";

// Conversaciones por sede (ver sede-data): bandeja, conversación activa y ficha del
// CRM. «Todas las sedes» une las bandejas de cada sede con su etiqueta.
export default function Screen() {
  const { sede } = useSede();
  const d = convsFor(sede);
  const [mine, setMine] = useState([]);
  const [draft, setDraft] = useState("");
  const [human, setHuman] = useState(false);
  const send = () => { const t = draft.trim(); if (!t) return; setMine([...mine, t]); setDraft(""); setHuman(true); };
  const crm = d.crm;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="conversaciones" /></div>

      <section style={{ flex: "1 1 300px", maxWidth: "360px", borderRight: "1px solid #0000000f", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "20px 16px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h1 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>Conversaciones</h1>
          <label htmlFor="buscar" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar</label>
          <input id="buscar" type="search" placeholder="Buscar por nombre o mensaje" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/21px var(--font-display)", color: "#000000" }} />
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ padding: "6px 12px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "14px" }}>Todas</span>
            <span style={{ padding: "6px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", fontSize: "14px", lineHeight: "14px" }}>Necesitan atención</span>
            <span style={{ padding: "6px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a", fontSize: "14px", lineHeight: "14px" }}>Resueltas</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 8px", gap: "2px", fontSize: "14px", lineHeight: "21px" }}>
          {d.list.map((c, i) => (
            <a key={i} href="#" data-demo="" style={{ padding: "12px", borderRadius: "12px", background: c.active ? "#ffffff" : "transparent", border: c.active ? "1px solid #0000001a" : "none", display: "flex", flexDirection: "column", gap: "2px", textDecoration: "none", color: "#000000" }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{c.name}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>{c.time}</span></span>
              <span style={{ color: "#5f5f63" }}>{c.preview}</span>
              <span style={{ fontSize: "12px", lineHeight: "18px", color: c.metaColor || "#6b6b70" }}>{c.meta}{c.sede ? ` · ${c.sede}` : ""}</span>
            </a>
          ))}
        </div>
      </section>

      <main style={{ flex: "999 1 420px", minWidth: "0", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #0000000f", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div><div style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{d.header.name}</div><div style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{d.header.channel} · {human ? "Atendida por ti · agente en pausa" : "Atendida por el agente"}</div></div>
          <div style={{ display: "flex", gap: "8px" }}><button type="button" onClick={() => setHuman(!human)} style={{ padding: "10px 18px", borderRadius: "800px", border: human ? "1px solid #000000" : "1px solid #0000001a", background: human ? "#000000" : "#ffffff", color: human ? "#ffffff" : "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>{human ? "Devolver al agente" : "Tomar el control"}</button><button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Marcar resuelta</button></div>
        </div>
        <div style={{ flex: "1", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
          <div style={{ alignSelf: "center", fontSize: "12px", color: "#6b6b70" }}>Hoy</div>
          {d.thread.map((m, i) => {
            if (m.from === "them") return <div key={i} style={{ alignSelf: "flex-start", background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "10px 14px", maxWidth: "65%" }}>{m.text}</div>;
            if (m.from === "agent") return <div key={i} style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "65%" }}>{m.text}</div>;
            if (m.from === "agent-actions") return (
              <div key={i} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", gap: "6px", maxWidth: "65%", alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>{m.chips.map((ch, j) => (<span key={j} style={{ padding: "6px 12px", borderRadius: "800px", background: ch.bg, fontSize: "12px", lineHeight: "14px" }}>{ch.text}</span>))}</div>
                <div style={{ background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px" }}>{m.text}</div>
              </div>
            );
            if (m.from === "approval") return (
              <div key={i} style={{ alignSelf: "stretch", borderRadius: "12px", background: "#ffe8d6", color: "#8e4e00", padding: "14px 18px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 260px" }}><strong style={{ fontWeight: "500" }}>Necesita tu aprobación.</strong> {m.text}</span>
                <span style={{ display: "flex", gap: "6px" }}><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #8e4e0040", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Ver</button><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Aprobar y enviar</button></span>
              </div>
            );
            return null;
          })}
          {mine.map((t, i) => (<div key={i} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", maxWidth: "65%" }}><div style={{ background: "#2457f5", color: "#ffffff", borderRadius: "12px", padding: "10px 14px" }}>{t}</div><span style={{ fontSize: "12px", color: "#6b6b70" }}>Tú · ahora</span></div>))}
        </div>
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "14px 14px 14px 18px", display: "flex", gap: "12px", alignItems: "center" }}>
            <label htmlFor="msg" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensaje</label>
            <input id="msg" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Escribe para responder tú, o pide algo al agente…" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "#000000" }} />
            <button type="button" onClick={send} aria-label="Enviar" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "0", background: "#2457f5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
          </div>
        </div>
      </main>

      <aside style={{ flex: "1 1 260px", maxWidth: "300px", borderLeft: "1px solid #0000000f", padding: "24px 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
          <span style={{ width: "48px", height: "48px", borderRadius: "800px", background: crm.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "500" }}>{crm.initials}</span>
          <div><div style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{crm.name}</div><div style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{crm.since}</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #0000000f", paddingTop: "16px" }}>
          <span style={{ fontSize: "12px", color: "#6b6b70" }}>Ficha del CRM</span>
          {Object.entries(crm.rows).map(([k, v]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#5f5f63" }}>{k}</span><span>{v}</span></div>))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #0000000f", paddingTop: "16px" }}>
          <span style={{ fontSize: "12px", color: "#6b6b70" }}>El agente recuerda</span>
          {crm.notes.map((n, i) => (<div key={i} style={{ background: "#f6f2e8", borderRadius: "12px", padding: "10px 12px" }}>{n}</div>))}
          <a href="/plataforma/memoria" style={{ color: "#2457f5" }}>+ Añadir nota</a>
        </div>
      </aside>
    </div>
  );
}
