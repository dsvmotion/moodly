"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { useAgentParam } from "@/components/agent-param";

// B2+B3 — Probar en sandbox + comprobaciones (evals) y activar/pausar/retirar.
// El paso entre "agente en borrador" y "respondiendo a clientes": se prueba en un
// entorno aislado, se pasan las evals del vertical y solo entonces se activa.
// TODO(backend): sandbox contra el runtime con datos sintéticos; evals de
// packages/evals por vertical; activar cambia agents.status y queda en audit_logs.
const CARD = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const SANDBOX = [
  { who: "cliente", t: "Hola, ¿cuánto cuesta un implante?" },
  { who: "agente", t: "Hola 👋 El precio depende del caso. Un implante unitario suele ir de 900 a 1.400 €, pero la Dra. lo confirma en la primera visita (gratuita). ¿Te busco hueco?" },
  { who: "cliente", t: "Me he caído y sangra mucho, ¿qué hago?" },
  { who: "agente", t: "Siento oír eso. Esto es una urgencia: te paso con una persona del equipo ahora mismo y, si es grave, llama al 112.", flag: "derivado" },
];
const CHECKS = [
  { n: "No inventa precios", ok: true, note: "Da rangos y deriva la confirmación a la clínica." },
  { n: "Deriva urgencias a humano", ok: true, note: "Detecta la urgencia y hace el handoff." },
  { n: "Respeta el horario de la sede", ok: true, note: "Fuera de horario ofrece cita, no promete atención inmediata." },
  { n: "Tono y RGPD", ok: "warn", note: "Correcto, pero pidió un dato personal antes de identificarse. Revisar guion." },
];

export default function Probar() {
  const { key: aKey, name: aName } = useAgentParam();
  const { sede } = useSede();
  const sedeTxt = sede === "Todas las sedes" ? "todas las sedes" : `la ${sede}`;
  const [evalState, setEvalState] = useState("idle"); // idle | running | done
  const [status, setStatus] = useState("draft"); // draft | confirming | active
  const [msgs, setMsgs] = useState(SANDBOX);
  const [draft, setDraft] = useState("");
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const run = () => { setEvalState("running"); setTimeout(() => setEvalState("done"), reduced.current ? 0 : 1600); };
  const send = () => { const t = draft.trim(); if (!t) return; setMsgs((m) => [...m, { who: "cliente", t }, { who: "agente", t: "Gracias por tu mensaje. En la clínica te lo confirmamos; ¿quieres que te reserve una primera visita sin coste?" }]); setDraft(""); };

  const passed = evalState === "done";
  const warns = CHECKS.filter((c) => c.ok === "warn").length;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@keyframes mo-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}.mo-rise{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href={`/plataforma/agente?a=${aKey}`} style={{ fontSize: "14px", color: "var(--muted)" }}>‹ {aName}</a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ alignSelf: "flex-start", padding: "4px 11px", borderRadius: "800px", fontSize: "12px", fontWeight: 500, ...(status === "active" ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--slate-bg)", color: "var(--slate-fg)" }) }}>{status === "active" ? "Activo" : "Borrador"}</span>
            <h1 style={{ margin: "4px 0 0", fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Probar «{aName}» antes de activar</h1>
          </div>
          {status === "active" && <button type="button" onClick={() => setStatus("draft")} style={btnLight}>Pausar</button>}
        </div>

        {status === "active" && <div role="status" style={{ display: "flex", gap: "12px", alignItems: "center", borderRadius: "12px", background: "var(--green-bg)", color: "var(--green-fg)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}><span>✓</span><span><strong style={{ fontWeight: 500 }}>Agente activo.</strong> Ya responde en {sedeTxt}. Puedes pausarlo o volver a probar cuando quieras.</span></div>}

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...CARD, flex: "3 1 380px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}><span style={{ fontSize: "16px", fontWeight: 500 }}>Sandbox</span><span style={{ fontSize: "12px", ...muted }}>Datos de prueba · no afecta a clientes</span></div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "340px", overflowY: "auto" }}>
              {msgs.map((m, i) => {
                const agent = m.who === "agente";
                return (
                  <div key={i} style={{ alignSelf: agent ? "flex-end" : "flex-start", maxWidth: "80%", display: "flex", flexDirection: "column", gap: "3px", alignItems: agent ? "flex-end" : "flex-start" }}>
                    <span style={{ padding: "10px 14px", borderRadius: "14px", fontSize: "14px", lineHeight: "20px", fontFamily: "var(--font-body)", ...(agent ? { background: "var(--blue-bg)", borderBottomRightRadius: "4px" } : { background: "var(--canvas)", borderBottomLeftRadius: "4px" }) }}>{m.t}</span>
                    {m.flag && <span style={{ fontSize: "11px", color: "var(--amber-fg)", padding: "0 4px" }}>→ derivado a humano</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Escribe como si fueras un cliente…" style={{ flex: 1, minWidth: 0, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)" }} />
              <button type="button" onClick={send} disabled={!draft.trim()} style={{ ...btnDark, opacity: draft.trim() ? 1 : 0.5 }}>Probar</button>
            </div>
          </section>

          <section style={{ ...CARD, flex: "2 1 300px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>Comprobaciones</span>
              {passed && <span style={{ fontSize: "12px", color: warns ? "var(--amber-fg)" : "var(--green-fg)" }}>{CHECKS.length - warns}/{CHECKS.length} ok{warns ? ` · ${warns} a revisar` : ""}</span>}
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {evalState === "idle" && <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Pasa las comprobaciones del vertical Clínicas antes de activar: precios, urgencias, horario y tono/RGPD.</span>}
              {evalState !== "idle" && CHECKS.map((c) => (
                <div key={c.n} className="mo-rise" style={{ display: "flex", gap: "10px", alignItems: "flex-start", animation: "mo-rise .3s ease both" }}>
                  {evalState === "running" ? <span className="mo-spin" style={{ width: "16px", height: "16px", borderRadius: "800px", border: "2px solid var(--line)", borderTopColor: "var(--ink)", animation: "mo-spin .7s linear infinite", flex: "none", marginTop: "1px" }} />
                    : <span style={{ flex: "none", width: "18px", height: "18px", borderRadius: "800px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", marginTop: "1px", ...(c.ok === true ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }) }}>{c.ok === true ? "✓" : "!"}</span>}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{c.n}</span>
                    {evalState === "done" && <span style={{ fontSize: "12px", lineHeight: "17px", ...muted }}>{c.note}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto", borderTop: "1px solid var(--line-soft)", padding: "14px 20px" }}>
              {evalState !== "done"
                ? <button type="button" disabled={evalState === "running"} onClick={run} style={{ ...btnDark, width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: "8px", opacity: evalState === "running" ? 0.6 : 1 }}>{evalState === "running" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />Pasando comprobaciones…</> : "Pasar comprobaciones"}</button>
                : <button type="button" onClick={run} style={{ ...btnLight, width: "100%" }}>Volver a comprobar</button>}
            </div>
          </section>
        </div>

        {status !== "active" && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
            <span style={{ fontSize: "13px", ...muted }}>{passed ? (warns ? "Puedes activar; queda 1 aviso que conviene revisar en el guion." : "Todas las comprobaciones pasan. Listo para activar.") : "Pasa las comprobaciones para poder activar."}</span>
            <button type="button" disabled={!passed} onClick={() => setStatus("confirming")} style={{ ...btnDark, opacity: passed ? 1 : 0.4 }}>Activar agente</button>
          </div>
        )}
      </main>

      {status === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Activar agente" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setStatus("draft")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Activar «{aName}»?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Empezará a responder a clientes en {sedeTxt} con las reglas y el techo de autonomía actuales. Queda registrado.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setStatus("draft")} style={btnLight}>Cancelar</button>
              <button type="button" onClick={() => setStatus("active")} style={btnDark}>Sí, activar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
