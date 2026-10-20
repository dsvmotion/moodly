"use client";
import { useState } from "react";

// Flujo: alta de pago (Stripe). Plan → pago → prueba de 14 días.
// TODO(backend): Stripe Checkout/Elements real; billing_accounts, subscriptions,
// usage_limits; IVA ES (Stripe Tax/Holded). Nunca tocamos la tarjeta (tokeniza Stripe).
const AGENTS = [
  { id: "reception", name: "Recepción", on: true },
  { id: "customer", name: "Atención al cliente", on: true },
  { id: "sales", name: "Comercial", on: false },
  { id: "admin", name: "Administración", on: true },
];
const PER_AGENT = 49;
const STEP_LABELS = ["Plan", "Pago", "Listo"];
const H = { margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" };
const SUB = { fontSize: "15px", lineHeight: "23px", color: "var(--muted)", fontFamily: "var(--font-body)" };
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "12px 20px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const field = { padding: "11px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)", width: "100%", boxSizing: "border-box" };

export default function Checkout() {
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState(() => new Set(AGENTS.filter((a) => a.on).map((a) => a.id)));
  const [sedes, setSedes] = useState(2);
  const [voz, setVoz] = useState(true);
  const toggle = (id) => setAgents((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const baseAgents = agents.size * PER_AGENT;
  const sedeExtra = Math.max(0, sedes - 1) * 19;
  const vozExtra = voz ? 15 : 0;
  const total = baseAgents + sedeExtra + vozExtra;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid var(--line-soft)" }}>
        <img src="/brand/moodly-logo-black.svg" alt="Moodly" width="78" height="20" style={{ display: "block" }} />
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "14px", lineHeight: "14px" }}>
          {STEP_LABELS.map((label, i) => { const n = i + 1; const cur = step === n; const done = step > n; return <li key={label} aria-current={cur ? "step" : undefined} style={{ padding: "8px 14px", borderRadius: "800px", ...(cur ? { background: "var(--ink)", color: "var(--on-ink)" } : done ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { boxShadow: "inset 0 0 0 1px var(--line)", color: "var(--muted)" }) }}>{done ? "✓" : n} · {label}</li>; })}
        </ol>
        <a href="/plataforma/configuracion/plan" style={{ fontSize: "14px", color: "var(--muted)" }}>Cancelar</a>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: "860px", margin: "0 auto", padding: "48px 24px", boxSizing: "border-box", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 440px", minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
          {step === 1 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Tu plan</h1><span style={SUB}>Cuota fija por agente y por sede. El uso extra (conversaciones, voz) se factura aparte, con tope. 14 días de prueba.</span></div>
              <section style={{ ...box, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", fontWeight: 500 }}>{`Agentes · ${PER_AGENT} €/mes cada uno`}</div>
                {AGENTS.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px", borderTop: "1px solid var(--line-soft)", fontSize: "14px", cursor: "pointer" }}>
                    <input type="checkbox" checked={agents.has(a.id)} onChange={() => toggle(a.id)} />
                    <span style={{ flex: 1 }}>{a.name}</span>
                    <span style={muted}>{agents.has(a.id) ? `${PER_AGENT} €` : "—"}</span>
                  </label>
                ))}
              </section>
              <section style={{ ...box, padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "14px", fontWeight: 500 }}>Sedes</span><span style={{ fontSize: "12px", ...muted }}>La primera incluida; +19 €/mes por sede adicional</span></span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><button type="button" onClick={() => setSedes(Math.max(1, sedes - 1))} style={{ ...btnLight, padding: "6px 12px" }}>−</button><span style={{ minWidth: "20px", textAlign: "center", fontWeight: 500 }}>{sedes}</span><button type="button" onClick={() => setSedes(sedes + 1)} style={{ ...btnLight, padding: "6px 12px" }}>+</button></span>
                </div>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "14px", cursor: "pointer" }}>
                  <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "14px", fontWeight: 500 }}>Voz del agente</span><span style={{ fontSize: "12px", ...muted }}>Llamadas y notas de voz · +15 €/mes</span></span>
                  <input type="checkbox" checked={voz} onChange={(e) => setVoz(e.target.checked)} />
                </label>
              </section>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Pago</h1><span style={SUB}>No se cobra nada hoy. Empiezan 14 días de prueba; al acabar, se cobra el plan salvo que canceles.</span></div>
              <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Titular de la tarjeta<input defaultValue="Marta Ruiz" style={field} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Número de tarjeta<input placeholder="1234 1234 1234 1234" style={field} inputMode="numeric" /></label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Caducidad<input placeholder="MM / AA" style={field} /></label>
                  <label style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>CVC<input placeholder="123" style={field} inputMode="numeric" /></label>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", ...muted }}><span>🔒</span><span>Pago seguro con Stripe. Moodly nunca ve ni guarda tu tarjeta.</span></div>
              </section>
            </>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}><span style={{ width: "44px", height: "44px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flex: "none" }}>✓</span><div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><h1 style={H}>Prueba iniciada</h1><span style={SUB}>Tienes 14 días. Te avisaremos antes de cobrar, y al 80 % del uso incluido.</span></div></div>
              <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ fontWeight: 500 }}>Siguiente</span>
                <a href="/plataforma/conectar" style={{ color: "var(--blue-fg)" }}>Conectar WhatsApp →</a>
                <a href="/plataforma/configuracion/plan" style={{ color: "var(--blue-fg)" }}>Ver plan y consumo →</a>
              </section>
            </div>
          )}

          {step < 3 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
              {step > 1 ? <button type="button" onClick={() => setStep(step - 1)} style={btnLight}>Atrás</button> : <a href="/plataforma/configuracion/plan" style={btnLight}>Atrás</a>}
              <button type="button" onClick={() => setStep(step + 1)} style={btnDark}>{step === 1 ? "Continuar" : "Empezar la prueba"}</button>
            </div>
          )}
        </div>

        {step < 3 && (
          <aside style={{ ...box, flex: "1 1 240px", minWidth: 0, padding: "20px", display: "flex", flexDirection: "column", gap: "12px", position: "sticky", top: "24px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Resumen</span>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "21px" }}><span style={muted}>{`${agents.size} agentes`}</span><span>{baseAgents} €</span></div>
            {sedeExtra > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "21px" }}><span style={muted}>{`${sedes - 1} sede(s) extra`}</span><span>{sedeExtra} €</span></div>}
            {vozExtra > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "21px" }}><span style={muted}>Voz</span><span>{vozExtra} €</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line-soft)", paddingTop: "12px" }}><span style={{ fontSize: "14px" }}>Al mes</span><span style={{ fontSize: "24px", letterSpacing: "-0.48px" }}>{total} €</span></div>
            <span style={{ fontSize: "12px", ...muted }}>+ IVA. Implantación según escala, presupuesto aparte. Hoy no se cobra nada.</span>
          </aside>
        )}
      </main>
    </div>
  );
}
