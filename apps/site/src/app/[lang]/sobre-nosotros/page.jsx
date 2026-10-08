"use client";
import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { AGENTS } from "@/components/site-data";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

const VAL_COLORS = [["#004c39", "#ffffff"], ["#ffffff", "#000000"], ["#9dbecc", "#000000"], ["#ffbab5", "#000000"]];

export default function SobreNosotros() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return (
    <PageShell
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      actions={<><LangLink href="/contacto" style={pillBtn(true)}>{t.contact}</LangLink><LangLink href="/agentes" style={pillBtn(false)}>{t.meetAgents}</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "48px", flexWrap: "wrap" }}>
          <h2 style={{ ...h2, flex: "1 1 360px" }}>{t.whyA} <span style={muted}>{t.whyB}</span></h2>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "16px", fontSize: "17px", lineHeight: "27px" }}>
            <p style={{ margin: 0 }}>{t.whyP1}</p>
            <p style={{ margin: 0, ...muted }}>{t.whyP2}</p>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.believe}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {t.values.map(([title, d], i) => {
              const [bg, fg] = VAL_COLORS[i];
              return (<div key={i} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "240px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{title}</h3>
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.78 }}>{d}</p>
              </div>);
            })}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.teamA} <span style={muted}>{t.teamB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {AGENTS.map((a, i) => (
              <div key={a.name} style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span aria-hidden="true" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: "8px", background: a.color, opacity: 0.9 }} />
                <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{t.teamName(i + 1)}</span>
                <span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>{t.teamRole}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ ...h2, flex: "1 1 420px" }}>{t.joinA} <span style={{ opacity: 0.55 }}>{t.joinB}</span></h2>
          <LangLink href="/contacto" style={pillBtn(false)}>{t.joinBtn}</LangLink>
        </div>
      </section>
    </PageShell>
  );
}
