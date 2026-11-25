"use client";
import LangLink from "@/components/lang-link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";
import { AvailabilityBadge } from "@/components/availability";

export default function Page() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>
      <SiteHeader />

      <section style={{ padding: "80px 24px 64px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "760px" }}>{t.h1}</h1>
        <p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "520px" }}>{t.sub}</p>
      </section>

      <section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
        <div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          {t.steps.map(([week, title, desc, units], i) => (
            <div key={i} style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: i === 0 ? "1px solid #000000" : "1px solid #0000001a", borderBottom: i === t.steps.length - 1 ? "1px solid #0000001a" : "none", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>{week}</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{title}</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{desc}</span>{units && (<span style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: "4px" }}>{units.map(([label, id]) => (<span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", lineHeight: "20px" }}>{label} <AvailabilityBadge id={id} lang={lang} /></span>))}</span>)}</div></div>
          ))}
          <span style={{ marginTop: "16px", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{t.note}</span>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px", borderRadius: "12px", background: "#f6f2e8", padding: "40px", display: "flex", flexDirection: "column", gap: "16px" }}><h2 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>{t.needTitle}</h2><ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "16px", lineHeight: "24px" }}>{t.need.map((x, i) => (<li key={i}>· {x}</li>))}</ul></div>
          <div style={{ flex: "1 1 420px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", display: "flex", flexDirection: "column", gap: "16px" }}><h2 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>{t.getTitle}</h2><ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "16px", lineHeight: "24px" }}>{t.get.map((x, i) => (<li key={i}>✓ {x}</li>))}</ul></div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "520px" }}>{t.ctaH2}</h2>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}><LangLink href="/#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>{t.ctaCall}</LangLink><LangLink href="/precios" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a" }}>{t.ctaPrice}</LangLink></div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
