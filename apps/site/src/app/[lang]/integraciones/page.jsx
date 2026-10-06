"use client";
import { useMemo, useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DemoForm from "@/components/demo-form";

// Logos: Simple Icons (CC0) e Iconify (svg-logos, vscode-icons, devicon), en /public/logos.
// Las marcas pertenecen a sus dueños; se usan solo para indicar compatibilidad.
const CATEGORIES = [
  { id: "mensajeria", name: "Mensajería y redes", items: [
    ["whatsapp", "WhatsApp Business", "Responde, reserva y envía recordatorios y facturas."],
    ["instagram", "Instagram", "Mensajes directos y comentarios."],
    ["messenger", "Messenger", "Mensajes de tu página de Facebook."],
    ["facebook", "Facebook", "Página y reseñas."],
    ["telegram", "Telegram", "Atención por Telegram."],
    ["tiktok", "TikTok", "Mensajes y leads de campañas."],
    ["x", "X", "Menciones y mensajes."],
    ["linkedin", "LinkedIn", "Leads y mensajes de empresa."],
    ["threads", "Threads", "Respuestas y menciones."],
    ["youtube", "YouTube", "Comentarios de tu canal."],
    ["pinterest", "Pinterest", "Mensajes y tráfico de tus tableros."],
    ["signal", "Signal", "Mensajería cifrada."],
  ]},
  { id: "email", name: "Email, calendario y reuniones", items: [
    ["gmail", "Gmail", "Clasifica, responde y archiva emails."],
    ["googlecalendar", "Google Calendar", "Reserva y mueve citas en tu agenda."],
    ["microsoftoutlook", "Outlook", "Email y calendario de Microsoft 365."],
    ["microsoftteams", "Microsoft Teams", "Avisos y aprobaciones al equipo."],
    ["googlemeet", "Google Meet", "Enlaces de videollamada en cada cita."],
    ["zoom", "Zoom", "Reuniones con clientes."],
    ["calendly", "Calendly", "Sincroniza disponibilidad y reservas."],
    ["slack", "Slack", "Avisos y aprobaciones al equipo."],
    ["calcom", "Cal.com", "Reservas de código abierto."],
    ["webex", "Webex", "Videollamadas de empresa."],
    ["googletasks", "Google Tasks", "Tareas de seguimiento."],
  ]},
  { id: "crm", name: "CRM y ventas", items: [
    ["hubspot", "HubSpot", "Contactos, negocios y seguimiento."],
    ["salesforce", "Salesforce", "Leads y oportunidades."],
    ["dynamics365", "Microsoft Dynamics 365", "CRM y ERP de Microsoft."],
    ["freshsales.png", "Freshsales", "CRM de ventas de Freshworks."],
    ["pipedrive", "Pipedrive", "Embudo de ventas."],
    ["zoho", "Zoho CRM", "Contactos y negocios."],
    ["odoo", "Odoo", "CRM, ventas e inventario."],
    ["mondaydotcom", "monday.com", "Tableros y seguimiento."],
    ["mailchimp", "Mailchimp", "Campañas a tus clientes."],
    ["typeform", "Typeform", "Formularios que crean leads."],
    ["intercom", "Intercom", "Chat de soporte y tickets."],
    ["zendesk", "Zendesk", "Tickets de atención al cliente."],
    ["freshdesk.png", "Freshdesk", "Soporte y tickets."],
    ["brevo", "Brevo", "Email y SMS de marketing."],
    ["klaviyo.png", "Klaviyo", "Email para tiendas online."],
    ["activecampaign", "ActiveCampaign", "Automatización de marketing."],
  ]},
  { id: "facturacion", name: "Facturación y pagos", items: [
    ["quickbooks", "QuickBooks", "Facturas y cobros."],
    ["xero", "Xero", "Contabilidad y facturas."],
    ["sage", "Sage", "Contabilidad y facturación."],
    ["stripe", "Stripe", "Cobros y enlaces de pago."],
    ["paypal", "PayPal", "Cobros online."],
    ["square", "Square", "Pagos en el local."],
    ["holded.png", "Holded", "Facturación y contabilidad para pymes."],
    ["pennylane.png", "Pennylane", "Contabilidad y facturación (Francia y UE)."],
    ["sap", "SAP Business One", "ERP para pymes y cadenas."],
    ["mollie.png", "Mollie", "Pagos online europeos."],
    ["gocardless", "GoCardless", "Domiciliaciones y cobros recurrentes."],
    ["sumup", "SumUp", "Datáfono y enlaces de pago."],
    ["revolut", "Revolut Business", "Cuentas y pagos de empresa."],
    ["adyen", "Adyen", "Pagos para cadenas."],
    ["klarna", "Klarna", "Pago aplazado."],
  ]},
  { id: "tienda", name: "Tienda online y web", items: [
    ["shopify", "Shopify", "Pedidos, stock y clientes."],
    ["woocommerce", "WooCommerce", "Pedidos y stock."],
    ["wordpress", "WordPress", "Chat en tu web y formularios."],
    ["wix", "Wix", "Chat en tu web y reservas."],
    ["squarespace", "Squarespace", "Chat en tu web."],
    ["googlemaps", "Google Maps", "Ficha de empresa y reseñas."],
    ["prestashop", "PrestaShop", "Pedidos y clientes."],
    ["magento", "Adobe Commerce", "Pedidos y catálogo."],
    ["bigcommerce", "BigCommerce", "Pedidos y stock."],
    ["webflow", "Webflow", "Chat en tu web y formularios."],
    ["framer", "Framer", "Chat en tu web."],
  ]},
  { id: "documentos", name: "Documentos y conocimiento", items: [
    ["googledrive", "Google Drive", "Tarifas, protocolos y documentos."],
    ["googledocs", "Google Docs", "Documentos de conocimiento."],
    ["googlesheets", "Google Sheets", "Tablas de precios y stock."],
    ["microsoftexcel", "Excel", "Hojas de cálculo."],
    ["microsoftonedrive", "OneDrive", "Archivos de Microsoft 365."],
    ["dropbox", "Dropbox", "Archivos compartidos."],
    ["box", "Box", "Archivos de empresa."],
    ["notion", "Notion", "Wiki y procedimientos."],
    ["googleslides", "Google Slides", "Presentaciones y dosieres."],
    ["confluence", "Confluence", "Documentación interna."],
    ["evernote", "Evernote", "Notas del equipo."],
    ["obsidian", "Obsidian", "Base de conocimiento en Markdown."],
  ]},
  { id: "productividad", name: "Productividad", items: [
    ["airtable", "Airtable", "Bases de datos del negocio."],
    ["trello", "Trello", "Tareas del equipo."],
    ["asana", "Asana", "Tareas y proyectos."],
    ["clickup", "ClickUp", "Tareas y proyectos."],
    ["googleanalytics", "Google Analytics", "Origen de tus clientes."],
    ["jira", "Jira", "Incidencias y proyectos."],
    ["linear", "Linear", "Incidencias de producto."],
    ["basecamp", "Basecamp", "Proyectos con clientes."],
    ["todoist", "Todoist", "Tareas personales."],
    ["miro", "Miro", "Pizarras de equipo."],
    ["figma", "Figma", "Diseños y briefings."],
  ]},
  { id: "automatizacion", name: "Automatización y voz", items: [
    ["zapier", "Zapier", "Miles de apps más vía Zapier."],
    ["make", "Make", "Escenarios con cualquier app."],
    ["n8n", "n8n", "Flujos propios."],
    ["twilio", "Twilio", "Telefonía y SMS."],
    ["ifttt", "IFTTT", "Automatizaciones sencillas."],
    ["discord", "Discord", "Comunidades y soporte."],
  ]},
  { id: "sectoriales", name: "Reservas y TPV sectoriales", items: [
    ["thefork.png", "TheFork", "Reservas de restaurante [vía partner]."],
    ["bookingdotcom", "Booking.com", "Reservas y mensajes de huéspedes."],
    ["lightspeed", "Lightspeed", "TPV para hostelería y retail."],
    ["doctoralia.png", "Doctoralia", "Citas de pacientes [vía partner]."],
  ]},
  { id: "rrhh", name: "RRHH y firma", items: [
    ["factorial.png", "Factorial", "Turnos, ausencias y fichajes."],
    ["personio", "Personio", "RRHH para pymes europeas."],
    ["docusign.png", "DocuSign", "Firma de contratos y presupuestos."],
    ["dropboxsign.png", "Dropbox Sign", "Firma electrónica."],
  ]},
  { id: "ia", name: "Proveedores de IA", items: [
    ["openai", "OpenAI", "Modelos GPT, visión y voz."],
    ["anthropic", "Anthropic", "Modelos Claude."],
    ["googlegemini", "Google Gemini", "Modelos Gemini."],
    ["mistralai", "Mistral AI", "Proveedor europeo de modelos."],
    ["meta", "Meta Llama", "Modelos abiertos para despliegue propio."],
    ["perplexity", "Perplexity", "Búsqueda en la web con fuentes."],
    ["huggingface", "Hugging Face", "Modelos abiertos y embeddings."],
    ["azure", "Azure OpenAI", "Modelos en tu cuenta de Azure."],
    ["aws", "Amazon Bedrock", "Modelos en tu cuenta de AWS."],
    ["googlevertex", "Vertex AI", "Modelos en Google Cloud."],
    ["ollama", "Ollama", "Modelos en tus servidores."],
  ]},
  { id: "contenido", name: "Contenido con IA", items: [
    ["heygen", "HeyGen", "Vídeos con avatar para bienvenidas y explicaciones."],
    ["captions", "Captions", "Subtítulos y edición de vídeos cortos."],
    ["gamma", "Gamma", "Presentaciones y PDF a partir de un texto."],
    ["notebooklm", "NotebookLM", "Resúmenes y audios de tus documentos."],
    ["elevenlabs", "ElevenLabs", "Voces naturales para llamadas y vídeos."],
    ["canva", "Canva", "Diseños de redes y cartelería."],
    ["descript", "Descript", "Edición de vídeo y pódcast por texto."],
    ["runway", "Runway", "Generación y edición de vídeo."],
  ]},
];

// Populares en España y la UE: se muestran con el filtro «Populares en Europa».
const EU = new Set(["Holded", "Microsoft Dynamics 365", "PrestaShop", "Klaviyo", "Brevo", "Freshdesk", "Intercom", "Factorial", "Personio", "DocuSign", "Mollie", "GoCardless", "Booking.com", "TheFork", "Lightspeed", "Shopify", "WooCommerce", "SAP Business One", "Adyen", "Pennylane", "Odoo", "Freshsales", "Typeform", "Calendly", "Dropbox Sign", "WhatsApp Business", "Gmail", "Google Calendar", "Outlook", "Mistral AI"]);

const pill = (on) => ({ flex: "none", padding: "10px 16px", borderRadius: "800px", border: on ? "1px solid #000000" : "1px solid #0000001a", background: on ? "#000000" : "#ffffff", color: on ? "#ffffff" : "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer" });

export default function Integraciones() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const visible = useMemo(() => CATEGORIES
    .filter((c) => cat === "all" || cat === "eu" || c.id === cat)
    .map((c) => ({ ...c, items: c.items.filter(([, name, use]) => (cat !== "eu" || EU.has(name)) && (name + " " + use).toLowerCase().includes(q.trim().toLowerCase())) }))
    .filter((c) => c.items.length), [cat, q]);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>
      <SiteHeader />

      <section style={{ padding: "clamp(56px, 8vw, 88px) clamp(16px, 4vw, 40px) 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <span style={{ padding: "6px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "14px", color: "#5f5f63" }}>{total}+ integraciones</span>
        <h1 style={{ margin: 0, fontSize: "clamp(36px, 4.6vw, 52px)", lineHeight: 1.08, fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "760px" }}>Se conecta con las herramientas que ya usas</h1>
        <p style={{ margin: 0, fontSize: "18px", lineHeight: "27px", fontWeight: 300, maxWidth: "540px" }}>APIs oficiales, proveedores de IA y protocolos abiertos como MCP. Tus agentes trabajan donde trabaja tu equipo, sin cambiar de herramientas.</p>
      </section>

      <section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px" }}>
          <div style={{ position: "sticky", top: "56px", zIndex: 5, background: "#f7f7f8e6", backdropFilter: "blur(8px)", padding: "12px 0", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor="q-int" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar integración</label>
            <input id="q-int" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar integración" style={{ flex: "1 1 240px", maxWidth: "320px", padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "400 15px/20px var(--font-display)", color: "#000000" }} />
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", flex: "1 1 100%", minWidth: 0 }}>
              <button type="button" onClick={() => setCat("all")} style={pill(cat === "all")}>Todas</button>
              <button type="button" onClick={() => setCat("eu")} style={pill(cat === "eu")}>Populares en Europa</button>
              {CATEGORIES.map((c) => (<button key={c.id} type="button" onClick={() => setCat(c.id)} style={pill(cat === c.id)}>{c.name}</button>))}
            </div>
          </div>

          {visible.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "24px", lineHeight: "28px", fontWeight: 400, letterSpacing: "-0.48px" }}>{c.name}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                {c.items.map(([logo, name, use]) => (
                  <div key={name} style={{ background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "18px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <span style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <img src={`/logos/${logo.includes(".") ? logo : logo + ".svg"}`} alt="" width="26" height="26" style={{ borderRadius: logo.includes(".") ? "6px" : 0, objectFit: "contain" }} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{name}</span>
                      <span style={{ fontSize: "14px", lineHeight: "20px", color: "#5f5f63" }}>{use}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {visible.length === 0 && <p style={{ margin: 0, color: "#5f5f63" }}>No encontramos «{q}». Pídenosla abajo y la conectamos vía MCP.</p>}

          <div style={{ borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(28px, 5vw, 56px)", display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, flex: "1 1 360px", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.025em" }}>¿Usas otra herramienta? <span style={{ opacity: 0.55 }}>Con MCP conectamos casi cualquier cosa. Te avisamos cuando esté lista.</span></h2>
            <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", justifyContent: "flex-end" }}><DemoForm id="tool-email" placeholder="Tu email" button="Pedir integración" /></div>
          </div>
        </div>
      </section>

      
    <SiteFooter />
</div>
  );
}
