"use client";
import LangLink from "@/components/lang-link";
import { useState } from "react";
import Link from "next/link";
import PageShell, { card, h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { AGENTS } from "@/components/site-data";

import { IMPLEMENTATION, PRICING as P, eur, estimate } from "@/components/pricing";

// Precio fijo por agente + variable por uso (como Langdock) + implantación según escala.
const IDS = ["recepcion", "atencion", "comercial", "admin"];

const PARTS = [
  ["Fijo", `${P.perAgent} € por agente al mes`, `Plataforma, app, integraciones estándar, usuarios ilimitados y ${P.includedPerAgent} conversaciones incluidas por agente.`, "#ffffff", "#000000"],
  ["Variable", "Pagas solo lo que usas", `${eur(P.perConversation, 2)} por conversación extra y ${eur(P.perVoiceMinute, 2)} por minuto de llamada. Con límite de gasto que decides tú.`, "#e8edff", "#000000"],
  ["Implantación", "Según la escala", "El arranque está incluido. Si necesitas implantación guiada o a medida, te damos un presupuesto cerrado antes de empezar.", "#000000", "#ffffff"],
];
const ADDONS = [
  ["Llamadas de voz", "Atiende llamadas y devuelve las perdidas con voz natural.", `${eur(P.perVoiceMinute, 2)} / minuto`],
  ["Sede adicional", "Agenda, números y reglas propias por local.", `${P.perExtraSite} € / mes`],
  ["Tus propias claves (BYOK)", "Usa tus cuentas de OpenAI, Anthropic, Google o Mistral. El coste de IA va a tu proveedor.", `${eur(P.perConversationByok, 2)} / conversación extra`],
  ["Plantillas de WhatsApp", "Recordatorios y campañas que inicia tu negocio. Meta las cobra por mensaje.", "A precio de Meta, sin margen"],
  
  ["Gobierno avanzado", "SSO, auditoría ampliada y políticas por sede.", "Incluido en Enterprise"],
  ["API y MCP", "Conecta Moodly con tus sistemas y otros agentes.", "Próximamente"],
];
const COMPARE = [
  ["Precio", "Gratis", `${P.perAgent} €/agente + uso`, "A medida"],
  ["Implantación", "Arranque incluido", "Según escala · presupuesto cerrado", "A medida, por fases"],
  ["Duración", `${P.trialDays} días`, "Mensual, sin permanencia", "Anual"],
  ["Agentes", "1", "1 a 4", "Ilimitados por sede"],
  ["Conversaciones incluidas", String(P.trialConversations), `${P.includedPerAgent} por agente/mes`, "Por volumen"],
  ["Canales: WhatsApp, email, web y redes", "✓", "✓", "✓"],
  ["Integraciones estándar", "✓", "✓", "✓ + a medida"],
  ["Aprobaciones y reglas", "✓", "✓", "✓ + políticas heredadas"],
  ["Llamadas de voz", "—", "Por minuto", "Por volumen"],
  ["Elección de modelo de IA", "Automática", "Automática o BYOK", "Automática, fijada, BYOK o tu nube"],
  ["Límite de gasto y avisos", "—", "✓", "✓ por sede"],
  ["SSO y auditoría ampliada", "—", "—", "✓"],
  ["Despliegue", "Nube UE", "Nube UE", "Dedicada, tu nube o tus servidores"],
  ["Soporte", "Email", "Email y WhatsApp", "Gestor dedicado"],
];
const FAQ = [
  ["¿Cuánto cuesta la implantación?", `Depende de la escala. El arranque (plantilla de tu sector, una sesión de configuración y canales básicos) está incluido. La implantación guiada o a medida se presupuesta cerrada tras una llamada de diagnóstico, antes de empezar. Puedes probar ${P.trialDays} días gratis antes de decidir.`],
  ["¿Qué cuenta como una conversación?", "Un intercambio con un cliente sobre un mismo tema en 24 horas, por cualquier canal, tenga los mensajes que tenga. [Definición por validar]."],
  ["¿Y si un mes tengo mucho más uso?", "Pagas las conversaciones extra a precio fijo. Puedes poner un límite de gasto: al llegar al 80 % te avisamos y, al 100 %, los agentes pasan las conversaciones a tu equipo en lugar de seguir sumando."],
  ["¿Hay permanencia?", "No en el plan Negocio: es mensual. Enterprise se contrata por año. Si te vas, exportas tus datos."],
  ["¿Por qué un fijo más un variable?", "El fijo cubre la plataforma; el variable, el coste real de la IA y la voz. Así un negocio pequeño paga poco y uno con mucho volumen paga en proporción."],
  ["¿Puedo usar mis propias claves de IA?", "Sí. Con BYOK el coste de IA va a tu cuenta del proveedor y el variable de Moodly baja."],
  ["¿Los precios incluyen IVA?", "No. Todos los precios se muestran sin IVA."],
];

function Toggle({ on, onClick, label, color = "#2457f5" }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? color : "#d9d9de", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }} />
    </button>
  );
}

export default function Precios() {
  const [on, setOn] = useState({ recepcion: true, atencion: true, comercial: false, admin: false });
  const [sites, setSites] = useState(1);
  const [conversations, setConversations] = useState(600);
  const [voice, setVoice] = useState(0);
  const [byok, setByok] = useState(false);

  const agents = IDS.filter((id) => on[id]).length;
  const e = estimate({ agents, sites, conversations, voiceMinutes: voice, byok });
  const label = { fontSize: "13px", lineHeight: "18px", ...muted };
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "15px", lineHeight: "22px" };
  const slider = { width: "100%", accentColor: "#2457f5" };
  const li = { margin: 0, padding: "16px 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" };
  const badge = (txt) => <span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>{txt}</span>;

  return (
    <PageShell eyebrow="Precios" title="Empieza gratis. Paga por lo que usas." intro={`Una cuota fija por agente, una parte variable según tu uso y una implantación según la escala de tu proyecto. Sin permanencia. Prueba ${P.trialDays} días gratis.`}>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ ...wrap, display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <aside aria-label="Calcula tu precio" className="sticky-wide" style={{ ...card, flex: "1 1 300px", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ fontSize: "18px", lineHeight: "22px" }}>Calcula tu precio</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={label}>Agentes</span>
              {AGENTS.map((a, i) => (
                <div key={a.name} style={row}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: a.color }} />{a.name}</span>
                  <Toggle label={a.name} color={a.color} on={on[IDS[i]]} onClick={() => setOn({ ...on, [IDS[i]]: !on[IDS[i]] })} />
                </div>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={row}><span>Conversaciones al mes</span><strong style={{ fontWeight: 500 }}>{conversations.toLocaleString("es-ES")}</strong></span>
              <input type="range" min="0" max="6000" step="100" value={conversations} onChange={(ev) => setConversations(Number(ev.target.value))} style={slider} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={row}><span>Minutos de llamada al mes</span><strong style={{ fontWeight: 500 }}>{voice.toLocaleString("es-ES")}</strong></span>
              <input type="range" min="0" max="3000" step="50" value={voice} onChange={(ev) => setVoice(Number(ev.target.value))} style={slider} />
            </label>
            <div style={row}>
              <span>Sedes</span>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button type="button" aria-label="Menos sedes" onClick={() => setSites(Math.max(1, sites - 1))} style={{ width: "32px", height: "32px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", cursor: "pointer" }}>−</button>
                <span aria-live="polite" style={{ minWidth: "24px", textAlign: "center" }}>{sites}</span>
                <button type="button" aria-label="Más sedes" onClick={() => setSites(Math.min(20, sites + 1))} style={{ width: "32px", height: "32px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", cursor: "pointer" }}>+</button>
              </span>
            </div>
            <div style={row}>
              <span>Tus propias claves de IA<br /><span style={label}>BYOK · el coste de IA va a tu proveedor</span></span>
              <Toggle label="Tus propias claves de IA" on={byok} onClick={() => setByok(!byok)} />
            </div>
          </aside>

          <div style={{ flex: "2 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div style={{ ...card, display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ fontSize: "20px", lineHeight: "24px" }}>Prueba</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Para ver a tu agente trabajando con tus datos.</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>0 €</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{P.trialDays} días · sin tarjeta</span>
                <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "stretch" }}>Empezar gratis</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #0000000f" }}><li>✓ 1 agente con plantilla de tu sector</li><li>✓ {P.trialConversations} conversaciones</li><li>✓ WhatsApp, email y web</li></ul>
              </div>
              <div style={{ ...card, border: e.enterprise ? card.border : "1px solid #2457f5", display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px", lineHeight: "24px" }}>Negocio</span>{!e.enterprise && badge("Tu plan")}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Para pymes de una a pocas sedes.</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>{eur(Math.round(e.total))}<span style={{ fontSize: "15px", ...muted }}> /mes</span></span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{eur(e.fixed)} fijo + {eur(Math.round(e.variable))} por uso (estimado) · + implantación según escala</span>
                <LangLink href="/contacto" style={{ ...pillBtn(true), alignSelf: "stretch" }}>Pedir demo</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #0000000f" }}><li>✓ {P.perAgent} € por agente al mes</li><li>✓ {P.includedPerAgent} conversaciones por agente incluidas</li><li>✓ Límite de gasto y avisos</li><li>✓ Sin permanencia</li></ul>
              </div>
              <div style={{ ...card, background: "#000000", color: "#ffffff", border: e.enterprise ? "1px solid #2457f5" : 0, display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px", lineHeight: "24px" }}>Enterprise</span>{e.enterprise && badge("Recomendado")}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>Cadenas, multisede y grandes empresas.</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>A medida</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>Precio por volumen. Desde {P.enterpriseFromSites} sedes.</span>
                <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "stretch" }}>Hablar con ventas</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #ffffff26" }}><li>✓ Panel de toda la cadena</li><li>✓ SSO y auditoría</li><li>✓ BYOK, tu nube o tus servidores</li><li>✓ Gestor dedicado</li></ul>
              </div>
            </div>

            <div style={{ ...card, padding: "8px 28px" }} aria-live="polite">
              {[
                [`Agentes · ${Math.max(1, agents)} × ${P.perAgent} €`, eur(e.fixedAgents)],
                [`Sedes adicionales · ${Math.max(0, sites - 1)} × ${P.perExtraSite} €`, eur(e.fixedSites)],
                [`Conversaciones extra · ${e.extraConversations.toLocaleString("es-ES")} (incluidas ${e.included.toLocaleString("es-ES")})`, eur(e.variableConversations, 2)],
                [`Minutos de llamada · ${voice.toLocaleString("es-ES")}`, eur(e.variableVoice, 2)],
              ].map(([k, v]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "12px 0", borderBottom: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px" }}><span style={muted}>{k}</span><span>{v}</span></div>))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "14px 0", fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}><span>Total estimado al mes</span><span>{eur(e.total, 2)}</span></div>
            </div>
            <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }}>Precios sin IVA. Estimación orientativa: el variable depende de tu uso real y nunca supera el límite de gasto que fijes.</span>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Cómo funciona el precio. <span style={muted}>Una parte fija, una variable y la implantación que necesites.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {PARTS.map(([k, t, d, bg, fg]) => (
              <div key={k} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "13px", opacity: 0.65 }}>{k}</span>
                <span style={{ fontSize: "22px", lineHeight: "26px", letterSpacing: "-0.4px" }}>{t}</span>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: "23px", opacity: 0.78 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>+ Implantación según escala. <span style={muted}>Pagas una vez, con presupuesto cerrado antes de empezar.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {IMPLEMENTATION.map((t, i) => (
              <div key={t.id} style={{ ...card, background: i === 0 ? "#dcebdd" : "#ffffff", border: i === 0 ? 0 : card.border, display: "flex", flexDirection: "column", gap: "10px", minHeight: "230px" }}>
                <span style={{ fontSize: "13px", ...muted }}>{t.fit}</span>
                <span style={{ fontSize: "20px", lineHeight: "24px" }}>{t.name}</span>
                <span style={{ fontSize: "28px", lineHeight: "32px", fontWeight: 100, letterSpacing: "-0.03em" }}>{t.price}</span>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{t.text}</p>
              </div>
            ))}
          </div>
          <LangLink href="/contacto" style={{ ...pillBtn(true), alignSelf: "flex-start" }}>Pedir diagnóstico gratuito</LangLink>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Complementos. <span style={muted}>Añade solo lo que necesitas.</span></h2>
          <div style={{ ...card, padding: 0 }}>
            {ADDONS.map(([t, d, p], i) => (
              <div key={t} style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderTop: i ? "1px solid #0000000f" : 0 }}>
                <span style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>{d}</span></span>
                <span style={{ fontSize: "14px", lineHeight: "20px" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Compara los planes</h2>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", fontSize: "15px", lineHeight: "22px" }}>
              <thead><tr style={{ textAlign: "left", background: "#f2f2f4" }}><th style={{ padding: "14px 28px", fontWeight: 500 }}></th><th style={{ padding: "14px", fontWeight: 500 }}>Prueba</th><th style={{ padding: "14px", fontWeight: 500 }}>Negocio</th><th style={{ padding: "14px 28px", fontWeight: 500 }}>Enterprise</th></tr></thead>
              <tbody>{COMPARE.map(([f, a, b, c]) => (<tr key={f} style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "14px 28px" }}>{f}</td><td style={{ padding: "14px", ...muted }}>{a}</td><td style={{ padding: "14px", ...muted }}>{b}</td><td style={{ padding: "14px 28px", ...muted }}>{c}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Preguntas frecuentes</h2>
          <div style={{ borderTop: "1px solid #0000001a" }}>
            {FAQ.map(([q, a]) => (
              <details key={q} style={{ borderBottom: "1px solid #0000001a", padding: "20px 0" }}>
                <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "18px", lineHeight: "27px" }}>{q}<span aria-hidden="true">+</span></summary>
                <p style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: "24px", maxWidth: "760px", ...muted }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
