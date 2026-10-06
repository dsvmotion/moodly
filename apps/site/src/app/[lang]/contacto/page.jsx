import PageShell, { card, muted, section, wrap } from "@/components/page-shell";
import ContactForm from "@/components/contact-form";

export const metadata = { title: "Contacto · Moodly AI" };

const CHANNELS = [
  ["Ventas", "[ventas@moodly.ai]", "Demos, precios e implantación."],
  ["Soporte", "[soporte@moodly.ai]", "Para clientes. Respuesta en horario laboral."],
  ["Privacidad", "[privacidad@moodly.ai]", "Ejercicio de derechos y DPA."],
  ["Seguridad", "[security@moodly.ai]", "Comunicación responsable de vulnerabilidades."],
];

export default function Contacto() {
  return (
    <PageShell eyebrow="Contacto" title="Hablemos de tu negocio" intro="Cuéntanos qué te gustaría automatizar y te enseñamos los agentes con tu caso en una demo de 30 minutos.">
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ ...wrap, display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ ...card, flex: "2 1 520px", minWidth: 0, padding: "clamp(24px, 4vw, 40px)" }}><ContactForm /></div>
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {CHANNELS.map(([t, mail, d]) => (
              <div key={t} style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "13px", ...muted }}>{t}</span>
                <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{mail}</span>
                <span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>{d}</span>
              </div>
            ))}
            <div style={{ ...card, padding: "20px", background: "#e8edff", border: 0, fontSize: "14px", lineHeight: "21px" }}>[Dirección de la oficina] · Atención de lunes a viernes, 9:00–18:00 (CET).</div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
