"use client";
import { Fragment, useState } from "react";
import { useSede } from "@/components/use-sede";
import { approvalsFor } from "@/components/sede-data";
import ApprovalsBadge from "@/components/approvals-badge";

export default function Screen() {
  const { sede } = useSede();
  const source = approvalsFor(sede);
  const [state, setStateRaw] = useState({});
  const ctx = { state, setState: (o) => setStateRaw((p) => ({ ...p, ...o })), props: {} };
  const vals = function () {
const all = source.map((x) => ({ id: x.id, agent: x.agent, when: x.when + (x.sede ? ` · ${x.sede}` : ""), kind: x.tag, title: x.title, detail: x.total ? `${x.note} · ${x.total}` : x.note, cta: x.tag === "Factura" ? "Aprobar y enviar" : "Aprobar" }));
const done = (this.state && this.state.done) || {};
const resolve = (id) => () => this.setState({ done: { ...done, [id]: true } });
const items = all.filter((x) => !done[x.id]).map((x) => ({ ...x, approve: resolve(x.id), reject: resolve(x.id) }));
const count = items.length;
return {
items, count, hasPending: count > 0, empty: count === 0,
summary: count === 0 ? 'Nada pendiente.' : count === 1 ? '1 tarea espera tu visto bueno.' : count + ' tareas esperan tu visto bueno.',
reset: () => this.setState({ done: {} })
};
}.call(ctx);
  const { count, empty, hasPending, items, reset, summary } = vals;
  return (
    <div style={{ minHeight: "100vh", background: "var(--backdrop)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", boxSizing: "border-box" }}><div style={{ borderRadius: "40px", overflow: "hidden", boxShadow: "0 24px 64px #00000033", border: "8px solid var(--ink)" }}>

<div style={{ width: "390px", height: "844px", boxSizing: "border-box", fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>

<header style={{ padding: "56px 20px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
<h1 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>Aprobaciones</h1>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>{summary}</span>
</header>

<main style={{ flex: "1", overflow: "hidden", padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
{(items).map((it, $index) => (<Fragment key={$index}>
<article style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "20px" }}>
<span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>{it.agent} · {it.when}</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px", lineHeight: "18px" }}>! {it.kind}</span></span>
<span style={{ fontWeight: "500" }}>{it.title}</span>
<span style={{ color: "var(--muted)" }}>{it.detail}</span>
<span style={{ display: "flex", gap: "8px" }}>
<button type="button" onClick={it.reject} style={{ flex: "1", minHeight: "44px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--rose-fg)", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Rechazar</button>
<button type="button" onClick={it.approve} style={{ flex: "2", minHeight: "44px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>{it.cta}</button>
</span>
</article>
</Fragment>))}
{(empty) ? (<>
<div style={{ marginTop: "48px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center", padding: "0 24px" }}>
<span style={{ width: "56px", height: "56px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span>
<span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>Todo al día</span>
<span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>Te avisaremos cuando un agente necesite tu visto bueno.</span>
<button type="button" onClick={reset} style={{ marginTop: "8px", padding: "10px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}>Ver de nuevo la demo</button>
</div>
</>) : null}
</main>

<nav aria-label="Principal" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "8px 6px 28px", background: "var(--paper)", borderTop: "1px solid var(--line)", fontSize: "11px", lineHeight: "14px", textAlign: "center" }}>
<a href="/plataforma/movil" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>Inicio</a>
<a href="/plataforma/movil/chats" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Chats</a>
<a href="/plataforma/movil/aprobaciones" aria-current="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", fontWeight: "500", position: "relative" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path></svg>{(hasPending) ? (<><span style={{ position: "absolute", top: "0", left: "55%", minWidth: "16px", height: "16px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "11px", lineHeight: "16px" }}>{count}</span></>) : null}Aprobar</a>
<a href="/plataforma/movil/agenda" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>Agenda</a>
<a href="/plataforma/movil/mas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0", color: "var(--muted)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>Más</a>
</nav>
</div>
</div></div>
  );
}
