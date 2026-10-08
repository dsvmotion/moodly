"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";

const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "14px" };
const sub = { fontSize: "13px", color: "#5f5f63" };
const field = { padding: "8px 12px", borderRadius: "10px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/20px var(--font-display)" };

function Switch({ on, onClick, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#004c39" : "#d9d9de", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}><span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }} /></button>;
}

export default function Preferencias() {
  const [theme, setTheme] = useState("system");
  const [feats, setFeats] = useState({ web: true, voz: true, resumen: false });
  return (
    <SettingsShell active="preferencias" title="Preferencias." intro="Tu experiencia en la plataforma.">
      <section style={card}>
        <h2 style={h2}>General</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...sub }}>Idioma<select defaultValue="es" style={field}><option value="es">Español</option><option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...sub }}>Modelo por defecto<select defaultValue="auto" style={field}><option value="auto">Automático (recomendado)</option><option>Anthropic · avanzado</option><option>OpenAI · rápido</option></select></label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={sub}>Tema</span>
          <div style={{ display: "flex", gap: "4px", padding: "4px", borderRadius: "800px", background: "#f2f2f4", maxWidth: "360px" }}>
            {[["system", "Sistema"], ["light", "Claro"], ["dark", "Oscuro"]].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)} style={{ flex: 1, padding: "8px", borderRadius: "800px", border: 0, background: theme === id ? "#ffffff" : "transparent", boxShadow: theme === id ? "0 1px 2px #0000001a" : "none", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
      </section>
      <section style={card}>
        <h2 style={h2}>Funciones</h2>
        {[["web", "Búsqueda web", "Los agentes pueden buscar información pública al responder."], ["voz", "Llamadas de voz", "Recepción atiende el teléfono con voz natural."], ["resumen", "Resumen diario por email", "Un correo cada mañana con lo que hicieron tus agentes."]].map(([k, t, d]) => (
          <div key={k} style={row}><span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontWeight: 500 }}>{t}</span><span style={sub}>{d}</span></span><Switch label={t} on={feats[k]} onClick={() => setFeats({ ...feats, [k]: !feats[k] })} /></div>
        ))}
      </section>
    </SettingsShell>
  );
}
