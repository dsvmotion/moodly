"use client";
import LangLink from "@/components/lang-link";
import { useState } from "react";

// Formulario de contacto. TODO(backend): enviar a un endpoint de leads (Supabase o CRM).
const TOPICS = ["Pedir una demo", "Precios e implantación", "Enterprise / multisede", "Soporte", "Prensa o colaboración"];
const SIZES = ["1–10 personas", "11–50", "51–250", "Más de 250"];
const field = { width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: "10px", border: "1px solid #0000001a", background: "#ffffff", font: "400 15px/22px var(--font-display)", color: "#000000" };
const label = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "20px", minWidth: 0 };

export default function ContactForm() {
  const [data, setData] = useState({ name: "", email: "", company: "", size: SIZES[0], topic: TOPICS[0], message: "", consent: false });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setData({ ...data, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!data.name.trim()) next.name = "Escribe tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) next.email = "Escribe un email válido.";
    if (!data.consent) next.consent = "Necesitamos tu permiso para responderte.";
    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  if (sent) {
    return (
      <div role="status" style={{ borderRadius: "12px", background: "#dcebdd", color: "#004c39", padding: "32px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <strong style={{ fontSize: "20px", lineHeight: "26px", fontWeight: 500 }}>Gracias, {data.name.split(" ")[0]}.</strong>
        <span style={{ fontSize: "16px", lineHeight: "24px" }}>Te escribimos a {data.email} en menos de 24 horas laborables.</span>
      </div>
    );
  }
  const err = (k) => errors[k] && <span role="alert" style={{ color: "#a30042", fontSize: "13px" }}>{errors[k]}</span>;
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
      <label style={label}>Nombre<input value={data.name} onChange={set("name")} autoComplete="name" aria-invalid={!!errors.name} style={field} />{err("name")}</label>
      <label style={label}>Email de trabajo<input type="email" value={data.email} onChange={set("email")} autoComplete="email" aria-invalid={!!errors.email} style={field} />{err("email")}</label>
      <label style={label}>Empresa<input value={data.company} onChange={set("company")} autoComplete="organization" style={field} /></label>
      <label style={label}>Tamaño del equipo<select value={data.size} onChange={set("size")} style={field}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label style={{ ...label, gridColumn: "1 / -1" }}>¿En qué podemos ayudarte?<select value={data.topic} onChange={set("topic")} style={field}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label style={{ ...label, gridColumn: "1 / -1" }}>Mensaje (opcional)<textarea value={data.message} onChange={set("message")} rows={4} placeholder="Cuéntanos tu negocio, cuántas sedes tienes y qué te gustaría automatizar." style={{ ...field, resize: "vertical" }} /></label>
      <label style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14px", lineHeight: "20px", color: "#5f5f63" }}>
        <input type="checkbox" checked={data.consent} onChange={set("consent")} style={{ marginTop: "3px" }} />
        <span>Acepto que Moodly use estos datos para responder a mi solicitud, según la <LangLink href="/privacidad" style={{ textDecoration: "underline" }}>política de privacidad</LangLink>.{err("consent") && <><br />{err("consent")}</>}</span>
      </label>
      <button type="submit" style={{ gridColumn: "1 / -1", justifySelf: "start", padding: "13px 24px", borderRadius: "800px", border: 0, background: "#000000", color: "#ffffff", font: "500 15px/20px var(--font-display)", cursor: "pointer" }}>Enviar</button>
    </form>
  );
}
