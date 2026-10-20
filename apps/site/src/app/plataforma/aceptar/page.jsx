"use client";
import { useState } from "react";

// Flujo: aceptar una invitación (vista del invitado desde el email).
// TODO(backend): token de un solo uso con caducidad; al aceptar se crea
// public.users + membership (el alta por trigger SECURITY DEFINER requiere
// revisión humana). SSO/magic-link como alternativa a contraseña.
const box = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "16px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer", width: "100%" };
const field = { padding: "12px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000", width: "100%", boxSizing: "border-box" };

export default function Aceptar() {
  const [done, setDone] = useState(false);
  const expired = false; // estado alternativo: invitación caducada

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "24px" }}>
      <img src="/brand/moodly-logo-black.svg" alt="Moodly" width="92" height="24" style={{ display: "block" }} />

      {expired ? (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "20px", fontWeight: 400, letterSpacing: "-0.4px" }}>Invitación caducada</span>
          <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Este enlace ya no es válido. Pídele a quien te invitó que te mande uno nuevo.</span>
        </div>
      ) : done ? (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <span style={{ width: "48px", height: "48px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>✓</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "20px", fontWeight: 400, letterSpacing: "-0.4px" }}>¡Dentro!</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Ya formas parte de Clínica Dental Sol como Recepción.</span></div>
          <a href="/plataforma" style={btnDark}>Ir al panel</a>
        </div>
      ) : (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#004c39", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, flex: "none" }}>DS</span>
            <span style={{ fontSize: "14px", lineHeight: "20px" }}><strong style={{ fontWeight: 500 }}>Marta Ruiz</strong> te ha invitado a<br /><strong style={{ fontWeight: 500 }}>Clínica Dental Sol</strong> como <span style={{ padding: "1px 8px", borderRadius: "800px", background: "#ebebed", fontSize: "12px" }}>Recepción</span></span>
          </div>

          <button type="button" onClick={() => setDone(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}><img src="/logos/google.svg" alt="" width="18" height="18" />Continuar con Google</button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#9b9ba1", fontSize: "12px" }}><span style={{ flex: 1, height: "1px", background: "#0000001a" }} />o con tu email<span style={{ flex: 1, height: "1px", background: "#0000001a" }} /></div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Tu nombre<input defaultValue="Carmen López" style={field} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Email<input defaultValue="carmen@clinicadentalsol.es" readOnly style={{ ...field, background: "#f7f7f8", color: "#6b6b70" }} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Crea una contraseña<input type="password" placeholder="Mínimo 8 caracteres" style={field} /></label>
          </div>

          <button type="button" onClick={() => setDone(true)} style={btnDark}>Aceptar y entrar</button>
          <span style={{ fontSize: "12px", lineHeight: "18px", textAlign: "center", ...muted }}>Al aceptar, aceptas los términos y la política de privacidad de Moodly.</span>
        </div>
      )}
    </div>
  );
}
