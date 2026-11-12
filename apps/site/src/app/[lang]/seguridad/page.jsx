"use client";
import LangLink from "@/components/lang-link";
import Link from "next/link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";
import { AvailabilityBadge } from "@/components/availability";
import { withContact } from "@/components/contact";

// Unidad de docs/scope.yaml de cada afirmación de seguridad (N-01; regla de V1 del 2026-11-11):
// lo del piloto, «En el piloto»; lo de después, «En hoja de ruta»; null = sin unidad: no se
// enseña. Mismo índice en los cuatro idiomas (si no, falla la compilación).
const UNITS = {
  certs: ["SE02", "SE12", "SE12", null],
  foundations: ["SE02", null, "SE13", "PL-T4"],
  deploy: ["PL-prod", "PL-cells", "PL-cells", null],
  arch: ["PL-T1", "SE05", "OA02", "PL-T5", "PL-T9", "SE04"],
  model: ["PL-T6", "OA24", "OA24"],
  gov: ["OA15", null, null, "SE03"],
};
for (const [lang, c] of Object.entries(COPY)) for (const [f, u] of Object.entries(UNITS)) {
  if (c[f].length !== u.length) throw new Error(`seguridad: ${lang}.${f} tiene ${c[f].length} y UNITS ${u.length}`);
}
const withUnits = (list, units) => list.map((x, i) => [x, units[i]]).filter(([, u]) => u !== null);

const FOUND_COLORS = [["#004c39", "#ffffff"], ["#ffffff", "#000000"], ["#9dbecc", "#000000"], ["#f6f2e8", "#000000"]];

export default function Seguridad() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  const Head = ({ a, b }) => (<h2 style={h2}>{a} <span style={muted}>{b}</span></h2>);
  return (
    <PageShell
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>{t.talk}</LangLink><a href="#documentos" style={pillBtn(false)}>{t.docs}</a></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {withUnits(t.certs, UNITS.certs).map(([[badge, title, d], unit]) => (
            <div key={title} style={{ ...card, display: "flex", flexDirection: "column", gap: "12px", minHeight: "220px" }}>
              <span aria-hidden="true" style={{ width: "56px", height: "56px", borderRadius: "800px", border: "1px solid #0000001a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>{badge}</span>
              <h3 style={h3}>{title}</h3>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</p>
              <span style={{ marginTop: "auto" }}><AvailabilityBadge id={unit} lang={lang} /></span>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a={t.foundA} b={t.foundB} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {withUnits(t.foundations, UNITS.foundations).map(([[title, d], unit], i) => {
              const [bg, fg] = FOUND_COLORS[i];
              return (<div key={i} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "240px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{title}</h3>
                <AvailabilityBadge id={unit} lang={lang} />
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.78 }}>{d}</p>
              </div>);
            })}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a={t.deployA} b={t.deployB} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {withUnits(t.deploy, UNITS.deploy).map(([[title, d, tier], unit], i) => (
              <div key={i} style={{ ...card, background: i === 0 ? "#e8edff" : "#ffffff", display: "flex", flexDirection: "column", gap: "10px", minHeight: "200px" }}>
                <h3 style={h3}>{title}</h3>
                <AvailabilityBadge id={unit} lang={lang} />
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</p>
                <span style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: i === 0 ? "#2457f5" : "#f2f2f4", color: i === 0 ? "#ffffff" : "#000000", fontSize: "12px" }}>{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a={t.archA} b={t.archB} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            {withUnits(t.arch, UNITS.arch).map(([[title, d], unit]) => (<div key={title} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{title}</span><AvailabilityBadge id={unit} lang={lang} /><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "32px" }}>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end" }}>
            <h2 style={{ ...h2, flex: "1 1 420px" }}>{t.modelA} <span style={{ opacity: 0.55 }}>{t.modelB}</span></h2>
            <LangLink href="/modelos" style={pillBtn(false)}>{t.seeModels}</LangLink>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {withUnits(t.model, UNITS.model).map(([[title, d], unit]) => (<div key={title} style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #ffffff33", paddingTop: "16px" }}><span style={{ fontSize: "17px", lineHeight: "24px" }}>{title}</span><AvailabilityBadge id={unit} lang={lang} /><span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a={t.govA} b={t.govB} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {withUnits(t.gov, UNITS.gov).map(([[title, d], unit]) => (<div key={title} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{title}</span><AvailabilityBadge id={unit} lang={lang} /><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section id="documentos" style={{ ...section, scrollMarginTop: "56px" }}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <Head a={t.docsA} b={t.docsB} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            {t.docLinks.map(([title, href]) => (<LangLink key={title} href={href} style={{ ...card, padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "16px", lineHeight: "22px" }}>{title}<span aria-hidden="true">→</span></LangLink>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.faqTitle}</h2>
          <div style={{ borderTop: "1px solid #0000001a" }}>
            {t.faq.map(([q, a]) => (
              <details key={q} style={{ borderBottom: "1px solid #0000001a", padding: "20px 0" }}>
                <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "18px", lineHeight: "27px" }}>{q}<span aria-hidden="true">+</span></summary>
                <p style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: "24px", maxWidth: "760px", ...muted }}>{withContact(a)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
