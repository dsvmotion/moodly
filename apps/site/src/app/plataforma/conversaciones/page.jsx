"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { convsFor, convDetail, convStatus } from "@/components/sede-data";

// Conversaciones por sede (ver sede-data): bandeja + conversación + ficha CRM.
// Seleccionar una fila abre su conversación; filtros y buscador filtran; tomar el
// control pide confirmación y queda como mensaje de sistema. Admite ?c=Nombre.
// TODO(backend): conversations.control = 'agent' | 'human' + audit_logs.
const FILTERS = [["todas", "Todas"], ["atencion", "Necesitan atención"], ["resuelta", "Resueltas"]];
const keyOf = (c) => `${c.name}|${c.sede ?? ""}`;
const btn = (dark) => ({ padding: "10px 18px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer", textDecoration: "none" });

export default function Screen() {
  const { sede } = useSede();
  const d = convsFor(sede);
  const [filter, setFilter] = useState("todas");
  const [q, setQ] = useState("");
  const [selKey, setSelKey] = useState(null);
  const [resolved, setResolved] = useState({}); // conversaciones marcadas como resueltas aquí
  const [human, setHuman] = useState({});       // control humano por conversación
  const [extra, setExtra] = useState({});       // mensajes añadidos por conversación (tuyos y de sistema)
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState("");

  // ?c=Nombre completo o corto → abre esa conversación.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (!c) return;
    const first = c.split(" ")[0].toLowerCase();
    const hit = d.list.find((x) => x.name.toLowerCase() === c.toLowerCase() || x.name.toLowerCase().startsWith(first));
    if (hit) setSelKey(keyOf(hit));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusOf = (c) => (resolved[keyOf(c)] ? "resuelta" : convStatus(c));
  const visible = d.list.filter((c) => (filter === "todas" || statusOf(c) === filter) && (!q.trim() || `${c.name} ${c.preview}`.toLowerCase().includes(q.trim().toLowerCase())));
  const current = visible.find((c) => keyOf(c) === selKey) ?? visible[0] ?? null;
  const k = current ? keyOf(current) : "";
  const det = convDetail(current, sede);
  const isHuman = !!human[k];
  const msgs = extra[k] ?? [];
  const add = (m) => setExtra((e) => ({ ...e, [k]: [...(e[k] ?? []), m] }));

  const take = () => { setHuman((h) => ({ ...h, [k]: true })); add({ sys: "Has tomado el control. El agente queda en pausa en esta conversación." }); setConfirming(false); };
  const giveBack = () => { setHuman((h) => ({ ...h, [k]: false })); add({ sys: "Has devuelto la conversación al agente." }); };
  const send = () => { const t = draft.trim(); if (!t || !current) return; if (!isHuman) { setHuman((h) => ({ ...h, [k]: true })); add({ sys: "Al escribir tú, el agente queda en pausa en esta conversación." }); } add({ mine: t }); setDraft(""); };
  const markResolved = () => { setResolved((r) => ({ ...r, [k]: true })); add({ sys: "Marcada como resuelta." }); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="conversaciones" /></div>

      {/* Bandeja, conversación y ficha: si no caben, la ficha baja bajo la conversación (no bajo el menú). */}
      <div style={{ flex: "999 1 600px", minWidth: 0, display: "flex", flexWrap: "wrap", alignContent: "flex-start" }}>
      <section style={{ flex: "1 1 300px", maxWidth: "360px", borderRight: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "20px 16px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h1 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>Conversaciones</h1>
          <label htmlFor="buscar" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar</label>
          <input id="buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o mensaje" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/21px var(--font-display)", color: "var(--ink)" }} />
          <Pills label="Filtrar conversaciones" options={FILTERS} value={filter} onChange={setFilter} size="sm" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 8px 16px", gap: "2px", fontSize: "14px", lineHeight: "21px" }}>
          {visible.length === 0 && <p style={{ margin: 0, padding: "16px 12px", color: "var(--muted)" }}>No hay conversaciones con este filtro.</p>}
          {visible.map((c) => {
            const on = current && keyOf(c) === k;
            const st = statusOf(c);
            return (
              <button key={keyOf(c)} type="button" aria-pressed={on} onClick={() => setSelKey(keyOf(c))} style={{ textAlign: "left", padding: "12px", borderRadius: "12px", background: on ? "var(--paper)" : "transparent", border: on ? "1px solid var(--line)" : "1px solid transparent", display: "flex", flexDirection: "column", gap: "2px", font: "inherit", color: "var(--ink)", cursor: "pointer" }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "500" }}>{c.name}</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{c.time}</span></span>
                <span style={{ color: "var(--muted)" }}>{c.preview}</span>
                <span style={{ fontSize: "12px", lineHeight: "18px", color: st === "resuelta" ? "var(--muted-2)" : c.metaColor || "var(--muted-2)" }}>{resolved[keyOf(c)] ? c.meta.replace(/(! Aprobación|En curso)/, "✓ Resuelta") : c.meta}{c.sede ? ` · ${c.sede}` : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      {det ? (
        <>
          <main style={{ flex: "999 1 420px", minWidth: "0", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div><div style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{det.header.name}</div><div style={{ fontSize: "12px", lineHeight: "18px", color: isHuman ? "var(--green-fg)" : "var(--muted-2)" }}>{det.header.channel} · {isHuman ? "Atendida por ti · agente en pausa" : "Atendida por el agente"}</div></div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {isHuman ? <button type="button" onClick={giveBack} style={btn(false)}>Devolver al agente</button> : <button type="button" onClick={() => setConfirming(true)} style={btn(true)}>Tomar el control</button>}
                <button type="button" onClick={markResolved} disabled={statusOf(current) === "resuelta"} style={{ ...btn(false), opacity: statusOf(current) === "resuelta" ? 0.5 : 1 }}>{statusOf(current) === "resuelta" ? "Resuelta ✓" : "Marcar resuelta"}</button>
              </div>
            </div>
            <div style={{ flex: "1", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
              <div style={{ alignSelf: "center", fontSize: "12px", color: "var(--muted-2)" }}>Hoy</div>
              {det.thread.map((m, i) => {
                if (m.from === "them") return <div key={i} style={{ alignSelf: "flex-start", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: "12px", padding: "10px 14px", maxWidth: "65%" }}>{m.text}</div>;
                if (m.from === "agent") return <div key={i} style={{ alignSelf: "flex-end", background: "var(--ink)", color: "var(--on-ink)", borderRadius: "12px", padding: "10px 14px", maxWidth: "65%" }}>{m.text}</div>;
                if (m.from === "agent-actions") return (
                  <div key={i} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", gap: "6px", maxWidth: "65%", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>{m.chips.map((ch, j) => (<span key={j} style={{ padding: "6px 12px", borderRadius: "800px", background: ch.bg, fontSize: "12px", lineHeight: "14px" }}>{ch.text}</span>))}</div>
                    <div style={{ background: "var(--ink)", color: "var(--on-ink)", borderRadius: "12px", padding: "10px 14px" }}>{m.text}</div>
                  </div>
                );
                if (m.from === "approval") return (
                  <div key={i} style={{ alignSelf: "stretch", borderRadius: "12px", background: "var(--amber-bg)", color: "var(--amber-fg)", padding: "14px 18px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 260px" }}><strong style={{ fontWeight: "500" }}>Necesita tu aprobación.</strong> {m.text}</span>
                    <a href={`/plataforma/aprobaciones${m.id ? `?i=${m.id}` : ""}`} style={{ ...btn(true), padding: "8px 14px" }}>Revisar y aprobar</a>
                  </div>
                );
                return null;
              })}
              {msgs.map((m, i) => m.sys
                ? <div key={`x${i}`} style={{ alignSelf: "center", textAlign: "center", maxWidth: "80%", fontSize: "12px", lineHeight: "17px", color: "var(--muted-2)", background: "var(--sunken)", borderRadius: "800px", padding: "6px 14px" }}>{m.sys}</div>
                : <div key={`x${i}`} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", maxWidth: "65%" }}><div style={{ background: "#2457f5", color: "#ffffff", borderRadius: "12px", padding: "10px 14px" }}>{m.mine}</div><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Tú · ahora</span></div>)}
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", padding: "14px 14px 14px 18px", display: "flex", gap: "12px", alignItems: "center" }}>
                <label htmlFor="msg" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensaje</label>
                <input id="msg" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={isHuman ? `Escribe a ${det.header.name}…` : "Escribe para responder tú (el agente se pausa)…"} style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", font: "400 14px/21px var(--font-display)", color: "var(--ink)" }} />
                <button type="button" onClick={send} aria-label="Enviar" style={{ width: "36px", height: "36px", borderRadius: "800px", border: "0", background: "#2457f5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
              </div>
            </div>
          </main>

          <aside style={{ flex: "1 1 260px", maxWidth: "300px", borderLeft: "1px solid var(--line-soft)", padding: "24px 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ width: "48px", height: "48px", borderRadius: "800px", background: det.crm.color, boxShadow: det.crm.color === "var(--linen)" ? "inset 0 0 0 1px var(--line)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "500" }}>{det.crm.initials}</span>
              <div><div style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{det.crm.name}</div><div style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{det.crm.since}</div></div>
              {det.client ? <a href={`/plataforma/clientes?c=${encodeURIComponent(det.client)}`} style={{ color: "var(--blue-fg)", textDecoration: "none" }}>Ver ficha completa →</a> : <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Sin ficha de cliente todavía</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Ficha del CRM</span>
              {Object.entries(det.crm.rows).map(([key, v]) => (<div key={key} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ color: "var(--muted)" }}>{key}</span><span>{v}</span></div>))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>El agente recuerda</span>
              {det.crm.notes.map((n, i) => (<div key={i} style={{ background: "var(--linen)", borderRadius: "12px", padding: "10px 12px" }}>{n}</div>))}
              <a href="/plataforma/memoria" style={{ color: "var(--blue-fg)", textDecoration: "none" }}>+ Añadir nota</a>
            </div>
          </aside>
        </>
      ) : (
        <main style={{ flex: "999 1 420px", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", color: "var(--muted)", fontSize: "14px" }}>Elige una conversación de la bandeja.</main>
      )}
      </div>

      {confirming && det && (
        <div role="dialog" aria-modal="true" aria-label="Tomar el control" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setConfirming(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Tomar el control de esta conversación?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)", fontFamily: "var(--font-body)" }}>{`El agente dejará de responder a ${det.header.name} hasta que se la devuelvas. Escribirás tú. El cambio queda registrado.`}</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setConfirming(false)} style={btn(false)}>Cancelar</button>
              <button type="button" onClick={take} style={btn(true)}>Sí, tomo el control</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
