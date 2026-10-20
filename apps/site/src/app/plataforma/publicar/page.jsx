"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useAgentParam } from "@/components/agent-param";

// Flujo: publicar una versión del agente. Entre editar la configuración (tono,
// reglas, conocimiento) y que esos cambios lleguen a los clientes hay un paso
// de revisión + publicación versionada, con vuelta atrás.
// TODO(backend): agent_versions (snapshot inmutable de prompt + skills + reglas);
// publicar activa una versión; "volver a esta" hace rollback; todo en audit_logs.
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const CHANGES = [
  { tag: "Tono", was: "Cercano", now: "Cercano, tuteo siempre", kind: "mod" },
  { tag: "Regla", was: null, now: "«Avisar de cita» pasa a automática (sin aprobación)", kind: "add" },
  { tag: "Conocimiento", was: null, now: "Añadido «Precios 2026» (14 fragmentos)", kind: "add" },
  { tag: "Regla", was: "«Enviar factura» automática", now: "«Enviar factura» con aprobación", kind: "mod" },
];
const HISTORY = [
  { v: "v7", when: "Hoy, 09:14", by: "Marta Ruiz", note: "Horario de verano", active: true },
  { v: "v6", when: "2 oct, 18:30", by: "Carlos (asistente)", note: "Lista de espera", active: false },
  { v: "v5", when: "28 sep, 11:00", by: "Marta Ruiz", note: "Alta de precios", active: false },
];

export default function Publicar() {
  const { key: aKey, name: aName } = useAgentParam("customer");
  const [state, setState] = useState("review"); // review | confirming | publishing | done
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const publish = () => { setState("publishing"); setTimeout(() => setState("done"), reduced.current ? 0 : 1200); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href={`/plataforma/agente?a=${aKey}`} style={{ fontSize: "14px", color: "var(--muted)" }}>‹ {aName}</a>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>{`Publicar cambios de «${aName}»`}</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>4 cambios sin publicar. Revísalos; al publicar, el agente empieza a usarlos con los clientes. Guardamos la versión anterior por si quieres volver.</span>
        </div>

        {state === "done" && (
          <div role="status" style={{ display: "flex", gap: "12px", alignItems: "center", borderRadius: "12px", background: "var(--green-bg)", color: "var(--green-fg)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}><span>✓</span><span><strong style={{ fontWeight: 500 }}>Publicada la v8.</strong> El agente ya responde con la nueva configuración. Puedes volver a la v7 en un clic desde el historial.</span></div>
        )}

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "3 1 440px", minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "16px", fontWeight: 500 }}>Qué va a cambiar</div>
            {CHANGES.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", padding: "14px 20px", borderTop: i ? "1px solid var(--line-soft)" : 0, alignItems: "flex-start" }}>
                <span style={{ flex: "none", marginTop: "1px", width: "20px", height: "20px", borderRadius: "800px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", ...(c.kind === "add" ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }) }}>{c.kind === "add" ? "+" : "~"}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                  <span style={{ fontSize: "12px", ...muted }}>{c.tag}</span>
                  {c.was && <span style={{ fontSize: "13px", lineHeight: "19px", color: "var(--muted-3)", textDecoration: "line-through", fontFamily: "var(--font-body)" }}>{c.was}</span>}
                  <span style={{ fontSize: "14px", lineHeight: "20px", fontFamily: "var(--font-body)" }}>{c.now}</span>
                </div>
              </div>
            ))}
          </section>

          <section style={{ flex: "2 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", fontWeight: 500 }}>Historial de versiones</div>
              {HISTORY.map((h) => (
                <div key={h.v} style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--line-soft)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>{h.v} · {h.note}</span>
                    <span style={{ fontSize: "12px", ...muted }}>{h.when} · {h.by}</span>
                  </div>
                  {h.active ? <span style={{ padding: "3px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px", flex: "none" }}>En uso</span> : <button type="button" style={{ ...btnLight, padding: "6px 12px", flex: "none" }}>Volver a esta</button>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "var(--linen)", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span aria-hidden="true">🔒</span><span>Los cambios de reglas sensibles (importes, envíos) se registran con tu nombre y la hora.</span></div>
          </section>
        </div>

        {state !== "done" && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
            <a href={`/plataforma/agente?a=${aKey}`} style={btnLight}>Seguir editando</a>
            <button type="button" disabled={state === "publishing"} onClick={() => setState("confirming")} style={{ ...btnDark, opacity: state === "publishing" ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>{state === "publishing" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />Publicando…</> : "Publicar v8"}</button>
          </div>
        )}
      </main>

      {state === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar publicación" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setState("review")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Publicar la v8?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>El agente empezará a usar los 4 cambios en todas las conversaciones nuevas. La v7 queda guardada; podrás volver a ella cuando quieras.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setState("review")} style={btnLight}>Cancelar</button>
              <button type="button" onClick={publish} style={btnDark}>Sí, publicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
