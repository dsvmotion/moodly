"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";

// Flujo: revisar una aprobación antes de enviar (el paso que faltaba entre la
// lista de Aprobaciones y la acción). Contexto + edición + aprobar/rechazar,
// con confirmación y registro.
// TODO(backend): approvals/executions; acción sensible → motor de políticas +
// audit_logs; editar modifica el borrador antes de ejecutar.
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

export default function Revisar() {
  const [state, setState] = useState("pending"); // pending | confirming | approved | rejected
  const [importe, setImporte] = useState("75,00");
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="aprobaciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href="/plataforma/aprobaciones" style={{ fontSize: "14px", color: "var(--muted)" }}>‹ Aprobaciones</a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>Administración · hace 5 min</span>
            <h1 style={{ margin: "4px 0 0", fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Enviar factura F‑0412 a Laura M.</h1>
          </div>
        </div>

        {state === "approved" && <div role="status" style={{ display: "flex", gap: "12px", alignItems: "center", borderRadius: "12px", background: "var(--green-bg)", color: "var(--green-fg)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}><span>✓</span><span><strong style={{ fontWeight: 500 }}>Aprobada y enviada.</strong> Administración ha mandado la factura por WhatsApp. Queda en el registro de actividad.</span></div>}
        {state === "rejected" && <div role="status" style={{ display: "flex", gap: "12px", alignItems: "center", borderRadius: "12px", background: "var(--rose-bg)", color: "var(--rose-fg)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px" }}><span>×</span><span><strong style={{ fontWeight: 500 }}>Rechazada.</strong> No se ha enviado nada. El agente lo tendrá en cuenta.</span></div>}

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "3 1 440px", minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>Lo que va a hacer el agente</span>
              {state === "pending" && <button type="button" onClick={() => setEditing(!editing)} style={{ ...btnLight, padding: "7px 12px" }}>{editing ? "Hecho" : "Editar"}</button>}
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
                <span style={muted}>Factura</span><span style={{ fontWeight: 500 }}>F‑0412</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
                <span style={muted}>Importe</span>
                {editing ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><input value={importe} onChange={(e) => setImporte(e.target.value)} style={{ width: "90px", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)", font: "500 14px/18px var(--font-body)", textAlign: "right" }} /> €</span> : <span style={{ fontWeight: 500 }}>{importe} €</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}><span style={muted}>Enviar por</span><span style={{ fontWeight: 500 }}>WhatsApp</span></div>
              <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", ...muted }}>Mensaje que acompaña</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", fontFamily: "var(--font-body)", padding: "12px 14px", borderRadius: "10px", background: "var(--paper-2b)" }}>Hola Laura, aquí tienes la factura de tu última visita (75,00 €). ¡Gracias!</span>
              </div>
            </div>
          </section>

          <section style={{ flex: "2 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ ...box, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "12px", ...muted }}>Por qué necesita tu visto bueno</span>
              <span style={{ fontSize: "14px", lineHeight: "21px" }}>Tu regla: <strong style={{ fontWeight: 500 }}>«Enviar facturas»</strong> está en <em>Con aprobación</em>.</span>
              <a href="/plataforma/reglas" style={{ fontSize: "14px", color: "var(--blue-fg)" }}>Ver la regla →</a>
            </div>
            <div style={{ ...box, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "12px", ...muted }}>De dónde viene</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", fontFamily: "var(--font-body)" }}>Laura pidió la factura por WhatsApp hoy a las 10:58.</span>
              <a href="/plataforma/conversaciones" style={{ fontSize: "14px", color: "var(--blue-fg)" }}>Ver conversación →</a>
            </div>
          </section>
        </div>

        {state === "pending" && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
            <button type="button" onClick={() => setState("rejected")} style={{ ...btnLight, color: "var(--rose-fg)", borderColor: "var(--rose-line)" }}>Rechazar</button>
            <button type="button" onClick={() => setState("confirming")} style={btnDark}>Aprobar y enviar</button>
          </div>
        )}
      </main>

      {state === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar envío" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setState("pending")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Enviar la factura F‑0412?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{`Se enviará por WhatsApp a Laura M. por ${importe} €. Esta acción queda registrada.`}</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setState("pending")} style={btnLight}>Cancelar</button>
              <button type="button" onClick={() => setState("approved")} style={btnDark}>Sí, enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
