"use client";
import PageShell, { card, muted, section, wrap } from "@/components/page-shell";
import ContactForm from "@/components/contact-form";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";
import { CONTACT_EMAIL } from "@/components/contact";

export default function Contacto() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ ...wrap, display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ ...card, flex: "2 1 520px", minWidth: 0, padding: "clamp(24px, 4vw, 40px)" }}><ContactForm /></div>
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "13px", ...muted }}>{t.mailLabel}</span>
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500, color: "inherit" }}>{CONTACT_EMAIL}</a>
            </div>
            {t.channels.map(([label, d]) => (
              <div key={label} style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: "14px", lineHeight: "20px", ...muted }}>{d}</span>
              </div>
            ))}
            <div style={{ ...card, padding: "20px", background: "#e8edff", border: 0, fontSize: "14px", lineHeight: "21px" }}>{t.address}</div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
