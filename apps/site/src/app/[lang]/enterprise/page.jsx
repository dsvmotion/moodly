import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import Link from "next/link";

export const metadata = { title: "Enterprise · Moodly AI" };

const PROBLEMS = ["Cada sede atiende distinto", "Herramientas de IA sueltas y sin control", "Datos de clientes en chats personales", "Nadie sabe qué hace cada bot", "Costes de IA imposibles de prever", "Poca adopción fuera del equipo central"];
const PILLARS = [
  ["Una plataforma para toda la cadena", "Agentes por sede con plantillas y reglas comunes. La central decide qué se hereda y qué puede ajustar cada local.", "#000000", "#ffffff"],
  ["Se conecta con tu sistema", "API REST, webhooks y MCP para tu ERP, CRM, sistema de reservas o herramientas internas. Datos sincronizados en ambos sentidos.", "#ffffff", "#000000"],
  ["Seguro por defecto", "SSO, roles por sede, registro de auditoría, tus claves de IA y despliegue en tu nube si lo necesitas.", "#a3c2a7", "#000000"],
];
const DEPLOY = [
  ["Nube compartida", "Alojada en la UE [por confirmar proveedor y región].", "Estándar"],
  ["Nube dedicada", "Instancia solo para tu empresa, gestionada por Moodly.", "Enterprise · [desde N sedes]"],
  ["Tu propia nube", "Despliegue en tu cuenta de Azure, AWS o Google Cloud.", "Enterprise · [desde N sedes]"],
  ["En tus servidores", "Instalación on-premise con contenedores.", "Enterprise · [a valorar]"],
];
const GOVERNANCE = [
  ["Roles y permisos por sede", "Central, región, local y profesional: cada persona ve solo lo suyo."],
  ["Inicio de sesión único (SSO)", "Google Workspace o Microsoft Entra ID. Altas y bajas automáticas [SCIM, en hoja de ruta]."],
  ["Registro de auditoría", "Cada acción de cada agente queda registrada: qué hizo, cuándo y quién lo aprobó."],
  ["Políticas heredadas", "Reglas y aprobaciones definidas en la central, bloqueables por sede."],
  ["Panel de consumo", "Consumo de IA por sede y por agente, con límites y avisos."],
  ["Gobierno de agentes", "Revisión y aprobación de cambios en agentes antes de publicarlos."],
];
const ONBOARDING = ["Equipo de implantación dedicado", "Canal compartido (Slack o Teams) con respuesta rápida", "Taller de arranque en remoto o presencial", "Formación por rol: dirección, gerentes y recepción", "Alta de sedes en lote", "Revisiones trimestrales de resultados"];

export default function Enterprise() {
  return (
    <PageShell
      eyebrow="Cadenas · multisede · grandes empresas"
      title="Agentes de IA para toda tu organización, bajo control"
      intro="Una plataforma segura para unificar la atención, las reservas, las ventas y la administración de todas tus sedes. Fácil de adoptar y preparada para crecer."
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>Hablar con ventas</LangLink><LangLink href="/seguridad" style={pillBtn(false)}>Ver seguridad</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={h2}>Sin una plataforma común, la IA se dispersa. <span style={muted}>Y con ella, los riesgos.</span></h2>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", ...muted }}>Moodly reúne en un solo sitio los agentes, las reglas, los datos y el control de todas las sedes.</p>
          </div>
          <div style={{ flex: "1 1 420px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
            {PROBLEMS.map((p) => (<span key={p} style={{ ...card, padding: "16px", fontSize: "15px", lineHeight: "22px", display: "flex", gap: "10px" }}><span style={{ color: "#a30042" }}>×</span>{p}</span>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          {PILLARS.map(([t, d, bg, fg]) => (
            <div key={t} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "260px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t}</h3>
              <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Opciones de despliegue. <span style={muted}>Según tus requisitos de seguridad.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {DEPLOY.map(([t, d, tier], i) => (
              <div key={t} style={{ ...card, background: i === 0 ? "#e8edff" : "#ffffff", minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={h3}>{t}</h3>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", ...muted }}>{d}</p>
                <span style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: i === 0 ? "#2457f5" : "#f2f2f4", color: i === 0 ? "#ffffff" : "#000000", fontSize: "12px", lineHeight: "16px" }}>{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Gobierno y control. <span style={muted}>Para la central, sin frenar a las sedes.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
            {GOVERNANCE.map(([t, d]) => (<div key={t} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "40px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={h2}>Tu equipo para el despliegue. <span style={{ opacity: 0.55 }}>Te acompañamos de la primera sede a la última.</span></h2>
            <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "flex-start" }}>Hablar con ventas</LangLink>
          </div>
          <ul style={{ flex: "1 1 360px", margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", fontSize: "16px", lineHeight: "24px" }}>
            {ONBOARDING.map((o) => (<li key={o} style={{ display: "flex", gap: "10px" }}><span style={{ color: "#a3c2a7" }}>✓</span>{o}</li>))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
