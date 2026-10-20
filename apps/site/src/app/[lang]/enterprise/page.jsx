"use client";
import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

export default function Enterprise() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  const PILLAR_COLORS = [["#000000", "#ffffff"], ["#ffffff", "#000000"], ["#a3c2a7", "#000000"]];
  return (
    <PageShell
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>{t.talk}</LangLink><LangLink href="/seguridad" style={pillBtn(false)}>{t.security}</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={h2}>{t.probA} <span style={muted}>{t.probB}</span></h2>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", ...muted }}>{t.probP}</p>
          </div>
          <div style={{ flex: "1 1 420px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
            {t.problems.map((p) => (<span key={p} style={{ ...card, padding: "16px", fontSize: "15px", lineHeight: "22px", display: "flex", gap: "10px" }}><span style={{ color: "#a30042" }}>×</span>{p}</span>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          {t.pillars.map(([title, d], i) => {
            const [bg, fg] = PILLAR_COLORS[i];
            return (<div key={i} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "260px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{title}</h3>
              <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>{d}</p>
            </div>);
          })}
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.deployA} <span style={muted}>{t.deployB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {t.deploy.map(([title, d, tier], i) => (
              <div key={i} style={{ ...card, background: i === 0 ? "#e8edff" : "#ffffff", minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={h3}>{title}</h3>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", ...muted }}>{d}</p>
                <span style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: i === 0 ? "#2457f5" : "#f2f2f4", color: i === 0 ? "#ffffff" : "#000000", fontSize: "12px", lineHeight: "16px" }}>{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.govA} <span style={muted}>{t.govB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
            {t.governance.map(([title, d]) => (<div key={title} style={{ ...card, padding: "22px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{title}</span><span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "40px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={h2}>{t.onbA} <span style={{ opacity: 0.55 }}>{t.onbB}</span></h2>
            <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "flex-start" }}>{t.talk}</LangLink>
          </div>
          <ul style={{ flex: "1 1 360px", margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", fontSize: "16px", lineHeight: "24px" }}>
            {t.onboarding.map((o) => (<li key={o} style={{ display: "flex", gap: "10px" }}><span style={{ color: "#a3c2a7" }}>✓</span>{o}</li>))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
