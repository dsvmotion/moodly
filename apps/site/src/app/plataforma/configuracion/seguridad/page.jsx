"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";

const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const sub = { fontSize: "13px", color: "#5f5f63" };
const btn = { padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/20px var(--font-display)", cursor: "pointer" };
const field = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "10px", border: "1px solid #0000001a", background: "#f7f7f8", font: "400 13px/18px var(--font-mono)", color: "#5f5f63" };
const ent = { padding: "2px 10px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "12px", lineHeight: "18px" };

function Switch({ on, onClick, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#004c39" : "#d9d9de", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}><span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }} /></button>;
}

export default function Seguridad() {
  const [sso, setSso] = useState(false);
  const [scim, setScim] = useState(false);
  return (
    <SettingsShell active="seguridad" title="Seguridad y acceso." intro="Cómo entra tu equipo y desde dónde.">
      <section style={card}>
        <h2 style={h2}>Verificación en dos pasos</h2>
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}><span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontWeight: 500 }}>Exigir 2FA a todo el equipo</span><span style={sub}>Cada persona usará un código de su app de autenticación.</span></span><input type="checkbox" style={{ width: "18px", height: "18px", accentColor: "#000000" }} /></label>
      </section>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}><h2 style={h2}>Inicio de sesión único (SSO)</h2><span style={ent}>Enterprise</span></div>
        <span style={sub}>SAML con Google Workspace o Microsoft Entra ID. Necesitas un dominio verificado.</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}><span>Activar SAML SSO</span><Switch label="SAML SSO" on={sso} onClick={() => setSso(!sso)} /></div>
        {sso && (<><label style={{ display: "flex", flexDirection: "column", gap: "6px", ...sub }}>URL de inicio de sesión (IdP)<input placeholder="https://idp.tuempresa.com/sso" style={{ ...field, background: "#ffffff", color: "#000000" }} /></label><label style={{ display: "flex", flexDirection: "column", gap: "6px", ...sub }}>ACS URL (cópiala en tu IdP)<input readOnly value="https://app.moodly.ai/sso/acs/[org]" style={field} /></label></>)}
      </section>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}><h2 style={h2}>Altas y bajas automáticas (SCIM)</h2><span style={ent}>Enterprise</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}><span>Sincronizar usuarios desde tu directorio</span><Switch label="SCIM" on={scim} onClick={() => setScim(!scim)} /></div>
        {scim && (<label style={{ display: "flex", flexDirection: "column", gap: "6px", ...sub }}>Token SCIM<span style={{ display: "flex", gap: "8px" }}><input readOnly value="scim_•••• (se muestra una sola vez)" style={field} /><button type="button" data-demo="" style={btn}>Generar</button></span></label>)}
      </section>
      <section style={card}>
        <h2 style={h2}>Acceso por red</h2>
        <span style={sub}>Limita el acceso a rangos de IP. Vacío = sin restricción.</span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><input placeholder="p. ej. 80.25.0.0/16" style={{ ...field, background: "#ffffff", color: "#000000", maxWidth: "260px" }} /><button type="button" data-demo="" style={btn}>Añadir rango</button></div>
      </section>
      <section style={{ ...card, border: "1px solid #a3004233" }}>
        <h2 style={h2}>Zona delicada</h2>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center" }}><span style={sub}>Cerrar la sesión de todas las personas del espacio.</span><button type="button" data-demo="" style={{ ...btn, color: "#a30042" }}>Cerrar todas las sesiones</button></div>
      </section>
    </SettingsShell>
  );
}
