"use client";
import { useEffect, useState } from "react";
import MobileFrame from "@/components/mobile-frame";
import { useSede } from "@/components/use-sede";
import { convsFor, convDetail } from "@/components/sede-data";

// Conversación (móvil): abre la de ?c= (por defecto la primera de la bandeja).
// Tomar el control funciona; la aprobación enlaza con la pantalla Aprobar.
export default function Screen() {
  const { sede } = useSede();
  const list = convsFor(sede).list;
  const [name, setName] = useState(null);
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("c"); if (c) setName(c); }, []);
  const conv = list.find((c) => c.name === name) ?? list[0];
  const det = convDetail(conv, sede);
  const [human, setHuman] = useState(false);
  const [extra, setExtra] = useState([]);
  const [draft, setDraft] = useState("");
  const toggle = () => { setExtra((e) => [...e, { sys: human ? "Has devuelto la conversación al agente." : "Has tomado el control. El agente queda en pausa." }]); setHuman(!human); };
  const send = () => { const t = draft.trim(); if (!t) return; if (!human) { setHuman(true); setExtra((e) => [...e, { sys: "Al escribir tú, el agente queda en pausa." }]); } setExtra((e) => [...e, { mine: t }]); setDraft(""); };
  const bubble = (mine) => ({ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", padding: "10px 14px", borderRadius: "16px", background: mine ? "var(--ink)" : "var(--paper)", color: mine ? "var(--on-ink)" : "var(--ink)" });
  return (
    <MobileFrame active="chats" back="/plataforma/movil/chats" title={det.header.name}
      right={<button type="button" onClick={toggle} style={{ padding: "8px 12px", borderRadius: "800px", border: human ? "1px solid var(--ink)" : "1px solid var(--line)", background: human ? "var(--ink)" : "var(--paper)", color: human ? "var(--on-ink)" : "var(--ink)", font: "500 13px/13px var(--font-display)", cursor: "pointer", whiteSpace: "nowrap" }}>{human ? "Devolver" : "Tomar control"}</button>}>
      <span style={{ alignSelf: "center", fontSize: "12px", color: human ? "var(--green-fg)" : "var(--muted-2)" }}>{det.header.channel} · {human ? "la llevas tú" : "la lleva el agente"}</span>
      {det.thread.map((m, i) => {
        if (m.from === "them") return <div key={i} style={bubble(false)}>{m.text}</div>;
        if (m.from === "agent") return <div key={i} style={bubble(true)}>{m.text}</div>;
        if (m.from === "agent-actions") return (
          <div key={i} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", maxWidth: "80%" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>{m.chips.map((ch, j) => <span key={j} style={{ padding: "4px 10px", borderRadius: "800px", background: ch.bg, fontSize: "12px" }}>{ch.text}</span>)}</div>
            <div style={bubble(true)}>{m.text}</div>
          </div>
        );
        if (m.from === "approval") return (
          <div key={i} style={{ borderRadius: "12px", background: "var(--amber-bg)", color: "var(--amber-fg)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <span><strong style={{ fontWeight: 500 }}>Necesita tu aprobación.</strong> {m.text}</span>
            <a href="/plataforma/movil/aprobaciones" style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", textDecoration: "none", fontSize: "13px" }}>Revisar y aprobar</a>
          </div>
        );
        return null;
      })}
      {extra.map((m, i) => m.sys
        ? <span key={`x${i}`} style={{ alignSelf: "center", textAlign: "center", fontSize: "12px", color: "var(--muted-2)", background: "var(--sunken)", borderRadius: "800px", padding: "5px 12px" }}>{m.sys}</span>
        : <div key={`x${i}`} style={{ ...bubble(true), background: "#2457f5" }}>{m.mine}</div>)}
      <div style={{ marginTop: "auto", display: "flex", gap: "8px", background: "var(--paper)", borderRadius: "800px", padding: "6px 6px 6px 16px" }}>
        <label htmlFor="mmsg" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensaje</label>
        <input id="mmsg" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Escribe un mensaje…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "400 15px/20px var(--font-display)" }} />
        <button type="button" onClick={send} aria-label="Enviar" style={{ width: "36px", height: "36px", borderRadius: "800px", border: 0, background: "#2457f5", color: "#ffffff", cursor: "pointer" }}>↑</button>
      </div>
    </MobileFrame>
  );
}
