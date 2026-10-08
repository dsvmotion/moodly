"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";

// Integraciones con estado local (prototipo). TODO(backend): OAuth real y estado en `integrations`.
// Cada integración declara sus ACCIONES (lo que el agente puede hacer con ella),
// su categoría y, si procede, el conjunto por defecto (Google / Microsoft).
const ALL = [
  { id: "whatsapp", name: "WhatsApp Business", logo: "whatsapp.svg", cat: "Mensajería", use: "Número +34 600 000 000", actions: "Responder, enviar plantillas, notas de voz", agents: "Recepción, Atención" },
  { id: "gcal", name: "Google Calendar", logo: "googlecalendar.svg", cat: "Calendario", suite: "google", use: "Agenda de las 3 profesionales", actions: "Crear, mover y cancelar citas", agents: "Recepción" },
  { id: "gmail", name: "Gmail", logo: "gmail.svg", cat: "Email", suite: "google", use: "info@clinicadentalsol.es", actions: "Leer y responder correos", agents: "Atención" },
  { id: "holded", name: "Holded", logo: "holded.png", cat: "Facturación", use: "Facturas y cobros", actions: "Crear factura, registrar cobro", agents: "Administración" },
  { id: "twilio", name: "Teléfono (Twilio)", logo: "twilio.svg", cat: "Voz", use: "Línea +34 910 000 000", actions: "Atender y hacer llamadas", agents: "Recepción" },
  { id: "instagram", name: "Instagram", logo: "instagram.svg", cat: "Mensajería", use: "Mensajes directos", actions: "Responder DMs y comentarios", agents: "Atención" },
  { id: "outlook", name: "Outlook / Microsoft 365", logo: "microsoftoutlook.svg", cat: "Email", suite: "microsoft", use: "Email y calendario", actions: "Correo y calendario", agents: "Recepción, Atención" },
  { id: "maps", name: "Google Reviews", logo: "googlemaps.svg", cat: "Reseñas", use: "Reseñas de tu ficha", actions: "Leer y responder reseñas", agents: "Atención" },
  { id: "hubspot", name: "HubSpot", logo: "hubspot.svg", cat: "CRM", use: "Contactos y presupuestos", actions: "Crear contactos, mover oportunidades", agents: "Comercial" },
  { id: "salesforce", name: "Salesforce", logo: "salesforce.svg", cat: "CRM", use: "Cuentas y oportunidades", actions: "Crear y actualizar oportunidades", agents: "Comercial" },
  { id: "pipedrive", name: "Pipedrive", logo: "pipedrive.svg", cat: "CRM", use: "Embudo de ventas", actions: "Mover tratos de etapa", agents: "Comercial" },
  { id: "doctoralia", name: "Doctoralia", logo: "doctoralia.png", cat: "Calendario", use: "Citas de pacientes [vía partner]", actions: "Leer y crear citas", agents: "Recepción" },
  { id: "calendly", name: "Calendly", logo: "calendly.svg", cat: "Calendario", use: "Reservas online", actions: "Crear y leer reservas", agents: "Recepción" },
  { id: "stripe", name: "Stripe", logo: "stripe.svg", cat: "Facturación", use: "Cobros y enlaces de pago", actions: "Crear enlaces de pago, ver cobros", agents: "Administración" },
  { id: "quickbooks", name: "QuickBooks", logo: "quickbooks.svg", cat: "Facturación", use: "Contabilidad", actions: "Emitir facturas", agents: "Administración" },
  { id: "drive", name: "Google Drive", logo: "googledrive.svg", cat: "Almacenamiento", suite: "google", use: "Protocolos y tarifas", actions: "Leer documentos para responder", agents: "Todos" },
  { id: "onedrive", name: "OneDrive / SharePoint", logo: "microsoftonedrive.svg", cat: "Almacenamiento", suite: "microsoft", use: "Documentos del equipo", actions: "Leer documentos", agents: "Todos" },
  { id: "notion", name: "Notion", logo: "notion.svg", cat: "Almacenamiento", use: "Base de conocimiento", actions: "Leer páginas", agents: "Todos" },
  { id: "shopify", name: "Shopify", logo: "shopify.svg", cat: "CRM", use: "Pedidos y clientes", actions: "Ver pedidos y estados", agents: "Atención, Comercial" },
  { id: "messenger", name: "Facebook Messenger", logo: "messenger.svg", cat: "Mensajería", use: "Mensajes de la página", actions: "Responder mensajes", agents: "Atención" },
  { id: "telegram", name: "Telegram", logo: "telegram.svg", cat: "Mensajería", use: "Canal y mensajes", actions: "Responder mensajes", agents: "Atención" },
  { id: "elevenlabs", name: "ElevenLabs (voz)", logo: "elevenlabs.svg", cat: "Voz", use: "Voz del agente en llamadas", actions: "Síntesis y clonación de voz", agents: "Recepción" },
  { id: "zendesk", name: "Zendesk", logo: "zendesk.svg", cat: "Mensajería", use: "Tickets de soporte", actions: "Crear y responder tickets", agents: "Atención" },
  { id: "thefork", name: "TheFork", logo: "thefork.png", cat: "Calendario", use: "Reservas de mesa", actions: "Leer y gestionar reservas", agents: "Recepción" },
];
const INITIAL = { whatsapp: "on", gcal: "error", gmail: "on", holded: "on", twilio: "on" };
const CATS = ["Todas", "Mensajería", "Calendario", "Email", "CRM", "Facturación", "Reseñas", "Almacenamiento", "Voz"];

const btn = (dark) => ({ padding: "8px 14px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer" });
const h2s = { margin: 0, fontSize: "18px", lineHeight: "19.8px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "#5f5f63" };

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#2457f5" : "#d9d9de", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }} />
    </button>
  );
}

export default function Integraciones() {
  const [state, setState] = useState(INITIAL);
  const [suite, setSuite] = useState("google");
  const [newActions, setNewActions] = useState(true);
  const [cat, setCat] = useState("Todas");
  const set = (id, v) => setState((s) => ({ ...s, [id]: v }));
  const connected = ALL.filter((i) => state[i.id]);
  const available = ALL.filter((i) => !state[i.id] && (cat === "Todas" || i.cat === cat));
  const broken = ALL.filter((i) => state[i.id] === "error");

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="integraciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px", maxWidth: "720px" }}>Integraciones. <span style={muted}>Las herramientas donde trabajan tus agentes, y qué pueden hacer en cada una.</span></h1>

        {broken.map((i) => (
          <div key={i.id} role="alert" style={{ borderRadius: "12px", background: "#fbe1ea", color: "#a30042", padding: "14px 20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 320px" }}><strong style={{ fontWeight: 500 }}>× {i.name} se ha desconectado.</strong> {i.agents} no puede usarla hasta que la reconectes.</span>
            <button type="button" onClick={() => set(i.id, "on")} style={btn(true)}>Reconectar</button>
          </div>
        ))}

        <section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2 style={h2s}>Conjunto por defecto</h2>
            <span style={{ fontSize: "13px", ...muted }}>La base que se propone a cada agente nuevo. Puedes cambiar integraciones sueltas después.</span>
          </div>
          <div role="radiogroup" aria-label="Conjunto por defecto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
            {[["google", "Google Workspace", "Gmail, Calendar, Drive"], ["microsoft", "Microsoft 365", "Outlook, OneDrive"], ["none", "Ninguno", "Eliges una a una"]].map(([id, t, d]) => (
              <button key={id} type="button" role="radio" aria-checked={suite === id} onClick={() => setSuite(id)} style={{ textAlign: "left", padding: "14px 16px", borderRadius: "12px", border: suite === id ? "1px solid #2457f5" : "1px solid #0000001a", background: suite === id ? "#e8edff" : "#ffffff", color: "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 500 }}>{t}</span><span style={muted}>{d}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", borderTop: "1px solid #0000000f", paddingTop: "14px" }}>
            <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>Nuevas acciones activadas por defecto</span><span style={{ fontSize: "13px", ...muted }}>Cuando una integración añade una acción, queda disponible sin revisión.</span></span>
            <Switch label="Nuevas acciones por defecto" on={newActions} onClick={() => setNewActions(!newActions)} />
          </div>
        </section>

        <h2 style={{ ...h2s, marginTop: "4px" }}>Conectadas · {connected.length}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {connected.map((i) => (
            <div key={i.id} style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: state[i.id] === "error" ? "inset 0 0 0 1px #a30042" : "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={`/logos/${i.logo}`} alt="" width="24" height="24" style={{ objectFit: "contain", borderRadius: "4px" }} /></span>
                {state[i.id] === "error"
                  ? <span style={{ padding: "2px 10px", borderRadius: "800px", background: "#fbe1ea", color: "#a30042", fontSize: "12px" }}>× Desconectada</span>
                  : <span style={{ padding: "2px 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px" }}>● Conectada</span>}
              </span>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>{i.name}</span>
              <span style={{ ...muted }}>{i.use}</span>
              <span style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#f7f7f8", fontSize: "13px", lineHeight: "19px" }}><span aria-hidden="true">⚡</span><span><span style={{ color: "#6b6b70" }}>El agente puede:</span> {i.actions}</span></span>
              <span style={{ fontSize: "12px", color: "#6b6b70" }}>La usa: {i.agents}</span>
              <span style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                {state[i.id] === "error"
                  ? <button type="button" onClick={() => set(i.id, "on")} style={btn(true)}>Reconectar</button>
                  : <><button data-demo="" type="button" style={btn(false)}>Permisos</button><button type="button" onClick={() => set(i.id, undefined)} style={btn(false)}>Desconectar</button></>}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
          <h2 style={h2s}>Disponibles · {ALL.length - connected.length}</h2>
          <a href="/es/integraciones" style={{ color: "#2457f5" }}>Ver las 121 integraciones →</a>
        </div>
        <div role="tablist" aria-label="Categorías" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} style={{ padding: "8px 14px", borderRadius: "800px", border: cat === c ? "1px solid #000000" : "1px solid #0000001a", background: cat === c ? "#000000" : "#ffffff", color: cat === c ? "#ffffff" : "#000000", font: "400 14px/18px var(--font-display)", cursor: "pointer" }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {available.map((i) => (
            <div key={i.id} style={{ background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={`/logos/${i.logo}`} alt="" width="26" height="26" style={{ objectFit: "contain", borderRadius: "4px", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>{i.name}</span><span style={{ fontSize: "12px", color: "#6b6b70", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.actions}</span></span>
              <button type="button" onClick={() => set(i.id, "on")} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>Conectar</button>
            </div>
          ))}
        </div>

        <section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", paddingBottom: "8px" }}><h2 style={h2s}>Plantillas de WhatsApp</h2><span style={{ color: "#6b6b70" }}>Meta revisa cada plantilla antes de poder usarla</span></div>
          {[["Recordatorio de cita 24 h", true], ["Factura disponible", true], ["Hueco libre para lista de espera", false]].map(([n, ok]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>{n}</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: ok ? "#dcebdd" : "#ffe8d6", color: ok ? "#004c39" : "#8e4e00", fontSize: "12px" }}>{ok ? "✓ Aprobada" : "En revisión"}</span></div>
          ))}
        </section>
      </main>
    </div>
  );
}
