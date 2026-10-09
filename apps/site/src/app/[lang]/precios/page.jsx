"use client";
import LangLink from "@/components/lang-link";
import { useState } from "react";
import PageShell, { card, h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { AGENTS } from "@/components/site-data";
import { PRICING as P, eur, estimate } from "@/components/pricing";
import { useLang } from "@/components/use-lang";
import { COPY, LOCALES } from "./copy";

const IDS = ["recepcion", "atencion", "comercial", "admin"];
const PART_COLORS = [["#ffffff", "#000000"], ["#e8edff", "#000000"], ["#000000", "#ffffff"]];

function Toggle({ on, onClick, label, color = "#2457f5" }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? color : "#d9d9de", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }} />
    </button>
  );
}

export default function Precios() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  const loc = LOCALES[lang] || "es-ES";
  const nf = (n) => n.toLocaleString(loc);
  const [on, setOn] = useState({ recepcion: true, atencion: true, comercial: false, admin: false });
  const [sites, setSites] = useState(1);
  const [conversations, setConversations] = useState(600);
  const [voice, setVoice] = useState(0);
  const [byok, setByok] = useState(false);

  const agents = IDS.filter((id) => on[id]).length;
  const e = estimate({ agents, sites, conversations, voiceMinutes: voice, byok });
  const label = { fontSize: "13px", lineHeight: "18px", ...muted };
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "15px", lineHeight: "22px" };
  const slider = { width: "100%", accentColor: "#2457f5" };
  const li = { margin: 0, padding: "16px 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" };
  const badge = (txt) => <span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>{txt}</span>;

  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ ...wrap, display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <aside aria-label={t.calc} className="sticky-wide" style={{ ...card, flex: "1 1 300px", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ fontSize: "18px", lineHeight: "22px" }}>{t.calc}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={label}>{t.agentsLabel}</span>
              {AGENTS.map((a, i) => (
                <div key={IDS[i]} style={row}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: a.color }} />{t.agents[i]}</span>
                  <Toggle label={t.agents[i]} color={a.color} on={on[IDS[i]]} onClick={() => setOn({ ...on, [IDS[i]]: !on[IDS[i]] })} />
                </div>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={row}><span>{t.convMonth}</span><strong style={{ fontWeight: 500 }}>{nf(conversations)}</strong></span>
              <input type="range" min="0" max="6000" step="100" value={conversations} onChange={(ev) => setConversations(Number(ev.target.value))} style={slider} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={row}><span>{t.voiceMonth}</span><strong style={{ fontWeight: 500 }}>{nf(voice)}</strong></span>
              <input type="range" min="0" max="3000" step="50" value={voice} onChange={(ev) => setVoice(Number(ev.target.value))} style={slider} />
            </label>
            <div style={row}>
              <span>{t.sites}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button type="button" aria-label={t.lessSites} onClick={() => setSites(Math.max(1, sites - 1))} style={{ width: "32px", height: "32px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", cursor: "pointer" }}>−</button>
                <span aria-live="polite" style={{ minWidth: "24px", textAlign: "center" }}>{sites}</span>
                <button type="button" aria-label={t.moreSites} onClick={() => setSites(Math.min(20, sites + 1))} style={{ width: "32px", height: "32px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", cursor: "pointer" }}>+</button>
              </span>
            </div>
            <div style={row}>
              <span>{t.byok}<br /><span style={label}>{t.byokSub}</span></span>
              <Toggle label={t.byok} on={byok} onClick={() => setByok(!byok)} />
            </div>
          </aside>

          <div style={{ flex: "2 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div style={{ ...card, display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ fontSize: "20px", lineHeight: "24px" }}>{t.trial}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{t.trialDesc}</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>0 €</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{t.trialMeta}</span>
                <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "stretch" }}>{t.trialStart}</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #0000000f" }}>{t.trialList.map((x) => (<li key={x}>✓ {x}</li>))}</ul>
              </div>
              <div style={{ ...card, border: e.enterprise ? card.border : "1px solid #2457f5", display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px", lineHeight: "24px" }}>{t.biz}</span>{!e.enterprise && badge(t.yourPlan)}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{t.bizDesc}</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>{eur(Math.round(e.total))}<span style={{ fontSize: "15px", ...muted }}> {t.perMonth}</span></span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{t.bizBreakdown(eur(e.fixed), eur(Math.round(e.variable)))}</span>
                <LangLink href="/contacto" style={{ ...pillBtn(true), alignSelf: "stretch" }}>{t.demo}</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #0000000f" }}>{t.bizList.map((x) => (<li key={x}>✓ {x}</li>))}</ul>
              </div>
              <div style={{ ...card, background: "#000000", color: "#ffffff", border: e.enterprise ? "1px solid #2457f5" : 0, display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px", lineHeight: "24px" }}>{t.ent}</span>{e.enterprise && badge(t.recommended)}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>{t.entDesc}</span>
                <span style={{ fontSize: "36px", lineHeight: "40px", letterSpacing: "-0.04em" }}>{t.custom}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", opacity: 0.7 }}>{t.entSub}</span>
                <LangLink href="/contacto" style={{ ...pillBtn(false), alignSelf: "stretch" }}>{t.talkSales}</LangLink>
                <ul style={{ ...li, borderTop: "1px solid #ffffff26" }}>{t.entList.map((x) => (<li key={x}>✓ {x}</li>))}</ul>
              </div>
            </div>

            <div style={{ ...card, padding: "8px 28px" }} aria-live="polite">
              {[
                [t.bAgents(Math.max(1, agents)), eur(e.fixedAgents)],
                [t.bSites(Math.max(0, sites - 1)), eur(e.fixedSites)],
                [t.bConv(nf(e.extraConversations), nf(e.included)), eur(e.variableConversations, 2)],
                [t.bVoice(nf(voice)), eur(e.variableVoice, 2)],
              ].map(([k, v]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "12px 0", borderBottom: "1px solid #0000000f", fontSize: "14px", lineHeight: "20px" }}><span style={muted}>{k}</span><span>{v}</span></div>))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "14px 0", fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}><span>{t.totalMonth}</span><span>{eur(e.total, 2)}</span></div>
            </div>
            <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }}>{t.disclaimer}</span>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.howA} <span style={muted}>{t.howB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {t.parts.map(([k, title, d], i) => {
              const [bg, fg] = PART_COLORS[i];
              return (<div key={k} style={{ ...card, background: bg, color: fg, border: bg === "#ffffff" ? card.border : 0, minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "13px", opacity: 0.65 }}>{k}</span>
                <span style={{ fontSize: "22px", lineHeight: "26px", letterSpacing: "-0.4px" }}>{title}</span>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: "23px", opacity: 0.78 }}>{d}</p>
              </div>);
            })}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.implA} <span style={muted}>{t.implB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {t.implementation.map(([fit, name, price, text], i) => (
              <div key={i} style={{ ...card, background: i === 0 ? "#dcebdd" : "#ffffff", border: i === 0 ? 0 : card.border, display: "flex", flexDirection: "column", gap: "10px", minHeight: "230px" }}>
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
