"use client";
import LangLink from "@/components/lang-link";
import PageShell, { card, h2, h3, muted, pillBtn, section, wrap } from "@/components/page-shell";
import { CATALOG, TYPES } from "@/components/models-catalog";
import { useLang } from "@/components/use-lang";
import { COPY } from "./copy";

const PROVIDER_META = [["openai", "OpenAI"], ["anthropic", "Anthropic"], ["googlegemini", "Google"], ["mistralai", "Mistral AI"], ["meta", "Meta"], ["deepseek", "DeepSeek"], ["elevenlabs", "ElevenLabs"], ["huggingface", "Hugging Face"]];
const CLOUD_LOGOS = ["azure", "aws", "googlevertex", "ollama"];
const TASK_COLORS = ["#004c39", "#9dbecc", "#a30042", "#8e4e00"];

export default function Modelos() {
  const lang = useLang();
  const t = COPY[lang] || COPY.es;
  return (
    <PageShell
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      actions={<><LangLink href="/#demo" style={pillBtn(true)}>{t.demo}</LangLink><LangLink href="/seguridad" style={pillBtn(false)}>{t.security}</LangLink></>}
    >
      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.provA} <span style={muted}>{t.provB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {PROVIDER_META.map(([logo, name], i) => (
              <div key={name} style={{ ...card, padding: "20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${logo}.svg`} alt="" width="28" height="28" /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: "14px", lineHeight: "20px" }}>{t.providers[i][0]}</span>
                  <span style={{ fontSize: "13px", lineHeight: "19px", ...muted }}>{t.providers[i][1]}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.taskA} <span style={muted}>{t.taskB}</span></h2>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px", lineHeight: "22px", minWidth: "720px" }}>
              <thead><tr style={{ textAlign: "left", background: "#f2f2f4" }}><th style={{ padding: "14px 24px", fontWeight: 500 }}>{t.th[0]}</th><th style={{ padding: "14px", fontWeight: 500 }}>{t.th[1]}</th><th style={{ padding: "14px", fontWeight: 500 }}>{t.th[2]}</th><th style={{ padding: "14px 24px", fontWeight: 500 }}>{t.th[3]}</th></tr></thead>
              <tbody>
                {t.tasks.map(([agent, task, model, why], i) => (
                  <tr key={i} style={{ borderTop: "1px solid #0000000f" }}>
                    <td style={{ padding: "16px 24px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><span style={{ width: "12px", height: "12px", borderRadius: "800px", background: TASK_COLORS[i] }} />{agent}</span></td>
                    <td style={{ padding: "16px 14px" }}>{task}</td>
                    <td style={{ padding: "16px 14px" }}>{model}</td>
                    <td style={{ padding: "16px 24px", ...muted }}>{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.cat.a} <span style={muted}>{t.cat.b}</span></h2>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <div style={{ minWidth: "560px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 72px 136px", gap: "12px", padding: "12px 24px", background: "#f2f2f4", fontSize: "13px", ...muted }}>
                <span>{t.cat.cols[0]}</span><span>{t.cat.cols[1]}</span><span style={{ textAlign: "right" }}>{t.cat.cols[2]}</span><span style={{ textAlign: "right" }}>{t.cat.cols[3]}</span>
              </div>
              {CATALOG.map((g) => (
                <div key={g.region}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 24px", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{t.cat.regions[g.region]}</span>
                    {g.region === "Operado en la UE" && <span style={{ padding: "1px 8px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "11px" }}>UE</span>}
                  </div>
                  {g.providers.map((p) => (
                    <div key={p.name}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 24px", borderTop: "1px solid #0000000a" }}>
                        {p.logo ? <img src={`/logos/${p.logo}.svg`} alt="" width="18" height="18" style={{ borderRadius: "4px" }} /> : <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#ebebed", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 600 }}>{p.name[0]}</span>}
                        <span style={{ fontSize: "13px", ...muted }}>{p.name}</span>
                      </div>
                      {p.models.map((m) => {
                        const [label, bg, fg] = TYPES[m.type];
                        return (
                          <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr auto 72px 136px", gap: "12px", alignItems: "center", padding: "10px 24px", borderTop: "1px solid #0000000a", fontSize: "14px" }}>
                            <span style={{ fontWeight: 500 }}>{m.n}</span>
                            <span style={{ padding: "2px 9px", borderRadius: "800px", background: bg, color: fg, fontSize: "11px", lineHeight: "16px", justifySelf: "start" }}>{t.cat.types[m.type]}</span>
                            <span style={{ textAlign: "right", ...muted }}>{m.ctx}</span>
                            <span style={{ textAlign: "right", ...muted }}>{m.out ? `${m.in} / ${m.out}` : m.in}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <span style={{ fontSize: "13px", ...muted }}>{t.cat.note}</span>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          <div style={{ ...card, background: "#000000", color: "#ffffff", border: 0, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", opacity: 0.6 }}>{t.opt1Tag}</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t.opt1Title}</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>{t.opt1Text}</p>
            <LangLink href="/precios" style={{ marginTop: "auto", color: "#ffffff", fontSize: "14px" }}>{t.opt1Link}</LangLink>
          </div>
          <div style={{ ...card, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", ...muted }}>{t.opt2Tag}</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t.opt2Title}</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", ...muted }}>{t.opt2Text}</p>
            <div style={{ marginTop: "auto", display: "flex", gap: "8px" }}>{["openai", "anthropic", "googlegemini", "mistralai"].map((l) => (<span key={l} style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={`/logos/${l}.svg`} alt="" width="22" height="22" /></span>))}</div>
          </div>
          <div style={{ ...card, background: "#a3c2a7", border: 0, minHeight: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", opacity: 0.7 }}>{t.opt3Tag}</span>
            <h3 style={{ ...h3, fontSize: "22px", lineHeight: "26px" }}>{t.opt3Title}</h3>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", opacity: 0.75 }}>{t.opt3Text}</p>
            <LangLink href="/enterprise" style={{ marginTop: "auto", fontSize: "14px" }}>{t.opt3Link}</LangLink>
          </div>
        </div>
      </section>

      <section style={section}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={h2}>{t.cloudA} <span style={muted}>{t.cloudB}</span></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {t.clouds.map(([name, text], i) => (
              <div key={name} style={{ ...card, padding: "20px", display: "flex", gap: "14px", alignItems: "center" }}>
                <span style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#f7f7f8", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${CLOUD_LOGOS[i]}.svg`} alt="" width="26" height="26" /></span>
                <span><span style={{ display: "block", fontSize: "16px", lineHeight: "22px", fontWeight: 500 }}>{name}</span><span style={{ display: "block", fontSize: "14px", lineHeight: "20px", ...muted }}>{text}</span></span>
              </div>
            ))}
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
