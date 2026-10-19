"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";

// Perfil del usuario (prototipo con estado local). TODO(backend): leer/guardar en `profiles` y Supabase Auth.
const NOTIFS = [
  ["approvals", "Tareas que esperan tu aprobación", "Inmediato"],
  ["urgent", "Urgencias y quejas de clientes", "Inmediato"],
  ["daily", "Resumen diario de los agentes", "Cada día a las 8:00"],
  ["coach", "Propuestas del modo coach", "Semanal"],
  ["billing", "Plan, consumo y facturas", "Cuando haya novedades"],
];
const CHANNELS = ["App", "Email", "WhatsApp"];
const field = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/20px var(--font-display)", color: "var(--ink)" };
const label = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)", minWidth: 0 };
const box = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };

export default function Perfil() {
  const [data, setData] = useState({ name: "Marta Ruiz", email: "marta@clinicadentalsol.es", phone: "+34 600 000 000", lang: "es", tz: "Europe/Madrid" });
  const [notif, setNotif] = useState({ approvals: ["App", "WhatsApp"], urgent: ["App", "WhatsApp"], daily: ["Email"], coach: ["Email"], billing: ["Email"] });
  const [twofa, setTwofa] = useState(true);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setData({ ...data, [k]: e.target.value }); setSaved(false); };
  const toggle = (k, c) => { const cur = notif[k]; setNotif({ ...notif, [k]: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] }); setSaved(false); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="perfil" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px" }}>Mi perfil. <span style={{ color: "var(--muted)" }}>Tus datos, avisos y seguridad.</span></h1>
          <button type="button" onClick={() => setSaved(true)} style={{ padding: "11px 18px", borderRadius: "800px", border: 0, background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)", cursor: "pointer" }}>{saved ? "✓ Guardado" : "Guardar cambios"}</button>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "2 1 420px" }}>
            <h2 style={h2}>Datos personales</h2>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span style={{ width: "56px", height: "56px", borderRadius: "800px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 500 }}>MR</span>
              <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>Dueña · todas las sedes</span><span style={{ color: "var(--muted)" }}>El rol lo cambia otra persona con rol de dueño, en Equipo y roles.</span></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <label style={label}>Nombre<input value={data.name} onChange={set("name")} autoComplete="name" style={field} /></label>
              <label style={label}>Email<input type="email" value={data.email} onChange={set("email")} autoComplete="email" style={field} /></label>
              <label style={label}>Teléfono para avisos<input value={data.phone} onChange={set("phone")} autoComplete="tel" style={field} /></label>
              <label style={label}>Idioma de la plataforma
                <select value={data.lang} onChange={set("lang")} style={field}><option value="es">Español</option><option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option></select>
              </label>
              <label style={label}>Zona horaria
                <select value={data.tz} onChange={set("tz")} style={field}><option value="Europe/Madrid">Madrid (CET)</option><option value="Atlantic/Canary">Canarias (WET)</option><option value="Europe/Paris">París (CET)</option><option value="Europe/Berlin">Berlín (CET)</option></select>
              </label>
            </div>
          </section>

          <section style={{ ...box, flex: "1 1 300px" }}>
            <h2 style={h2}>Seguridad</h2>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <span><span style={{ display: "block", fontWeight: 500 }}>Verificación en dos pasos</span><span style={{ color: "var(--muted)" }}>Código en tu app de autenticación.</span></span>
              <button type="button" role="switch" aria-checked={twofa} aria-label="Verificación en dos pasos" onClick={() => setTwofa(!twofa)} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: twofa ? "#004c39" : "var(--track-2)", cursor: "pointer", display: "flex", justifyContent: twofa ? "flex-end" : "flex-start" }}><span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)" }} /></button>
            </div>
            <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontWeight: 500 }}>Sesiones abiertas</span>
              <span style={{ display: "flex", justifyContent: "space-between" }}><span>MacBook · Madrid</span><span style={{ color: "var(--green-fg)" }}>Esta sesión</span></span>
              <span style={{ display: "flex", justifyContent: "space-between" }}><span>iPhone · app Moodly</span><span style={{ color: "var(--muted)" }}>hace 2 h</span></span>
              <button type="button" data-demo="" style={{ alignSelf: "flex-start", marginTop: "4px", padding: "8px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--rose-fg)", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>Cerrar las demás sesiones</button>
            </div>
          </section>
        </div>

        <section style={{ ...box, padding: 0, gap: 0, overflowX: "auto" }}>
          <div style={{ padding: "20px 24px" }}><h2 style={h2}>Avisos</h2></div>
          <table style={{ width: "100%", minWidth: "620px", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th style={{ padding: "12px 24px", fontWeight: 500 }}>Qué</th><th style={{ padding: "12px", fontWeight: 500 }}>Cuándo</th>{CHANNELS.map((c) => <th key={c} style={{ padding: "12px", fontWeight: 500, textAlign: "center" }}>{c}</th>)}</tr></thead>
            <tbody>
              {NOTIFS.map(([k, what, when]) => (
                <tr key={k} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "12px 24px" }}>{what}</td>
                  <td style={{ padding: "12px", color: "var(--muted)" }}>{when}</td>
                  {CHANNELS.map((c) => (<td key={c} style={{ padding: "12px", textAlign: "center" }}><input type="checkbox" aria-label={`${what} por ${c}`} checked={notif[k].includes(c)} onChange={() => toggle(k, c)} style={{ width: "18px", height: "18px", accentColor: "var(--ink)" }} /></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ ...box, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <span><span style={{ display: "block", fontWeight: 500 }}>Tus datos</span><span style={{ color: "var(--muted)" }}>Descarga todo lo que Moodly guarda sobre ti o elimina tu usuario.</span></span>
          <span style={{ display: "flex", gap: "8px" }}>
            <button type="button" data-demo="" style={{ padding: "9px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>Exportar mis datos</button>
            <button type="button" data-demo="" style={{ padding: "9px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--rose-fg)", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>Eliminar mi usuario</button>
          </span>
        </section>
      </main>
    </div>
  );
}
