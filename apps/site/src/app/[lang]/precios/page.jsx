"use client";
import LangLink from "@/components/lang-link";
import PageShell, { card, h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

// /precios (MANUAL §15.1 y §15.2): prueba con tarjeta y crédito de IA, tres
// formas de seguir pagando la IA que se usa, y Enterprise con implantación y
// contrato. Estructura de la página de precios de Langdock; los importes de los
// planes siguen abiertos y la página lo dice.

const li = { margin: 0, padding: "16px 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" };
const badge = (txt) => <span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>{txt}</span>;

function Plan({ plan, recommended }) {
  return (
    <div style={{ ...card, border: plan.highlight ? "1px solid #2457f5" : card.border, display: "flex", flexDirection: "column", gap: "14px" }} data-testid="plan">
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "20px", lineHeight: "24px" }}>{plan.name}</span>
        {plan.highlight ? badge(recommended) : null}
      </span>
      <span style={{ fontSize: "30px", lineHeight: "36px", letterSpacing: "-0.04em" }}>{plan.price}</span>
      <span style={{ fontSize: "14px", lineHeight: "21px" }}>{plan.sub}</span>
      <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{plan.desc}</span>
      <LangLink href="/contacto" style={{ ...pillBtn(Boolean(plan.highlight)), alignSelf: "stretch", marginTop: "auto" }}>{plan.cta}</LangLink>
      <ul style={{ ...li, borderTop: "1px solid #0000000f" }}>{plan.list.map((x) => (<li key={x}>✓ {x}</li>))}</ul>
    </div>
  );
}

export default function Precios() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;

  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={h2}>{t.plansTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px" }}>
            {t.plans.map((plan) => (<Plan key={plan.name} plan={plan} recommended={t.recommended} />))}
          </div>
          <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }} data-testid="amounts-note">{t.amountsNote}</span>

          <div style={{ ...card, background: "#000000", color: "#ffffff", border: 0, display: "flex", flexWrap: "wrap", gap: "24px 48px", alignItems: "flex-start" }} data-testid="plan-enterprise">
            <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontSize: "20px", lineHeight: "24px" }}>{t.ent.name}</span>
              <span style={{ fontSize: "30px", lineHeight: "36px", letterSpacing: "-0.04em" }}>{t.ent.price}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px" }}>{t.ent.sub}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>{t.ent.desc}</span>
              <LangLink href="/enterprise" style={{ ...pillBtn(false), alignSelf: "flex-start" }}>{t.ent.cta}</LangLink>
            </div>
            <ul style={{ ...li, flex: "1 1 280px", padding: 0 }}>{t.ent.list.map((x) => (<li key={x}>✓ {x}</li>))}</ul>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.afterA} <span style={muted}>{t.afterB}</span></h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "32px" }}>
            {t.after.map(([title, d], i) => (
              <li key={title} style={{ borderTop: "1px solid #000000", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ font: "400 13px/20px var(--font-mono)", color: "#6b6b70" }}>0{i + 1}</span>
                <span style={{ fontSize: "18px", lineHeight: "22px", letterSpacing: "-0.36px" }}>{title}</span>
                <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.visibleA} <span style={muted}>{t.visibleB}</span></h2>
          <ul style={{ ...card, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px 32px", listStyle: "none", fontSize: "15px", lineHeight: "22px" }}>
            {t.visible.map((x) => (<li key={x}>✓ {x}</li>))}
          </ul>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.implA} <span style={muted}>{t.implB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {t.implementation.map(([fit, name, price, text], i) => (
              <div key={name} style={{ ...card, background: i === 0 ? "#dcebdd" : "#ffffff", border: i === 0 ? 0 : card.border, display: "flex", flexDirection: "column", gap: "10px", minHeight: "230px" }}>
                <span style={{ fontSize: "13px", ...muted }}>{fit}</span>
                <span style={{ fontSize: "20px", lineHeight: "24px" }}>{name}</span>
                <span style={{ fontSize: "28px", lineHeight: "32px", fontWeight: 100, letterSpacing: "-0.03em" }}>{price}</span>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", ...muted }}>{text}</p>
              </div>
            ))}
          </div>
          <LangLink href="/contacto" style={{ ...pillBtn(true), alignSelf: "flex-start" }}>{t.implCta}</LangLink>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.addA} <span style={muted}>{t.addB}</span></h2>
          <div style={{ ...card, padding: 0 }}>
            {t.addons.map(([title, d, p], i) => (
              <div key={title} style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderTop: i ? "1px solid #0000000f" : 0 }}>
                <span style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{title}</span><span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>{d}</span></span>
                <span style={{ fontSize: "14px", lineHeight: "20px" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.compareTitle}</h2>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", fontSize: "15px", lineHeight: "22px" }}>
              <thead><tr style={{ textAlign: "left", background: "#f2f2f4" }}><th style={{ padding: "14px 28px", fontWeight: 500 }}></th><th style={{ padding: "14px", fontWeight: 500 }}>{t.cols[0]}</th><th style={{ padding: "14px", fontWeight: 500 }}>{t.cols[1]}</th><th style={{ padding: "14px 28px", fontWeight: 500 }}>{t.cols[2]}</th></tr></thead>
              <tbody>{t.compare.map(([f, a, b, c]) => (<tr key={f} style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "14px 28px" }}>{f}</td><td style={{ padding: "14px", ...muted }}>{a}</td><td style={{ padding: "14px", ...muted }}>{b}</td><td style={{ padding: "14px 28px", ...muted }}>{c}</td></tr>))}</tbody>
            </table>
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
                <p style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: "24px", maxWidth: "760px", ...muted }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
