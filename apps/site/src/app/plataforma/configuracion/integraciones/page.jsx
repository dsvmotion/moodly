"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";

// Integraciones con estado local (prototipo). TODO(backend): OAuth real y estado en `integrations`.
const ALL = [
  { id: "whatsapp", name: "WhatsApp Business", logo: "whatsapp.svg", use: "Recepción y Atención · número +34 600 000 000", agents: "Recepción, Atención" },
  { id: "gcal", name: "Google Calendar", logo: "googlecalendar.svg", use: "Agenda de las 3 profesionales", agents: "Recepción" },
  { id: "gmail", name: "Gmail", logo: "gmail.svg", use: "info@clinicadentalsol.es", agents: "Atención" },
  { id: "holded", name: "Holded", logo: "holded.png", use: "Facturas y cobros", agents: "Administración" },
  { id: "twilio", name: "Teléfono (Twilio)", logo: "twilio.svg", use: "Línea +34 910 000 000", agents: "Recepción" },
  { id: "instagram", name: "Instagram", logo: "instagram.svg", use: "Mensajes directos", agents: "Atención" },
  { id: "outlook", name: "Outlook / Microsoft 365", logo: "microsoftoutlook.svg", use: "Email y calendario", agents: "Recepción, Atención" },
  { id: "maps", name: "Google Reviews", logo: "googlemaps.svg", use: "Reseñas de tu ficha", agents: "Atención" },
  { id: "hubspot", name: "HubSpot", logo: "hubspot.svg", use: "Contactos y presupuestos", agents: "Comercial" },
  { id: "doctoralia", name: "Doctoralia", logo: "doctoralia.png", use: "Citas de pacientes [vía partner]", agents: "Recepción" },
  { id: "drive", name: "Google Drive", logo: "googledrive.svg", use: "Protocolos y tarifas", agents: "Todos" },
];
const INITIAL = { whatsapp: "on", gcal: "error", gmail: "on", holded: "on", twilio: "on" };

const btn = (dark) => ({ padding: "8px 14px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer" });

export default function Integraciones() {
  const [state, setState] = useState(INITIAL);
  const set = (id, v) => setState((s) => ({ ...s, [id]: v }));
  const connected = ALL.filter((i) => state[i.id]);
  const available = ALL.filter((i) => !state[i.id]);
  const broken = ALL.filter((i) => state[i.id] === "error");

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="integraciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px", maxWidth: "720px" }}>Integraciones. <span style={{ color: "#5f5f63" }}>Las herramientas donde trabajan tus agentes.</span></h1>

        {broken.map((i) => (
          <div key={i.id} role="alert" style={{ borderRadius: "12px", background: "#fbe1ea", color: "#a30042", padding: "14px 20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 320px" }}><strong style={{ fontWeight: 500 }}>× {i.name} se ha desconectado.</strong> {i.agents} no puede usarla hasta que la reconectes.</span>
            <button type="button" onClick={() => set(i.id, "on")} style={btn(true)}>Reconectar</button>
          </div>
        ))}

        <h2 style={{ margin: "4px 0 0", fontSize: "18px", lineHeight: "19.8px", fontWeight: 400, letterSpacing: "-0.36px" }}>Conectadas · {connected.length}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
          {connected.map((i) => (
            <div key={i.id} style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: state[i.id] === "error" ? "inset 0 0 0 1px #a30042" : "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={`/logos/${i.logo}`} alt="" width="24" height="24" style={{ objectFit: "contain", borderRadius: "4px" }} /></span>
                {state[i.id] === "error"
                  ? <span style={{ padding: "2px 10px", borderRadius: "800px", background: "#fbe1ea", color: "#a30042", fontSize: "12px" }}>× Desconectada</span>
                  : <span style={{ padding: "2px 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px" }}>● Conectada</span>}
              </span>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>{i.name}</span>
              <span style={{ color: "#5f5f63" }}>{i.use}</span>
              <span style={{ fontSize: "12px", color: "#6b6b70" }}>La usa: {i.agents}</span>
              <span style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                {state[i.id] === "error"
                  ? <button type="button" onClick={() => set(i.id, "on")} style={btn(true)}>Reconectar</button>
                  : <button type="button" onClick={() => set(i.id, undefined)} style={btn(false)}>Desconectar</button>}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", lineHeight: "19.8px", fontWeight: 400, letterSpacing: "-0.36px" }}>Disponibles</h2>
          <a href="/es/integraciones" style={{ color: "#2457f5" }}>Ver las 121 integraciones →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {available.map((i) => (
            <div key={i.id} style={{ background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={`/logos/${i.logo}`} alt="" width="24" height="24" style={{ objectFit: "contain", borderRadius: "4px", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}>{i.name}</span>
              <button type="button" onClick={() => set(i.id, "on")} style={btn(false)}>Conectar</button>
            </div>
          ))}
        </div>

        <section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", paddingBottom: "8px" }}><h2 style={{ margin: 0, fontSize: "18px", lineHeight: "19.8px", fontWeight: 400, letterSpacing: "-0.36px" }}>Plantillas de WhatsApp</h2><span style={{ color: "#6b6b70" }}>Meta revisa cada plantilla antes de poder usarla</span></div>
          {[["Recordatorio de cita 24 h", true], ["Factura disponible", true], ["Hueco libre para lista de espera", false]].map(([n, ok]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>{n}</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: ok ? "#dcebdd" : "#ffe8d6", color: ok ? "#004c39" : "#8e4e00", fontSize: "12px" }}>{ok ? "✓ Aprobada" : "En revisión"}</span></div>
          ))}
        </section>
      </main>
    </div>
  );
}
