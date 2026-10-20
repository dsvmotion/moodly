"use client";
import { Fragment, useEffect, useRef, useState } from "react";

// Flujo: conectar un canal. Piloto = WhatsApp Cloud API directo (sin BSP).
// Estados reales: elegir → datos → conectando → conectado/error → plantilla.
// TODO(backend): OAuth/registro real contra Meta; token en `integration_secrets`
// (cifrado, Vault); estado en `integrations`; plantillas en `whatsapp_templates`.
const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp Business", logo: "whatsapp.svg", desc: "Cloud API de Meta · mensajes y notas de voz" },
  { id: "gmail", name: "Gmail", logo: "gmail.svg", desc: "Leer y responder correos" },
  { id: "gcal", name: "Google Calendar", logo: "googlecalendar.svg", desc: "Crear y mover citas" },
  { id: "instagram", name: "Instagram", logo: "instagram.svg", desc: "Mensajes directos" },
];
const STEP_LABELS = ["Elegir canal", "Conectar", "Listo"];
const H = { margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" };
const SUB = { fontSize: "15px", lineHeight: "23px", color: "var(--muted)", fontFamily: "var(--font-body)" };
const CARD = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "12px 20px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

export default function Conectar() {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("whatsapp");
  const [phase, setPhase] = useState("form"); // form | connecting | error | done
  const [tpl, setTpl] = useState("pending"); // pending | review
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const ch = CHANNELS.find((c) => c.id === channel);
  const attempts = useRef(0);
  const connect = () => {
    setPhase("connecting");
    setTimeout(() => {
      attempts.current += 1;
      // El primer intento de WhatsApp simula el fallo típico de verificación de
      // Meta para enseñar el estado de error + recuperación; el segundo conecta.
      if (channel === "whatsapp" && attempts.current === 1) setPhase("error");
      else { setPhase("done"); setStep(3); }
    }, reduced.current ? 0 : 1300);
  };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@keyframes mo-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}.mo-rise{animation:none!important}}`}</style>
      <header style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid var(--line-soft)" }}>
        <img src="/brand/moodly-logo-black.svg" alt="Moodly" width="78" height="20" style={{ display: "block" }} />
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "14px", lineHeight: "14px" }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1; const cur = step === n; const done = step > n;
            return <li key={label} aria-current={cur ? "step" : undefined} style={{ padding: "8px 14px", borderRadius: "800px", ...(cur ? { background: "var(--ink)", color: "var(--on-ink)" } : done ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { boxShadow: "inset 0 0 0 1px var(--line)", color: "var(--muted)" }) }}>{done ? "✓" : n} · {label}</li>;
          })}
        </ol>
        <a href="/plataforma/configuracion/integraciones" style={{ fontSize: "14px", color: "var(--muted)" }}>Cancelar</a>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: "760px", margin: "0 auto", padding: "56px 24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "28px" }}>

        {step === 1 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>¿Qué canal conectamos?</h1><span style={SUB}>Para clínicas solemos empezar por WhatsApp. Puedes añadir más después.</span></div>
            <div role="radiogroup" aria-label="Canal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {CHANNELS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={channel === c.id} onClick={() => setChannel(c.id)} style={{ ...CARD, textAlign: "left", padding: "18px", display: "flex", gap: "14px", alignItems: "center", cursor: "pointer", borderColor: channel === c.id ? "var(--ink)" : "var(--line)", outline: channel === c.id ? "1px solid var(--ink)" : "none" }}>
                  <span style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${c.logo}`} alt="" width="24" height="24" /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "15px", fontWeight: 500 }}>{c.name}</span><span style={{ fontSize: "13px", lineHeight: "18px", color: "var(--muted-2)", fontFamily: "var(--font-body)" }}>{c.desc}</span></span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={() => { setStep(2); setPhase("form"); }} style={btnDark}>Continuar</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>{`Conecta ${ch.name}`}</h1><span style={SUB}>{channel === "whatsapp" ? "Usamos la API oficial de Meta. Tus mensajes y tu número son tuyos; nosotros solo los gestionamos." : "Te llevamos al proveedor para autorizar el acceso. Pedimos los permisos mínimos."}</span></div>

            {channel === "whatsapp" ? (
              <div style={{ ...CARD, padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Nombre del negocio<input defaultValue="Clínica Dental Sol" style={{ padding: "11px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)" }} /></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Número de WhatsApp<input defaultValue="+34 600 00 00 00" style={{ padding: "11px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)" }} /></label>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "var(--linen)", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span aria-hidden="true">🔒</span><span>Meta verificará el número con un código. El token de acceso se guarda cifrado y nunca se muestra.</span></div>
                {phase === "error" && <div role="alert" className="mo-rise" style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "var(--rose-bg)", color: "var(--rose-fg)", fontSize: "14px", lineHeight: "20px" }}><span>×</span><span>No se pudo verificar el número con Meta. Revisa que sea correcto y que no esté ya en otra cuenta de WhatsApp.</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setStep(1)} style={btnLight}>Atrás</button>
                  <button type="button" disabled={phase === "connecting"} onClick={connect} style={{ ...btnDark, opacity: phase === "connecting" ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    {phase === "connecting" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />Conectando…</> : phase === "error" ? "Reintentar" : "Conectar con Meta"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ ...CARD, padding: "32px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center" }}>
                <span style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={`/logos/${ch.logo}`} alt="" width="30" height="30" /></span>
                <span style={{ ...SUB, maxWidth: "380px" }}>{`Te abriremos ${ch.name} en una ventana segura para que autorices el acceso con tu cuenta.`}</span>
                <button type="button" disabled={phase === "connecting"} onClick={connect} style={{ ...btnDark, display: "inline-flex", alignItems: "center", gap: "8px" }}>{phase === "connecting" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />Conectando…</> : `Autorizar con ${ch.name}`}</button>
                <button type="button" onClick={() => setStep(1)} style={{ ...btnLight, border: 0, background: "transparent" }}>Atrás</button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <span style={{ width: "44px", height: "44px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flex: "none" }}>✓</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><h1 style={H}>{`${ch.name} conectado`}</h1><span style={SUB}>Ya puede recibir y responder. {channel === "whatsapp" ? "Falta aprobar las plantillas para poder iniciar conversaciones." : "El agente de Atención empezará a usarlo."}</span></div>
            </div>

            {channel === "whatsapp" && (
              <div style={{ ...CARD, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", gap: "12px", flexWrap: "wrap" }}><span style={{ fontSize: "16px", fontWeight: 500 }}>Plantillas de WhatsApp</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Meta revisa cada plantilla antes de usarla</span></div>
                {[["Recordatorio de cita 24 h", tpl === "review" ? "review" : "draft"], ["Factura disponible", "approved"], ["Hueco libre para lista de espera", "draft"]].map(([n, st]) => (
                  <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 20px", borderTop: "1px solid var(--line-soft)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px" }}>{n}</span>
                    {st === "approved" ? <span style={{ padding: "3px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Aprobada</span>
                      : st === "review" ? <span style={{ padding: "3px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>En revisión de Meta</span>
                      : <button type="button" onClick={() => setTpl("review")} style={{ ...btnLight, padding: "7px 12px" }}>Enviar a revisión</button>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><a href="/plataforma/configuracion/integraciones" style={btnLight}>Ver integraciones</a><a href="/plataforma" style={btnDark}>Ir al panel</a></div>
          </div>
        )}
      </main>
    </div>
  );
}
