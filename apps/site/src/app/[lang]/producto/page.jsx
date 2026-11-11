import PageShell, { h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import LangLink from "@/components/lang-link";
import { BrowserFrame } from "@/components/screen-frame";
import { COPY } from "./copy";
import { AvailabilityBadge } from "@/components/availability";

// Unidad de docs/scope.yaml de cada pieza, por índice de `areas` (N-01): bandeja, aprobaciones,
// controles del agente y resultado frente a coste.
const AREA_UNITS = ["OA01", "OA02", "OA05", "OA13"];

const SHOTS = ["conversaciones", "aprobaciones", "reglas", "informes"];
const pick = async (params) => COPY[(await params).lang] || COPY.es;

export async function generateMetadata({ params }) {
  return { title: (await pick(params)).meta };
}

export default async function Producto({ params }) {
  const c = await pick(params);
  const { lang } = await params;
  return (
    <PageShell
      eyebrow={c.eyebrow}
      title={c.title}
      intro={c.intro}
      actions={<><LangLink href="/#demo" style={pillBtn(true)}>{c.demo}</LangLink><LangLink href="/app-movil" style={pillBtn(false)}>{c.mobile}</LangLink></>}
    >
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={wrap}><BrowserFrame src="/shots/v2/inicio.png" alt={c.heroAlt} priority /></div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "clamp(64px, 8vw, 112px)" }}>
          <h2 style={h2}>{c.piecesA} <span style={muted}>{c.piecesB}</span></h2>
          {c.areas.map(([title, text], i) => (
            <div key={SHOTS[i]} style={{ display: "flex", gap: "clamp(24px, 4vw, 56px)", flexWrap: "wrap", alignItems: "center", flexDirection: i % 2 ? "row-reverse" : "row" }}>
              <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "13px", ...muted }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.5px" }}>{title}</h3>
                <AvailabilityBadge id={AREA_UNITS[i]} lang={lang} />
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", ...muted }}>{text}</p>
              </div>
              <div style={{ flex: "2 1 520px", minWidth: 0 }}><BrowserFrame src={`/shots/v2/${SHOTS[i]}.png`} alt={title} /></div>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "clamp(24px, 4vw, 56px)", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <h2 style={h2}>{c.startA} <span style={muted}>{c.startB}</span></h2>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
              {c.steps.map(([t, d], i) => (
                <li key={t} style={{ display: "flex", gap: "16px", padding: "18px 0", borderTop: "1px solid #0000001a" }}>
                  <span style={{ flex: "none", width: "28px", height: "28px", borderRadius: "800px", background: "#000000", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>{i + 1}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "17px", lineHeight: "24px" }}>{t}</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></span>
                </li>
              ))}
            </ol>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{c.duration} <LangLink href="/precios" style={{ textDecoration: "underline" }}>{c.pricing}</LangLink></span>
          </div>
          <div style={{ flex: "1.4 1 480px", minWidth: 0 }}><BrowserFrame src="/shots/v2/onboarding.png" alt={c.onbAlt} /></div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ ...h2, flex: "1 1 420px" }}>{c.ctaA} <span style={{ opacity: 0.55 }}>{c.ctaB}</span></h2>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <LangLink href="/#demo" style={pillBtn(false)}>{c.demo}</LangLink>
            <a href="/plataforma" rel="nofollow" style={{ ...pillBtn(false), background: "transparent", color: "#ffffff", border: "1px solid #ffffff4d" }}>{c.tryDemo}</a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
