"use client";
import { useEffect, useState } from "react";
import LangLink from "@/components/lang-link";
import PhoneDemo from "@/components/phone-demo";
import { PRICING as P } from "@/components/pricing";
import { getVerticals } from "@/components/verticals";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import AgentCarousel from "@/components/agent-carousel";
import DemoForm from "@/components/demo-form";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";
import { availability, AvailabilityBadge } from "@/components/availability";

export default function Page() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  // En escritorio, el teléfono del hero cobra vida (demo en vivo); en móvil se
  // queda la captura estática para no romper la composición ni gastar batería.
  const [liveHero, setLiveHero] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const sync = () => setLiveHero(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  const VERTICALS = getVerticals(lang);
  const A = t.agents;
  const arrow = (stroke) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>);
  // Solo herramientas del piloto o ya disponibles (N-01): un logo «En hoja de ruta» rompe la compilación.
  const pilotOnly = (src) => { const id = "int-" + src.split("/").pop().split(".")[0]; if (availability(id) === "roadmap") throw new Error(`portada: ${id} está en hoja de ruta`); };
  const tool = (src, label) => (pilotOnly(src), <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap" }}><img src={src} alt="" width="20" height="20" style={{ display: "block", flex: "none", borderRadius: "4px" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span></span>);
  const picto = (src, title, desc) => (<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><img src={src} alt="" width="44" height="44" style={{ objectFit: "contain", objectPosition: "left" }} /><span style={{ fontSize: "18px", lineHeight: "24px" }}>{title}</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{desc}</span></div>);
  const intLogo = (src, label) => (pilotOnly(src), <span style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={src} alt={label} width="28" height="28" /></span>);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>

      <div style={{ background: "#000000", color: "#ffffff", padding: "10px 16px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap", textAlign: "center" }}>
        <span style={{ padding: "2px 8px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "18px" }}>{t.bannerNew}</span>
        <span>{t.banner}</span>
        <a href="#sectores" style={{ color: "#ffffff", textDecoration: "underline" }}>{t.bannerCta}</a>
      </div>

      <SiteHeader />

      <section style={{ padding: "80px 24px 48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "720px" }}>{t.heroH1}</h1>
        <p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "460px" }}>{t.heroSub}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px" }}>
          <a href="#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>{t.heroDemo}</a>
          <a href="#agentes" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a" }}>{t.heroAgents}</a>
        </div>
      </section>

      <section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
        <div className="hero-collage" style={{ maxWidth: "1232px", margin: "0 auto", borderRadius: "16px", background: "linear-gradient(180deg, #ececee 0%, #f2f2f4 100%)", padding: "clamp(28px, 5vw, 64px) clamp(12px, 4vw, 48px) 0", boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{ position: "relative", maxWidth: "1080px", margin: "0 auto", height: "clamp(260px, 44vw, 600px)" }}>
            <img className="collage-back" src="/shots/inicio.png" alt="" style={{ position: "absolute", left: 0, top: "56px", width: "52%", borderRadius: "12px", boxShadow: "0 12px 32px #0000001f", opacity: 0.92 }} />
            <img className="collage-back" src="/shots/informes.png" alt="" style={{ position: "absolute", right: 0, top: "56px", width: "52%", borderRadius: "12px", boxShadow: "0 12px 32px #0000001f", opacity: 0.92 }} />
            <img src="/shots/conversaciones.png" alt={t.altInbox} style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "min(84%, 900px)", borderRadius: "12px 12px 0 0", boxShadow: "0 24px 64px #00000033, 0 0 0 1px #0000000f", zIndex: 2 }} />
            {liveHero ? (
              <div style={{ position: "absolute", right: "clamp(0px, 3vw, 40px)", bottom: "-7%", zIndex: 3, filter: "drop-shadow(0 24px 48px #00000040)" }}>
                <PhoneDemo scale={0.62} />
              </div>
            ) : (
              <img src="/shots/movil-aprobar.png" alt={t.altMobile} style={{ position: "absolute", right: "clamp(0px, 3vw, 40px)", bottom: "-8%", width: "clamp(110px, 19%, 210px)", borderRadius: "clamp(18px, 2.6vw, 34px)", border: "clamp(4px, 0.6vw, 7px) solid #000000", boxShadow: "0 24px 48px #00000040", zIndex: 3 }} />
            )}
          </div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "96px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{t.toolsLabel}</span>
            <div className="logo-grid" style={{ width: "100%", maxWidth: "1040px", display: "grid", gap: "10px" }}>
              {tool("/logos/whatsapp.svg", "WhatsApp")}{tool("/logos/gmail.svg", "Gmail")}{tool("/logos/googlecalendar.svg", "Google Calendar")}{tool("/logos/microsoftoutlook.svg", "Outlook")}{tool("/logos/telegram.svg", "Telegram")}{tool("/logos/notion.svg", "Notion")}{tool("/logos/hubspot.svg", "HubSpot")}{tool("/logos/zapier.svg", "Zapier")}{tool("/logos/stripe.svg", "Stripe")}{tool("/logos/holded.png", "Holded")}{tool("/logos/googledrive.svg", "Google Drive")}{tool("/logos/slack.svg", "Slack")}{tool("/logos/make.svg", "Make")}
              <LangLink href="/integraciones" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: 0, padding: "10px 12px", borderRadius: "800px", background: "#000000", border: "1px solid #000000", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap", color: "#ffffff" }}>{t.toolsMore}</LangLink>
            </div>
            <div className="benefit-grid" style={{ width: "100%", maxWidth: "1232px", display: "grid", gap: "32px 24px", marginTop: "72px", textAlign: "left" }}>
              {picto("/brand/pictos/diurno.svg", t.benefits[0][0], t.benefits[0][1])}
              {picto("/brand/pictos/comentario.svg", t.benefits[1][0], t.benefits[1][1])}
              {picto("/brand/pictos/tiempo.svg", t.benefits[2][0], t.benefits[2][1])}
              {picto("/brand/pictos/equilibrio.svg", t.benefits[3][0], t.benefits[3][1])}
              {picto("/brand/pictos/libro.svg", t.benefits[4][0], t.benefits[4][1])}
              {picto("/brand/pictos/ordenador.svg", t.benefits[5][0], t.benefits[5][1])}
            </div>
          </div>
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 360px", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>{t.midH2a} <span style={{ color: "#5f5f63" }}>{t.midH2b}</span></h2>
              <a href="#como-funciona" style={{ display: "inline-flex", alignItems: "center", gap: "12px", fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: "#00000014", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{arrow("#000000")}</span>{t.midHow}</a>
            </div>
            <figure style={{ flex: "1 1 360px", maxWidth: "584px", margin: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "32px", borderRadius: "12px", background: "#ffffff", border: "1px solid #0000000f", boxSizing: "border-box" }}><span style={{ fontSize: "clamp(48px, 6vw, 72px)", lineHeight: "1", letterSpacing: "-0.04em" }}>{t.statN}</span><blockquote style={{ margin: "0", fontSize: "18px", lineHeight: "27px" }}>{t.statQuote}</blockquote><figcaption style={{ fontSize: "13px", lineHeight: "19px", color: "#6b6b70" }}>{t.statSource}</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="agentes" style={{ padding: "160px clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto 48px" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>{t.agentsH2a} <span style={{ color: "#5f5f63" }}>{t.agentsH2b}</span></h2>
        </div>
        <div style={{ maxWidth: "1232px", margin: "0 auto" }}>
          <AgentCarousel>

            <LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#004c39", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
              <span style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{A.recepcion.name}</span><AvailabilityBadge id="RC2" lang={lang} /></span>
              <span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{A.recepcion.desc}</span>
              <span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}>{arrow("#ffffff")}</span>
              <span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{A.recepcion.day}</span><span style={{ color: "#6b6b70" }}>{A.recepcion.news}</span></span>
                <span style={{ borderRadius: "8px", background: "#a3c2a7", padding: "8px 12px" }}>{A.recepcion.slot1}</span>
                <span style={{ borderRadius: "8px", background: "#a3c2a7", padding: "8px 12px" }}>{A.recepcion.slot2}</span>
                <span style={{ borderRadius: "8px", background: "#f4f4f5", padding: "8px 12px", color: "#5f5f63" }}>{A.recepcion.slot3}</span>
              </span>
            </LangLink>

            <LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#9dbecc", color: "#000000", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
              <span style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{A.atencion.name}</span><AvailabilityBadge id="CU1" lang={lang} /></span>
              <span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{A.atencion.desc}</span>
              <span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#00000014", display: "flex", alignItems: "center", justifyContent: "center" }}>{arrow("#000000")}</span>
              <span style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ alignSelf: "flex-start", background: "#f6f2e8", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{A.atencion.q}</span>
                <span style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{A.atencion.a}</span>
                <span style={{ display: "flex", gap: "6px" }}><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>WhatsApp</span><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>Email</span><span style={{ padding: "6px 12px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>Web chat</span></span>
              </span>
            </LangLink>

            <LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#a30042", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
              <span style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{A.comercial.name}</span><AvailabilityBadge id="SA1" lang={lang} /></span>
              <span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{A.comercial.desc}</span>
              <span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}>{arrow("#ffffff")}</span>
              <span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{A.comercial.head}</span><span style={{ color: "#6b6b70" }}>CRM</span></span>
                <span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Ana T.</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px" }}>✓ {A.comercial.q1}</span></span>
                <span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Grupo Norte</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px" }}>{A.comercial.q2}</span></span>
                <span style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #0000000f", paddingTop: "8px" }}><span>Marc P.</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#f4f4f5", color: "#5f5f63", fontSize: "12px" }}>{A.comercial.q3}</span></span>
              </span>
            </LangLink>

            <LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#8e4e00", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
              <span style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{A.admin.name}</span><AvailabilityBadge id="AD2" lang={lang} /></span>
              <span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{A.admin.desc}</span>
              <span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}>{arrow("#ffffff")}</span>
              <span style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{A.admin.inv}</span><span>[000,00] €</span></span>
                <span style={{ color: "#5f5f63" }}>{A.admin.due}</span>
                <span style={{ display: "flex", gap: "8px" }}><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>{A.admin.approve}</span><span style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a" }}>{A.admin.review}</span></span>
              </span>
            </LangLink>

            <LangLink href="/agentes" style={{ flex: "0 0 384px", height: "480px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", scrollSnapAlign: "start", overflow: "hidden" }}>
              <span style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{A.custom.name}</span><AvailabilityBadge id="PL-custom-agents" lang={lang} /></span>
              <span style={{ marginTop: "12px", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{A.custom.desc}</span>
              <span style={{ marginTop: "20px", width: "32px", height: "32px", borderRadius: "800px", background: "#ffffff33", display: "flex", alignItems: "center", justifyContent: "center" }}>{arrow("#ffffff")}</span>
              <span style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                <span style={{ height: "72px", borderRadius: "12px", background: "#004c39" }}></span><span style={{ height: "72px", borderRadius: "12px", background: "#9dbecc" }}></span>
                <span style={{ height: "72px", borderRadius: "12px", background: "#a30042" }}></span><span style={{ height: "72px", borderRadius: "12px", background: "#8e4e00" }}></span>
              </span>
            </LangLink>

          </AgentCarousel>
        </div>
      </section>

      <section id="sectores" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}><div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}><h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>{t.sectorsH2a} <span style={{ color: "#5f5f63" }}>{t.sectorsH2b}</span></h2><LangLink href="/sectores" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>{t.sectorsAll}</LangLink></div><div className="vertical-grid" style={{ display: "grid", gap: "16px" }}>{VERTICALS.map((v) => (<a key={v.id} href={`/sectores#${v.id}`} style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: "190px", padding: "24px", borderRadius: "12px", background: v.color, color: v.on, boxSizing: "border-box", boxShadow: v.color === "#ffffff" ? "inset 0 0 0 1px #0000000f" : "none" }}><span style={{ fontSize: "20px", lineHeight: "24px", letterSpacing: "-0.4px" }}>{v.name}</span><span style={{ fontSize: "15px", lineHeight: "22px", opacity: ".75" }}>{v.subsectors.slice(0, 4).join(", ")}…</span><span style={{ marginTop: "auto", fontSize: "14px" }}>{t.sectorSee}</span></a>))}</div></div></section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
          <h2 style={{ margin: "0 auto", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", textAlign: "center", maxWidth: "512px" }}>{t.adaptH2}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "40px" }}>

            <div style={{ flex: "2 1 560px", minHeight: "440px", borderRadius: "12px", background: "#a3c2a7", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_plugTitle}</h3><AvailabilityBadge id="PL-templates" lang={lang} /></div>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "440px" }}>{t.f_plugText}</p>
              <div style={{ marginTop: "auto", background: "#ffffff", borderRadius: "12px", padding: "8px 20px", maxWidth: "480px", fontSize: "14px", lineHeight: "21px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #0000000f" }}><span style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>{t.f_plug1}<AvailabilityBadge id="RC5" lang={lang} /></span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #0000000f" }}><span style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>{t.f_plug2}<AvailabilityBadge id="RC6" lang={lang} /></span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative", flex: "none" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}><span style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>{t.f_plug3}<AvailabilityBadge id="CU5" lang={lang} /></span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#d4d4d8", position: "relative", flex: "none" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span></div>
              </div>
            </div>

            <div style={{ flex: "1 1 320px", minHeight: "440px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_approveTitle}</h3><AvailabilityBadge id="OA02" lang={lang} /></div>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{t.f_approveText}</p>
              <div style={{ marginTop: "auto", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "8px 16px", fontSize: "14px", lineHeight: "21px" }}>
                {t.f_approveRows.map((r, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < t.f_approveRows.length - 1 ? "1px solid #0000000f" : "none" }}><span>{r[0]}</span><span style={{ padding: "0 10px", borderRadius: "800px", background: r[2], color: r[3] }}>{r[1]}</span></div>))}
              </div>
            </div>

            <div style={{ flex: "1 1 320px", minHeight: "440px", borderRadius: "12px", background: "#f6f2e8", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_memTitle}</h3><AvailabilityBadge id="E3" lang={lang} /></div>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>{t.f_memText}</p>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
                {t.f_mem.map((m, i) => (<div key={i} style={{ background: "#ffffff", borderRadius: "12px", padding: "12px 16px" }}>{m}</div>))}
              </div>
            </div>

            <div style={{ flex: "2 1 560px", minHeight: "440px", borderRadius: "12px", background: "#ffbab5", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_coachTitle}</h3><AvailabilityBadge id="CO2" lang={lang} /></div>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "440px" }}>{t.f_coachText}</p>
              <div style={{ marginTop: "auto", background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", maxWidth: "520px", fontSize: "14px", lineHeight: "21px" }}>
                <div style={{ fontWeight: "500" }}>{t.f_coachSugg}</div>
                <div style={{ color: "#5f5f63" }}>{t.f_coachBody}</div>
                <div style={{ display: "flex", gap: "8px" }}><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#2457f5", color: "#ffffff" }}>{t.f_coachDo}</span><span style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a" }}>{t.f_coachNot}</span></div>
              </div>
            </div>

            <div style={{ flex: "1 1 480px", minHeight: "440px", borderRadius: "12px", background: "#ffffff", border: "1px solid #0000000f", padding: "36px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}> <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_intTitle}</h3><AvailabilityBadge id="OA08" lang={lang} /></div> <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", color: "#5f5f63", maxWidth: "440px" }}>{t.f_intText}</p><div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: "10px" }}>{intLogo("/logos/whatsapp.svg", "WhatsApp")}{intLogo("/logos/gmail.svg", "Gmail")}{intLogo("/logos/googlecalendar.svg", "Google Calendar")}{intLogo("/logos/microsoftoutlook.svg", "Outlook")}{intLogo("/logos/telegram.svg", "Telegram")}{intLogo("/logos/hubspot.svg", "HubSpot")}{intLogo("/logos/zapier.svg", "Zapier")}{intLogo("/logos/pipedrive.svg", "Pipedrive")}{intLogo("/logos/stripe.svg", "Stripe")}{intLogo("/logos/quickbooks.svg", "QuickBooks")}{intLogo("/logos/xero.svg", "Xero")}{intLogo("/logos/shopify.svg", "Shopify")}{intLogo("/logos/notion.svg", "Notion")}{intLogo("/logos/slack.svg", "Slack")}</div><LangLink href="/integraciones" style={{ fontSize: "14px", color: "#2457f5" }}>{t.f_intMore}</LangLink></div>

            <div style={{ flex: "1 1 480px", minHeight: "440px", borderRadius: "12px", background: "#ff6301", color: "#000000", padding: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>{t.f_delTitle}</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", opacity: ".75", maxWidth: "420px" }}>{t.f_delText}</p>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px", fontSize: "16px", lineHeight: "24px" }}>
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>✓</span>{t.f_del1}</span>
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>✓</span>{t.f_del2}</span>
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ color: "#000000" }}>×</span>{t.f_del3}</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="como-funciona" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>{t.howH2a} <span style={{ color: "#5f5f63" }}>{t.howH2b}</span></h2>
          <ol style={{ margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "40px" }}>
            {t.steps.map((s, i) => (<li key={i} style={{ borderTop: "1px solid #000000", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ font: "400 13px/20px var(--font-mono)", color: "#6b6b70" }}>0{i + 1}</span><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{s[0]}</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{s[1]}</span></li>))}
          </ol>
        </div>
      </section>

      <section id="precios" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center" }}>
            <h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "512px" }}>{t.priceH2}</h2>
            <p style={{ margin: "0", fontSize: "16px", lineHeight: "24px", color: "#5f5f63", maxWidth: "520px" }}>{t.priceSub}</p>
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: "1 1 280px", borderRadius: "12px", background: "#ffffff66", border: "1px solid #0000000f", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{t.priceTrial}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{P.trialDays} {t.priceTrialSub}</span>
              <span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>0 €</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{t.priceTrialDesc}</span>
              <ul style={{ margin: "8px 0 0", padding: "16px 0 0", borderTop: "1px solid #0000000f", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}><li>✓ {t.priceTrialList[0]}</li><li>✓ {t.priceTrialList[1]}</li><li>✓ {t.priceTrialList[2]}</li></ul>
            </div>
            <div style={{ flex: "1 1 280px", borderRadius: "12px", border: "1px solid #2457f5", padding: "32px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{t.priceBizName}</span><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>{t.priceBizTag}</span></span>
              <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{t.priceBizPer}</span>
              <span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>{t.priceBizPrice}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{t.priceBizIncl}</span>
              <ul style={{ margin: "8px 0 0", padding: "16px 0 0", borderTop: "1px solid #0000000f", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}><li>✓ {t.priceBizList[0]}</li><li>✓ {t.priceBizList[1]}</li><li>✓ {t.priceBizList[2]}</li><li>✓ {t.priceBizList[3]}</li></ul>
              <LangLink href="/precios" style={{ marginTop: "auto", textAlign: "center", padding: "11px 18px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "21px" }}>{t.priceBizCta}</LangLink>
            </div>
            <div style={{ flex: "1 1 280px", borderRadius: "12px", background: "#000000cc", color: "#ffffff", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ fontSize: "18px", lineHeight: "19.8px", letterSpacing: "-0.36px" }}>{t.priceChainName}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>{t.priceChainSub}</span>
              <span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>{t.priceChainPrice}</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", opacity: ".75" }}>{t.priceChainDesc}</span>
              <LangLink href="/#demo" style={{ marginTop: "auto", textAlign: "center", padding: "10px 18px", borderRadius: "800px", background: "#ffffff", color: "#000000", fontSize: "14px", lineHeight: "21px" }}>{t.priceChainCta}</LangLink>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "420px" }}>{t.demoH2}</h2>
        <DemoForm />
        <p style={{ margin: "0", fontSize: "12px", lineHeight: "18px", color: "#5f5f63" }}>{t.demoFine1}<LangLink href="/#demo" style={{ textDecoration: "underline", color: "#5f5f63" }}>{t.demoFineLink}</LangLink>{t.demoFine2}</p>
      </div></section>

      <SiteFooter />
    </div>
  );
}
