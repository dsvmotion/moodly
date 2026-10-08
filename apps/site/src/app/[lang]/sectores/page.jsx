"use client";
import LangLink from "@/components/lang-link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import DemoForm from "@/components/demo-form";
import { AGENT_KEYS, getVerticals, getSubsectors } from "@/components/verticals";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

const wrap = { maxWidth: "1232px", margin: "0 auto" };
const pad = { padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" };
const h2s = { margin: 0, fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.025em" };
const muted = { color: "#5f5f63" };

export default function Sectores() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  const VERTICALS = getVerticals(lang);
  const SUBSECTORS = getSubsectors(lang);
  const [id, setId] = useState(VERTICALS[0].id);
  const [sub, setSub] = useState(0);
  const [agent, setAgent] = useState(AGENT_KEYS[0][0]);
  const v = VERTICALS.find((x) => x.id === id) || VERTICALS[0];
  const ag = AGENT_KEYS.find(([k]) => k === agent);
  const [, subPlural, subTu, subH1] = SUBSECTORS[v.id][sub] || SUBSECTORS[v.id][0];

  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (VERTICALS.some((x) => x.id === h)) { setId(h); setSub(0); } };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    document.querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [id]);
  const pick = (next) => { setId(next); setSub(0); window.history.replaceState(null, "", `#${next}`); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>
      <SiteHeader />

      <div style={{ position: "sticky", top: "56px", zIndex: 9, background: "#f7f7f8e6", backdropFilter: "blur(8px)", borderBottom: "1px solid #0000000f" }}>
        <div role="tablist" aria-label={t.ariaSectors} style={{ maxWidth: "1312px", margin: "0 auto", padding: "8px clamp(16px, 4vw, 40px)", boxSizing: "border-box", display: "flex", gap: "6px", overflowX: "auto" }}>
          {VERTICALS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === id} onClick={() => pick(x.id)} style={{ flex: "none", display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "800px", border: 0, background: x.id === id ? "#000000" : "transparent", color: x.id === id ? "#ffffff" : "#5f5f63", font: "400 14px/21px var(--font-display)", cursor: "pointer" }}>
              <span aria-hidden="true" style={{ width: "8px", height: "8px", borderRadius: "800px", background: x.color, boxShadow: "inset 0 0 0 1px #0000001a" }} />{x.name}
            </button>
          ))}
        </div>
      </div>

      <section style={{ padding: "80px clamp(16px, 4vw, 40px) 48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <span style={{ padding: "6px 12px", borderRadius: "800px", background: v.color, color: v.on, fontSize: "14px", lineHeight: "14px" }}>{v.name} · {v.subsectors[sub]}</span>
        <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", color: "#5f5f63" }}>{v.kw}</p>
        <h1 style={{ margin: 0, fontSize: "clamp(36px, 4.6vw, 52px)", lineHeight: 1.1, fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "800px" }}>{subH1}</h1>
        <p style={{ margin: 0, fontSize: "18px", lineHeight: "27px", fontWeight: 300, maxWidth: "560px" }}>{v.sub}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
          <a href="#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>{t.demo}</a>
          <LangLink href="/precios" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a", background: "#ffffff" }}>{t.prices}</LangLink>
        </div>
        <div role="group" aria-label={t.ariaSub} style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px", maxWidth: "820px" }}>
          {v.subsectors.map((x, i) => (<button key={x} type="button" aria-pressed={i === sub} onClick={() => setSub(i)} style={{ padding: "8px 14px", borderRadius: "800px", border: i === sub ? "1px solid #000000" : "1px solid transparent", background: "#ffffff", color: i === sub ? "#000000" : "#5f5f63", font: "400 14px/16px var(--font-display)", cursor: "pointer" }}>{x}</button>))}
        </div>
      </section>

      <section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
        <div style={{ ...wrap, borderRadius: "12px", background: v.color, padding: "clamp(16px, 6vw, 80px)", boxSizing: "border-box", display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ flex: "1 1 320px", maxWidth: "420px", minWidth: 0, background: "#ffffff", borderRadius: "12px", boxShadow: "0 8px 24px #0000001f", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", paddingBottom: "10px", borderBottom: "1px solid #0000000f" }}><span style={{ fontWeight: 500 }}>{v.chatHead}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>{v.chatMeta}</span></div>
            {v.chat.map((m, i) => (<div key={i} style={{ alignSelf: m.user ? "flex-start" : "flex-end", background: m.user ? "#f4f4f5" : "#000000", color: m.user ? "#000000" : "#ffffff", borderRadius: "12px", padding: "10px 14px", maxWidth: "85%" }}>{m.t}</div>))}
          </div>
          <div style={{ flex: "1 1 280px", maxWidth: "360px", minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {v.side.map(([k, val, d]) => (<div key={k} style={{ background: "#ffffff", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}><span style={{ fontSize: "12px", color: "#6b6b70" }}>{k}</span><span style={{ fontWeight: 500 }}>{val}</span><span style={muted}>{d}</span></div>))}
          </div>
        </div>
      </section>

      <section style={pad}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "48px" }}>
          <h2 style={{ ...h2s, maxWidth: "640px" }}>{t.painsA(subPlural)} <span style={muted}>{t.painsB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {v.pains.map((p) => (<div key={p.t} style={{ borderTop: "1px solid #000000", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "44px", lineHeight: "48px", letterSpacing: "-1.76px", fontWeight: 100 }}>{p.n}</span><span style={{ fontSize: "16px", lineHeight: "24px", ...muted }}>{p.t}</span></div>))}
          </div>
          <span style={{ fontSize: "13px", lineHeight: "19px", color: "#6b6b70", maxWidth: "760px" }}>{v.source}</span>
        </div>
      </section>

      <section style={pad}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={{ ...h2s, maxWidth: "720px" }}>{t.setupA(subPlural)} <span style={muted}>{t.setupB}</span></h2>
          <ol aria-label={t.ariaSteps} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "13px", lineHeight: "18px" }}>
            {t.steps.map((s, i) => (<li key={s} style={{ display: "flex", alignItems: "center", gap: "8px", ...muted }}><span style={{ width: "22px", height: "22px", borderRadius: "800px", background: "#000000", color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>{i + 1}</span>{s}{i < t.steps.length - 1 && <span aria-hidden="true">→</span>}</li>))}
          </ol>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", alignItems: "stretch" }}>
            <div style={{ borderRadius: "12px", background: v.color, color: v.on, padding: "20px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "12px", opacity: 0.7 }}>{t.s1}</span><span style={{ fontSize: "18px", lineHeight: "24px" }}>{v.name}</span></div>
            <div style={{ borderRadius: "12px", background: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "12px", color: "#6b6b70" }}>{t.s2}</span><span style={{ fontSize: "18px", lineHeight: "24px" }}>{v.subsectors[sub]}</span><span style={{ fontSize: "13px", ...muted }}>{t.s2hint}</span></div>
            <div style={{ borderRadius: "12px", background: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#6b6b70" }}>{t.s3}</span>
              <div role="radiogroup" aria-label={t.ariaAgent} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {AGENT_KEYS.map(([k, , bg, fg]) => (<button key={k} type="button" role="radio" aria-checked={k === agent} onClick={() => setAgent(k)} style={{ textAlign: "left", padding: "8px 12px", borderRadius: "800px", border: 0, background: k === agent ? bg : "#f4f4f5", color: k === agent ? fg : "#000000", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>{t.agents[k]}</button>))}
              </div>
            </div>
            <div style={{ borderRadius: "12px", background: ag[2], color: ag[3], padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "12px", opacity: 0.7 }}>{t.s4(t.agents[agent])}</span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "20px" }}>{v.skills[agent].map((x) => (<li key={x} style={{ display: "flex", gap: "8px" }}><span aria-hidden="true">✓</span>{x}</li>))}</ul>
            </div>
            <div style={{ borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>{t.s5}</span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "20px" }}>{v.custom.map((x) => (<li key={x} style={{ display: "flex", gap: "8px" }}><span aria-hidden="true" style={{ color: "#a3c2a7" }}>✓</span>{x}</li>))}</ul>
            </div>
          </div>
        </div>
      </section>

      <section style={pad}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={{ ...h2s, maxWidth: "640px" }}>{t.fourA(subPlural)} <span style={muted}>{t.fourB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {AGENT_KEYS.map(([k, , bg, fg]) => (
              <div key={k} style={{ minHeight: "260px", borderRadius: "12px", background: bg, color: fg, padding: "32px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ fontSize: "20px", lineHeight: "24px", letterSpacing: "-0.4px" }}>{t.agents[k]}</span>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "15px", lineHeight: "22px", opacity: 0.85 }}>{v.skills[k].map((x) => (<li key={x}>· {x}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={pad}>
        <div style={{ ...wrap, borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", boxSizing: "border-box", display: "flex", gap: "48px", flexWrap: "wrap" }}>
          <h2 style={{ ...h2s, flex: "1 1 360px" }}>{v.special[0]} <span style={{ opacity: 0.55 }}>{v.special[1]}</span></h2>
          <ul style={{ flex: "1 1 420px", margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "16px", fontSize: "16px", lineHeight: "24px" }}>{v.special[2].map((x) => (<li key={x} style={{ display: "flex", gap: "12px" }}><span style={{ color: "#a3c2a7" }}>✓</span><span>{x}</span></li>))}</ul>
        </div>
      </section>

      <section style={pad}>
        <div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={h2s}>{t.faqTitle}</h2>
          <div style={{ borderTop: "1px solid #0000001a" }}>
            {v.faq.map(([q, a]) => (<details key={q} style={{ borderBottom: "1px solid #0000001a", padding: "20px 0" }}><summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "18px", lineHeight: "27px", cursor: "pointer" }}>{q}<span aria-hidden="true">+</span></summary><p style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: "24px", maxWidth: "760px", ...muted }}>{a}</p></details>))}
          </div>
        </div>
      </section>

      <section id="demo" style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
          <h2 style={{ ...h2s, fontSize: "clamp(32px, 3.6vw, 48px)", maxWidth: "560px" }}>{t.demoH2(subTu)}</h2>
          <DemoForm id="sector-email" />
          <p style={{ margin: 0, fontSize: "12px", lineHeight: "18px", ...muted }}>{t.fine}</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
