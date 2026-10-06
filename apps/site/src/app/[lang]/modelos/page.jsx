import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import Link from "next/link";

export const metadata = { title: "Modelos de IA · Moodly AI" };

// Modelos y contextos según las webs oficiales de cada proveedor (consultadas el 7 oct 2026).
const PROVIDERS = [
  ["openai", "OpenAI", "GPT-6 Sol y Luna", "Texto, visión y voz en tiempo real · contexto de 1,05 M tokens"],
  ["anthropic", "Anthropic", "Claude Opus, Sonnet y Haiku 5.5", "Texto y visión · contexto de 1 M tokens"],
  ["googlegemini", "Google", "Gemini 3.5 Flash y 3.1 Pro", "Texto, visión, audio y voz en directo · contexto de 1 M tokens"],
  ["mistralai", "Mistral AI", "Mistral Large 4, Medium 3.5 y Small 4", "Proveedor europeo · también pesos abiertos"],
  ["meta", "Meta", "Llama (pesos abiertos)", "Para despliegue propio"],
  ["deepseek", "DeepSeek", "DeepSeek (pesos abiertos)", "Solo en despliegue propio, previa revisión"],
  ["elevenlabs", "ElevenLabs", "Voz y agentes de voz", "Llamadas con voz natural"],
  ["huggingface", "Hugging Face", "Modelos abiertos", "Modelos de nicho y embeddings"],
];
const CLOUDS = [
  ["azure", "Azure OpenAI", "Modelos de OpenAI en regiones de la UE"],
  ["aws", "Amazon Bedrock", "Claude, Llama y Mistral en tu cuenta de AWS"],
  ["googlevertex", "Google Vertex AI", "Gemini y Claude en Google Cloud"],
  ["ollama", "Ollama / on-premise", "Modelos abiertos en tus propios servidores"],
];
const TASKS = [
  ["Recepción", "#004c39", "Respuestas rápidas y reservas", "Modelo rápido y económico", "Respuesta en segundos y coste bajo por conversación"],
  ["Atención al cliente", "#9dbecc", "Preguntas con tu información", "Modelo equilibrado + búsqueda en tus documentos", "Responde solo con lo que tú le has dado"],
  ["Comercial", "#a30042", "Redactar seguimientos y propuestas", "Modelo de redacción de alta calidad", "Mensajes con el tono de tu negocio"],
  ["Administración", "#8e4e00", "Leer facturas y documentos", "Modelo con visión y extracción precisa", "Datos exactos para aprobar en un clic"],
];
const FAQ = [
  ["¿Tengo que elegir un modelo?", "No. Por defecto Moodly elige el modelo adecuado para cada tarea según calidad, velocidad, coste y región. Si quieres, puedes fijar un modelo por agente desde Ajustes."],
  ["¿Puedo usar mis propias claves (BYOK)?", "Sí. Conectas tu clave de OpenAI, Anthropic, Google, Mistral o de tu nube (Azure, AWS, Google Cloud) y el consumo se factura en tu cuenta del proveedor. La cuota de Moodly baja en consecuencia."],
  ["¿Los proveedores entrenan con mis datos?", "Usamos las APIs empresariales de cada proveedor, cuyos términos excluyen el entrenamiento con los datos que se envían. [Por confirmar proveedor a proveedor antes de publicar]."],
  ["¿Dónde se procesan los datos?", "Siempre que el proveedor lo permite, usamos regiones de la UE. Para cadenas y empresas ofrecemos despliegue en tu propia nube o en tus servidores."],
  ["¿Qué pasa si un proveedor falla?", "El enrutador de modelos cambia automáticamente a un modelo equivalente de otro proveedor para que tus agentes sigan atendiendo."],
];

export default function Modelos() {
  return (
    <PageShell
      eyebrow="Agnóstico de modelo"
      title="Los mejores modelos de IA, sin atarte a ninguno"
      intro="Moodly conecta con los principales proveedores de IA y elige el mejor modelo para cada tarea. O usa tus propias claves y tu propia nube."
      actions={<><LangLink href="/#demo" style={pillBtn(true)}>Pedir demo</LangLink><LangLink href="/seguridad" style={pillBtn(false)}>Ver seguridad</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>Proveedores de IA. <span style={muted}>Todos desde una sola plataforma.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {PROVIDERS.map(([logo, name, family, use]) => (
              <div key={name} style={{ ...card, padding: "20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${logo}.svg`} alt="" width="28" height="28" /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: "14px", lineHeight: "20px" }}>{family}</span>
                  <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }}>{use}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>El modelo adecuado para cada tarea. <span style={muted}>Elegido automáticamente o fijado por ti.</span></h2>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px", lineHeight: "22px", minWidth: "720px" }}>
              <thead><tr style={{ textAlign: "left", background: "#f2f2f4" }}><th style={{ padding: "14px 24px", fontWeight: 500 }}>Agente</th><th style={{ padding: "14px", fontWeight: 500 }}>Tarea típica</th><th style={{ padding: "14px", fontWeight: 500 }}>Tipo de modelo</th><th style={{ padding: "14px 24px", fontWeight: 500 }}>Por qué</th></tr></thead>
              <tbody>
                {TASKS.map(([agent, color, task, model, why]) => (
                  <tr key={agent} style={{ borderTop: "1px solid #0000000f" }}>
                    <td style={{ padding: "16px 24px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: color }} />{agent}</span></td>
                    <td style={{ padding: "16px 14px" }}>{task}</td>
                    <td style={{ padding: "16px 14px" }}>{model}</td>
                    <td style={{ padding: "16px 24px", ...muted }}>{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          <div style={{ ...card, background: "#000000", color: "#ffffff", border: 0, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", opacity: 0.6 }}>Opción 1 · por defecto</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>Incluido en tu cuota</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>Nosotros gestionamos los proveedores y el consumo. Pagas una cuota fija por agente y el uso extra a precio fijo, con un límite de gasto que decides tú.</p>
            <LangLink href="/precios" style={{ marginTop: "auto", color: "#ffffff", fontSize: "14px" }}>Ver precios →</LangLink>
          </div>
          <div style={{ ...card, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", ...muted }}>Opción 2</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>Tus propias claves (BYOK)</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", ...muted }}>Conecta tus claves de OpenAI, Anthropic, Google o Mistral. El consumo va a tu cuenta del proveedor y tú controlas el gasto.</p>
            <div style={{ marginTop: "auto", display: "flex", gap: "8px" }}>{["openai", "anthropic", "googlegemini", "mistralai"].map((l) => (<span key={l} style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={`/logos/${l}.svg`} alt="" width="22" height="22" /></span>))}</div>
          </div>
          <div style={{ ...card, background: "#a3c2a7", border: 0, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", opacity: 0.7 }}>Opción 3 · cadenas y empresas</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>Tu nube o tus servidores</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>Modelos en tu cuenta de Azure, AWS o Google Cloud, o modelos abiertos en tus propios servidores.</p>
            <LangLink href="/enterprise" style={{ marginTop: "auto", fontSize: "14px" }}>Ver Enterprise →</LangLink>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>En tu nube, si lo necesitas. <span style={muted}>Los mismos modelos, bajo tus contratos.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {CLOUDS.map(([logo, name, text]) => (
              <div key={name} style={{ ...card, padding: "20px", display: "flex", gap: "14px", alignItems: "center" }}>
                <span style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${logo}.svg`} alt="" width="26" height="26" /></span>
                <span><span style={{ display: "block", fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{name}</span><span style={{ display: "block", fontSize: "14px", lineHeight: "20px", ...muted }}>{text}</span></span>
              </div>
            ))}
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
