"use client";
import { useState } from "react";

// Flujo: aceptar una invitación (vista del invitado desde el email).
// TODO(backend): token de un solo uso con caducidad; al aceptar se crea
// public.users + membership (el alta por trigger SECURITY DEFINER requiere
// revisión humana). SSO/magic-link como alternativa a contraseña.
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "16px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer", width: "100%" };
const field = { padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "400 14px/20px var(--font-body)", color: "var(--ink)", width: "100%", boxSizing: "border-box" };

export default function Aceptar() {
  const [done, setDone] = useState(false);
  const expired = false; // estado alternativo: invitación caducada

  return (
    <main style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "24px" }}>
      <img src="/brand/moodly-logo-black.svg" alt="Moodly" width="92" height="24" style={{ display: "block" }} />

      {expired ? (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "20px", fontWeight: 400, letterSpacing: "-0.4px" }}>Invitación caducada</span>
          <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Este enlace ya no es válido. Pídele a quien te invitó que te mande uno nuevo.</span>
        </div>
      ) : done ? (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <span style={{ width: "48px", height: "48px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>✓</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "20px", fontWeight: 400, letterSpacing: "-0.4px" }}>¡Dentro!</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Ya formas parte de Clínica Dental Sol como Recepción.</span></div>
          <a href="/plataforma" style={btnDark}>Ir al panel</a>
        </div>
      ) : (
        <div style={{ ...box, width: "100%", maxWidth: "440px", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "800px", background: "#004c39", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, flex: "none" }}>DS</span>
            <span style={{ fontSize: "14px", lineHeight: "20px" }}><strong style={{ fontWeight: 500 }}>Marta Ruiz</strong> te ha invitado a<br /><strong style={{ fontWeight: 500 }}>Clínica Dental Sol</strong> como <span style={{ padding: "1px 8px", borderRadius: "800px", background: "var(--sunken)", fontSize: "12px" }}>Recepción</span></span>
          </div>

          <button type="button" onClick={() => setDone(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "500 14px/14px var(--font-display)", cursor: "pointer" }}><img src="/logos/google.svg" alt="" width="18" height="18" />Continuar con Google</button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--muted-4)", fontSize: "12px" }}><span style={{ flex: 1, height: "1px", background: "var(--line)" }} />o con tu email<span style={{ flex: 1, height: "1px", background: "var(--line)" }} /></div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Tu nombre<input defaultValue="Carmen López" style={field} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Email<input defaultValue="carmen@clinicadentalsol.es" readOnly style={{ ...field, background: "var(--paper-2b)", color: "var(--muted-2)" }} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>Crea una contraseña<input type="password" placeholder="Mínimo 8 caracteres" style={field} /></label>
          </div>

          <button type="button" onClick={() => setDone(true)} style={btnDark}>Aceptar y entrar</button>
          <span style={{ fontSize: "12px", lineHeight: "18px", textAlign: "center", ...muted }}>Al aceptar, aceptas los términos y la política de privacidad de Moodly.</span>
        </div>
      )}
    </main>
  );
}
