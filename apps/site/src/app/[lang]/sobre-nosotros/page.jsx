import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import Link from "next/link";
import { AGENTS } from "@/components/site-data";

export const metadata = { title: "Sobre nosotros · Moodly AI" };

const VALUES = [
  ["Útil desde el primer día", "Agentes listos para usar, no proyectos de IA eternos. Implantación en semanas y precio cerrado.", "#004c39", "#ffffff"],
  ["Tú decides", "Reglas, límites y aprobaciones. La IA propone; tu equipo decide en lo que importa.", "#ffffff", "#000000"],
  ["Datos en casa", "Diseñado para el RGPD, sin entrenar modelos con tus datos y con la opción de usar tu propia nube.", "#9dbecc", "#000000"],
  ["Cerca del negocio", "Hablamos de citas, reservas y facturas, no de tokens. Formación y soporte en español.", "#ffbab5", "#000000"],
];

export default function SobreNosotros() {
  return (
    <PageShell
      eyebrow="Sobre nosotros"
      title="Llevamos la IA a los negocios que hacen funcionar el día a día"
      intro="Clínicas, restaurantes, gestorías, inmobiliarias y agencias pierden horas en llamadas, mensajes y papeles. Construimos agentes que se encargan de ese trabajo para que tu equipo pueda atender mejor."
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>Contactar</LangLink><LangLink href="/agentes" style={pillBtn(false)}>Conocer los agentes</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "48px", flexWrap: "wrap" }}>
          <h2 style={{ ...h2, flex: "1 1 360px" }}>Por qué existe Moodly. <span style={muted}>La IA ya funciona; lo difícil es que llegue a una pyme.</span></h2>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "17px", lineHeight: "27px" }}>
            <p style={{ margin: 0 }}>Las grandes empresas tienen equipos para montar asistentes, conectar sistemas y vigilar riesgos. Un negocio de diez personas, no.</p>
            <p style={{ margin: 0, ...muted }}>Moodly empaqueta ese trabajo: cuatro agentes con experiencia en cada sector, conectados a las herramientas que ya usas y con el control en manos de tu equipo. [Historia de los fundadores por completar].</p>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>En qué creemos</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {VALUES.map(([t, d, bg, fg]) => (
              <div key={t} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "240px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t}</h3>
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.78 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>El equipo. <span style={muted}>Producto, IA y operaciones de negocio.</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {AGENTS.map((a, i) => (
              <div key={a.name} style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span aria-hidden="true" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: "8px", background: a.color, opacity: 0.9 }} />
                <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>[Nombre {i + 1}]</span>
                <span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>[Cargo]</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ ...h2, flex: "1 1 420px" }}>¿Quieres trabajar con nosotros? <span style={{ opacity: 0.55 }}>Buscamos personas que disfruten resolviendo problemas reales de negocio.</span></h2>
          <LangLink href="/contacto" style={pillBtn(false)}>Escríbenos</LangLink>
        </div>
      </section>
    </PageShell>
  );
}
