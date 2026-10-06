import LangLink from "@/components/lang-link";
import Link from "next/link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";

export const metadata = { title: "Seguridad y privacidad · Moodly AI" };

// Certificaciones: hoja de ruta, no se declaran como obtenidas.
const CERTS = [
  ["RGPD", "Diseñado para el RGPD", "DPA con cada cliente y datos en la UE.", "Desde el inicio"],
  ["ISO", "ISO 27001", "Sistema de gestión de la seguridad de la información.", "[En hoja de ruta]"],
  ["SOC 2", "SOC 2 Type II", "Auditoría independiente de controles.", "[En hoja de ruta]"],
  ["IA", "Sin entrenamiento", "Tus datos no entrenan modelos de IA.", "Política de proveedores"],
];
const FOUNDATIONS = [
  ["Datos en la UE", "Plataforma y base de datos alojadas en la Unión Europea [por confirmar región y proveedor].", "#004c39", "#ffffff"],
  ["Sin entrenamiento", "Usamos APIs empresariales de IA cuyos términos excluyen entrenar con tus datos [confirmar proveedor a proveedor].", "#ffffff", "#000000"],
  ["Cifrado de extremo a extremo", "AES-256 en reposo, TLS 1.2+ en tránsito y credenciales de integraciones en una bóveda cifrada.", "#9dbecc", "#000000"],
];
const DEPLOY = [
  ["Nube compartida", "Para pymes. Aislamiento por organización con políticas a nivel de fila en la base de datos.", "Estándar"],
  ["Nube dedicada", "Instancia separada para tu empresa.", "Enterprise"],
  ["Tu propia nube", "En tu cuenta de Azure, AWS o Google Cloud.", "Enterprise"],
  ["En tus servidores", "On-premise con contenedores.", "Enterprise · a valorar"],
];
const ARCH = [
  ["Mínimo privilegio", "Cada agente y cada persona solo accede a lo que necesita. Roles: administración, gerencia, equipo y operaciones."],
  ["Defensa en profundidad", "Varias capas: red, aplicación, base de datos y límites de uso por organización."],
  ["Aprobación humana", "Cobros, envíos de documentos y cambios sensibles pueden requerir que una persona los apruebe."],
  ["Protección de datos personales", "Los datos sensibles se enmascaran antes de enviarse al modelo cuando no son necesarios."],
  ["Defensa ante instrucciones maliciosas", "Los mensajes de clientes se tratan como datos, nunca como órdenes para el agente."],
  ["Registro de auditoría", "Cada acción de cada agente queda registrada con fecha, motivo y quién la aprobó."],
];
const MODEL = [
  ["Enrutador de modelos", "Un único punto de acceso a OpenAI, Anthropic, Google, Mistral y modelos abiertos, con cambio automático si un proveedor falla."],
  ["Tus propias claves (BYOK)", "Conecta tus claves o tu nube. El tráfico va con tus contratos y tus regiones."],
  ["Modelos por agente", "Fija qué modelo usa cada agente o deja que Moodly elija según calidad, coste y región."],
];
const GOV = [
  ["Permisos por organización y sede", "Cada sede ve solo sus datos; la central, todo."],
  ["Permisos heredados", "Las integraciones respetan los permisos que ya tienes en Google, Microsoft o tu CRM."],
  ["Analítica opcional", "Tú decides si se guardan métricas de uso de tu equipo."],
  ["Exportación y borrado", "Exporta todos tus datos o elimina la cuenta cuando quieras (RGPD)."],
];
const DOCS = [
  ["Política de privacidad", "/privacidad"], ["Términos del servicio", "/terminos"], ["Contrato de encargo (DPA)", "/contacto"], ["Lista de subencargados", "/contacto"],
];
const FAQ = [
  ["¿Dónde se guardan mis datos?", "En la Unión Europea [por confirmar región]. Para Enterprise ofrecemos nube dedicada, tu propia nube o tus servidores."],
  ["¿Los modelos de IA aprenden de mis datos o de mis clientes?", "No. Usamos APIs empresariales que excluyen el entrenamiento con datos de clientes [confirmar proveedor a proveedor]."],
  ["¿Firmáis un contrato de encargo de tratamiento (DPA)?", "Sí, con todos los clientes, antes de empezar."],
  ["¿Qué pasa si un agente se equivoca?", "Defines qué puede hacer solo y qué necesita aprobación. Todo queda registrado y puedes corregirlo o revertirlo."],
  ["¿Cómo informo de una vulnerabilidad?", "Escribe a [security@moodly.ai]. Respondemos en [72 horas] y no emprendemos acciones contra investigaciones de buena fe."],
];

const Head = ({ a, b }) => (<h2 style={h2}>{a} <span style={muted}>{b}</span></h2>);

export default function Seguridad() {
  return (
    <PageShell
      eyebrow="Centro de confianza"
      title="Seguridad y privacidad desde el primer agente"
      intro="Tus datos y los de tus clientes, protegidos, en la UE y bajo tu control. Así protegemos cada conversación."
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>Hablar con seguridad</LangLink><a href="#documentos" style={pillBtn(false)}>Documentos legales</a></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {CERTS.map(([badge, t, d, status]) => (
            <div key={t} style={{ ...card, display: "flex", flexDirection: "column", gap: "12px", minHeight: "220px" }}>
              <span aria-hidden="true" style={{ width: "56px", height: "56px", borderRadius: "800px", border: "1px solid #0000001a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>{badge}</span>
              <h3 style={h3}>{t}</h3>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</p>
              <span style={{ marginTop: "auto", fontSize: "13px", color: status.startsWith("[") ? "#8e4e00" : "#004c39" }}>{status}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a="Bases de confianza." b="Lo que no cambia, sea cual sea tu plan." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {FOUNDATIONS.map(([t, d, bg, fg]) => (
              <div key={t} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "240px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t}</h3>
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.78 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a="Opciones de despliegue." b="De la nube compartida a tus propios servidores." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {DEPLOY.map(([t, d, tier], i) => (
              <div key={t} style={{ ...card, background: i === 0 ? "#e8edff" : "#ffffff", display: "flex", flexDirection: "column", gap: "10px", minHeight: "200px" }}>
                <h3 style={h3}>{t}</h3>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</p>
                <span style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: i === 0 ? "#2457f5" : "#f2f2f4", color: i === 0 ? "#ffffff" : "#000000", fontSize: "12px" }}>{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a="Arquitectura de seguridad." b="Pensada para agentes que actúan, no solo responden." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            {ARCH.map(([t, d]) => (<div key={t} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "32px" }}>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end" }}>
            <h2 style={{ ...h2, flex: "1 1 420px" }}>Uso de modelos de IA. <span style={{ opacity: 0.55 }}>Varios proveedores, una sola política.</span></h2>
            <LangLink href="/modelos" style={pillBtn(false)}>Ver modelos</LangLink>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {MODEL.map(([t, d]) => (<div key={t} style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #ffffff33", paddingTop: "16px" }}><span style={{ fontSize: "17px", lineHeight: "24px" }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a="Gobierno y administración." b="Control total para quien administra." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {GOV.map(([t, d]) => (<div key={t} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section id="documentos" style={{ ...section, scrollMarginTop: "56px" }}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a="Documentos legales." b="Todo por escrito." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            {DOCS.map(([t, href]) => (<Link key={t} href={href} style={{ ...card, padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "16px", lineHeight: "22px" }}>{t}<span aria-hidden="true">→</span></Link>))}
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
