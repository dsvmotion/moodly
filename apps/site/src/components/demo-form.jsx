"use client";
import { useState } from "react";
import { FORM_TEXT, mailtoContact, withContact } from "./contact";
import { useLang } from "./use-lang";

// Formulario de demo. Sin endpoint de leads todavía (llega en M1): un email válido abre
// el programa de correo con la petición escrita y la web lo dice (N-02, ver contact.js).
export default function DemoForm({ placeholder = "Tu email de trabajo", button = "Pedir demo", id = "demo-email" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const t = FORM_TEXT[useLang()] || FORM_TEXT.es;

  const submit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t.invalidEmail); return; }
    setError(""); setSent(true);
    window.location.href = mailtoContact(t.demoSubject, t.demoBody + email);
  };

  if (sent) {
    return (
      <div role="status" data-form-status="opened-mail" style={{ width: "100%", maxWidth: "512px", minHeight: "54px", boxSizing: "border-box", borderRadius: "16px", background: "#e8edff", color: "#1d3a9e", display: "flex", alignItems: "center", padding: "12px 20px", fontSize: "14px", lineHeight: "21px", textAlign: "left" }}>
        {withContact(t.opened)}
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate style={{ width: "100%", maxWidth: "512px", minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#ffffff", border: `1px solid ${error ? "#a30042" : "#0000001a"}`, borderRadius: "800px", padding: "6px 6px 6px 20px", minHeight: "56px", boxSizing: "border-box" }}>
        <label htmlFor={id} style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Email de trabajo</label>
        <input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} aria-invalid={!!error} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "400 15px/20px var(--font-display)", color: "#000000" }} />
        <button type="submit" style={{ padding: "12px 20px", borderRadius: "800px", border: 0, background: "#000000", color: "#ffffff", font: "500 14px/20px var(--font-display)", cursor: "pointer", whiteSpace: "nowrap" }}>{button}</button>
      </div>
      {error && <span role="alert" style={{ fontSize: "13px", color: "#a30042", paddingLeft: "20px", textAlign: "left" }}>{error}</span>}
    </form>
  );
}
