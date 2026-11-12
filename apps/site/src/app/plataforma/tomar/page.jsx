"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";

// Flujo: tomar el control de una conversación que lleva el agente (handoff
// humano) y devolverla. El paso que faltaba entre Conversaciones y responder a
// mano cuando el caso se complica.
// TODO(backend): conversations.control = 'agent' | 'human'; al tomar el control
// se pausa el agente para ese hilo; cada mensaje y el cambio de control quedan
// en el registro de actividad (audit_logs).
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const BASE = [
  { who: "cliente", t: "Hola, el sábado me hice el color y ha quedado mucho más oscuro de lo que pedí. ¿Tiene arreglo?", at: "11:02" },
  { who: "agente", t: "Hola Laura 👋 Siento que no haya quedado como querías. ¿Lo notas más oscuro en todo el pelo o solo en las raíces?", at: "11:02" },
  { who: "cliente", t: "En todo el pelo, y con luz natural se nota todavía más.", at: "11:05" },
  { who: "agente", t: "Gracias por el detalle. Lo mejor es que lo vea tu estilista. ¿Te busco hueco con Marc Soler?", at: "11:05" },
  { who: "cliente", t: "Sí, pero me gustaría hablar con alguien, me preocupa.", at: "11:06" },
];

export default function Tomar() {
  const [control, setControl] = useState("agent"); // agent | confirming | human
  const [msgs, setMsgs] = useState(BASE);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: "end" }); }, [msgs]);

  const take = () => { setControl("human"); setMsgs((m) => [...m, { who: "sistema", t: "Marta Ruiz ha tomado el control. El agente queda en pausa en este chat.", at: "ahora" }]); };
  const send = () => { const t = draft.trim(); if (!t) return; setMsgs((m) => [...m, { who: "yo", t, at: "ahora" }]); setDraft(""); };
  const giveBack = () => { setControl("agent"); setMsgs((m) => [...m, { who: "sistema", t: "Marta Ruiz ha devuelto el chat al agente de Atención.", at: "ahora" }]); };

  const human = control === "human";

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="conversaciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "18px" }}>
        <a href="/plataforma/conversaciones" style={{ fontSize: "14px", color: "var(--muted)" }}>‹ Conversaciones</a>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 500, flex: "none" }}>LM</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "17px", fontWeight: 500 }}>Laura Martín</span>
              <span style={{ fontSize: "13px", ...muted, display: "inline-flex", alignItems: "center", gap: "6px" }}><img src="/logos/whatsapp.svg" alt="" width="14" height="14" />WhatsApp · Estudio de Belleza Sol</span>
            </div>
          </div>
          <span style={{ padding: "5px 12px", borderRadius: "800px", fontSize: "13px", ...(human ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--violet-bg)", color: "var(--violet-fg)" }) }}>{human ? "La llevas tú" : "La lleva el agente"}</span>
        </div>

        <div style={{ ...box, flex: 1, minHeight: "380px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {msgs.map((m, i) => {
              if (m.who === "sistema") return <div key={i} style={{ alignSelf: "center", textAlign: "center", maxWidth: "80%", fontSize: "12px", lineHeight: "17px", color: "var(--muted-2)", background: "var(--canvas)", borderRadius: "800px", padding: "6px 14px" }}>{m.t}</div>;
              const mine = m.who === "yo" || m.who === "agente";
              const isAgent = m.who === "agente";
              return (
                <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "76%", display: "flex", flexDirection: "column", gap: "3px", alignItems: mine ? "flex-end" : "flex-start" }}>
                  {isAgent && <span style={{ fontSize: "11px", color: "var(--violet-fg)", padding: "0 4px" }}>Agente de Atención</span>}
                  {m.who === "yo" && <span style={{ fontSize: "11px", color: "var(--green-fg)", padding: "0 4px" }}>Tú · Marta</span>}
                  <span style={{ padding: "10px 14px", borderRadius: "14px", fontSize: "14px", lineHeight: "20px", fontFamily: "var(--font-body)", ...(mine ? { background: m.who === "yo" ? "var(--green-bg)" : "var(--violet-bg)", color: "var(--ink)", borderBottomRightRadius: "4px" } : { background: "var(--canvas)", borderBottomLeftRadius: "4px" }) }}>{m.t}</span>
                  <span style={{ fontSize: "11px", color: "var(--muted-3)", padding: "0 4px" }}>{m.at}</span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div style={{ borderTop: "1px solid var(--line-soft)", padding: "14px 16px" }}>
            {!human ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", ...muted }}>El agente está respondiendo. Si el caso lo necesita, toma el control y escribe tú.</span>
                <button type="button" onClick={() => setControl("confirming")} style={btnDark}>Tomar el control</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Escribe a Laura…" style={{ flex: "1 1 260px", minWidth: 0, resize: "none", padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)" }} />
                  <button type="button" onClick={send} disabled={!draft.trim()} style={{ ...btnDark, opacity: draft.trim() ? 1 : 0.5 }}>Enviar</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "var(--green-fg)" }}>Estás respondiendo tú. El agente no enviará nada en este chat.</span>
                  <button type="button" onClick={giveBack} style={{ ...btnLight, padding: "8px 14px" }}>Devolver al agente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {control === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Tomar el control" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setControl("agent")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Tomar el control de este chat?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>El agente de Atención dejará de responder a Laura hasta que se lo devuelvas. Tú escribirás los mensajes. El cambio queda registrado.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setControl("agent")} style={btnLight}>Cancelar</button>
              <button type="button" onClick={take} style={btnDark}>Sí, tomo el control</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
