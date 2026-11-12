"use client";
import LangLink from "@/components/lang-link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

const CARD_BG = ["#ff6301", "#f6f2e8", "#ffbab5"];

export default function Page() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>
      <SiteHeader />

      <section style={{ padding: "80px 24px 48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "720px" }}>{t.h1}</h1>
        <p data-illustrative-note="" style={{ margin: 0, padding: "6px 12px", borderRadius: "800px", background: "#fff3e8", color: "#6b3a00", fontSize: "14px", lineHeight: "20px" }}>{t.note}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px", fontSize: "14px", lineHeight: "14px" }}>{t.filters.map((f, i) => (<span key={f} style={{ padding: "10px 16px", borderRadius: "800px", background: i === 0 ? "#000000" : "#ffffff", color: i === 0 ? "#ffffff" : "#000000" }}>{f}</span>))}</div>
      </section>

      <section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px" }}>
          <LangLink href="/#demo" style={{ borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "flex-end", minHeight: "420px", boxSizing: "border-box" }}>
            <div style={{ flex: "2 1 420px", display: "flex", flexDirection: "column", gap: "16px" }}><span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: "#ffffff33", fontSize: "12px" }}>{t.heroBadge}</span><span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>{t.heroTitle}</span><span style={{ fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{t.heroText}</span></div>
          </LangLink>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            {t.cards.map(([photo, meta, title], i) => (
              <LangLink key={i} href="/#demo" style={{ display: "flex", flexDirection: "column", gap: "14px" }}><span style={{ height: "280px", borderRadius: "12px", background: CARD_BG[i], display: "flex", alignItems: "flex-end", padding: "20px", boxSizing: "border-box", fontSize: "12px" }}>{photo}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>{meta}</span><span style={{ fontSize: "18px", lineHeight: "23px", letterSpacing: "-0.36px" }}>{title}</span></LangLink>
            ))}
          </div>

          <div style={{ borderRadius: "12px", background: "#ffffff", padding: "clamp(32px, 5vw, 56px)", display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "12px" }}><h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>{t.ctaA} <span style={{ color: "#5f5f63" }}>{t.ctaB}</span></h2></div>
            <LangLink href="/#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>{t.ctaBtn}</LangLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
