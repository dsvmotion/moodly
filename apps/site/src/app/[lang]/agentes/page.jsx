"use client";
import LangLink from "@/components/lang-link";
import { Fragment, useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DemoForm from "@/components/demo-form";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";
import { AvailabilityBadge } from "@/components/availability";

// Cada skill, canal y regla de la página, con su unidad de docs/scope.yaml (N-01;
// regla de V1 del 2026-11-11): lo del piloto sale «En el piloto», lo de después
// «En hoja de ruta» y lo que no tiene unidad (null) no se enseña. Mismo índice que
// los arrays de copy.js, que son iguales en los cuatro idiomas.
// Reglas: «auto» solo para lo que no escribe ni envía; el resto, con aprobación
// (decisión 9: borradores la primera semana; después, autónomas solo las respuestas).
const UNITS = {
  recepcion: { skills: ["RC2", "RC5", "RC3", "RC6", "ch-voice", "RC1"], channels: ["ch-voice", "ch-whatsapp", "int-googlecalendar", "int-microsoftoutlook", "ch-instagram"], rules: ["p", null, "n", "p"] },
  atencion: { skills: ["CU1", "OA01", "CU7", "CU1", "CU3", "CU3"], channels: ["ch-whatsapp", "int-gmail", "int-microsoftoutlook", "ch-instagram", "ch-messenger", "ch-webchat"], rules: ["a", "p", "n", "n"] },
  comercial: { skills: ["SA1", "SA4", "SA2", "CU5", "SA7", null], channels: ["ch-whatsapp", "ch-email", "int-typeform", "int-idealista", "int-hubspot"], rules: ["p", "p", "p", "n"] },
  admin: { skills: ["AD2", "AD1", "AD3", null, null, null], channels: ["int-holded", "ch-email", "ch-whatsapp", null, null], rules: ["a", "p", null, "n"] },
};
// Si un idioma tiene más o menos elementos que UNITS, los índices dejarían de casar:
// que falle la compilación.
for (const [lang, c] of Object.entries(COPY)) for (const [k, u] of Object.entries(UNITS)) for (const f of ["skills", "channels", "rules"]) {
  if (c.agents[k][f].length !== u[f].length) throw new Error(`agentes: ${lang}.${k}.${f} tiene ${c.agents[k][f].length} y UNITS ${u[f].length}`);
}
const withUnits = (list, units) => list.map((x, i) => [x, units[i]]).filter(([, u]) => u !== null);

const dark = { fg: "#ffffff", chipBg: "#ffffff33", btnBg: "#ffffff", btnFg: "#000000", lineColor: "#ffffff66" };
const light = { fg: "#000000", chipBg: "#00000014", btnBg: "#000000", btnFg: "#ffffff", lineColor: "#0000001a" };
const STYLE = {
  recepcion: { ...dark, bg: "#004c39", dot: "#004c39" },
  atencion: { ...light, bg: "#9dbecc", dot: "#9dbecc" },
  comercial: { ...dark, bg: "#a30042", dot: "#a30042" },
  admin: { ...dark, bg: "#8e4e00", dot: "#8e4e00" },
};

export default function Page() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  const [key, setKey] = useState("recepcion");
  const u = UNITS[key];
  const a = { ...STYLE[key], ...t.agents[key] };
  const skills = withUnits(a.skills, u.skills);
  const channels = withUnits(a.channels, u.channels);
  const rules = withUnits(a.rules, u.rules);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", width: "100%" }}>

      <SiteHeader />

      <div style={{ position: "sticky", top: "52px", zIndex: "9", background: "#f7f7f8e6", borderBottom: "1px solid #0000000f" }}>
        <div role="tablist" aria-label="Agentes" style={{ maxWidth: "1312px", margin: "0 auto", padding: "8px clamp(16px, 4vw, 40px)", boxSizing: "border-box", display: "flex", gap: "6px", overflowX: "auto" }}>
          {t.tabs.map(([id, label]) => {
            const on = id === key;
            return (<button key={id} type="button" role="tab" aria-selected={on} onClick={on ? undefined : () => setKey(id)} style={{ flex: "none", display: "flex", gap: "8px", alignItems: "center", padding: "10px 18px", borderRadius: "800px", border: "0", background: on ? "#000000" : "transparent", color: on ? "#ffffff" : "#5f5f63", font: "400 14px/21px var(--font-display)", cursor: on ? "default" : "pointer" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: STYLE[id].dot }}></span>{label}</button>);
          })}
        </div>
      </div>

      <section style={{ padding: "24px clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", borderRadius: "12px", background: a.bg, color: a.fg, padding: "clamp(40px, 7vw, 96px) clamp(24px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <span style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: "800px", background: a.chipBg, fontSize: "14px", lineHeight: "14px" }}>{t.agentOf(a.name)}</span>
            <h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em" }}>{a.h1}</h1>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "460px", opacity: ".85" }}>{a.sub}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><a href="#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: a.btnBg, color: a.btnFg, textDecoration: "none" }}>{t.tabDemo}</a><LangLink href="/precios" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: `1px solid ${a.lineColor}`, color: a.fg, textDecoration: "none" }}>{t.tabPrices}</LangLink></div>
          </div>
          <div style={{ flex: "1 1 360px", maxWidth: "440px", background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px", boxShadow: "0 8px 24px #0000001f" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #0000000f" }}><span style={{ fontWeight: "500" }}>{a.chatHead}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>{t.example}</span></div>
            {a.chat.map(([text, type], i) => (<Fragment key={i}>
              {type === "u" ? <div style={{ alignSelf: "flex-start", background: "#f4f4f5", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{text}</div> : null}
              {type === "a" ? <div style={{ alignSelf: "flex-end", background: "#000000", color: "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{text}</div> : null}
              {type === "g" ? <span style={{ alignSelf: "flex-end", padding: "5px 10px", borderRadius: "800px", background: "#f6f2e8", fontSize: "12px", lineHeight: "14px" }}>{text}</span> : null}
            </Fragment>))}
          </div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>{t.skillsA} <span style={{ color: "#5f5f63" }}>{t.skillsB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            {skills.map(([[title, d], unit], i) => (<div key={i} style={{ background: "#ffffff", borderRadius: "12px", padding: "28px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "180px" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: a.bg }}></span><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{title}</span><AvailabilityBadge id={unit} lang={lang} /><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", gap: "48px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>{t.whereA} <span style={{ color: "#5f5f63" }}>{t.whereB}</span></h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>{channels.map(([c, unit], i) => (<span key={i} style={{ padding: "10px 18px", borderRadius: "800px", background: "#ffffff", display: "flex", gap: "8px", alignItems: "center" }}>{c}<AvailabilityBadge id={unit} lang={lang} /></span>))}</div>
            <LangLink href="/integraciones" style={{ alignSelf: "flex-start", fontSize: "14px", color: "#2457f5", textDecoration: "none" }}>{t.allInt}</LangLink>
          </div>
          <div style={{ flex: "1 1 480px", background: "#ffffff", borderRadius: "12px", padding: "8px 24px", fontSize: "14px", lineHeight: "21px" }}>
            <div style={{ padding: "16px 0 8px", fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{t.youDecide}</div>
            {rules.map(([[text], mode], i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "14px 0", borderTop: "1px solid #0000000f" }}><span>{text}</span>
              {mode === "a" ? <span style={{ padding: "0 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", whiteSpace: "nowrap" }}>{t.ruleAuto}</span> : null}
              {mode === "p" ? <span style={{ padding: "0 10px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", whiteSpace: "nowrap" }}>{t.ruleAsk}</span> : null}
              {mode === "n" ? <span style={{ padding: "0 10px", borderRadius: "800px", background: "#fbe1ea", color: "#a30042", whiteSpace: "nowrap" }}>{t.ruleNever}</span> : null}
            </div>))}
          </div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em", maxWidth: "640px" }}>{t.sectorA} <span style={{ color: "#5f5f63" }}>{t.sectorB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {a.sectors.map(([n, text], i) => (<LangLink key={i} href="/sectores" style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", color: "#000000", textDecoration: "none", minHeight: "160px" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>{n}</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "#5f5f63" }}>{text}</span><span style={{ marginTop: "auto", fontSize: "14px", color: "#2457f5" }}>{t.see}</span></LangLink>))}
          </div>
        </div>
      </section>

      <section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ maxWidth: "1232px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
          {a.metrics.map(([n, text, src], i) => (<div key={i} style={{ borderTop: "1px solid #000000", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "44px", lineHeight: "48px", letterSpacing: "-1.76px", fontWeight: 100 }}>{n}</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>{text}</span><span style={{ fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>{t.source} {src}</span></div>))}
        </div>
      </section>

      <section id="demo" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "560px" }}>{t.demoH2(a.name)}</h2>
          <DemoForm id="agent-email" />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
