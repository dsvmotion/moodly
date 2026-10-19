"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import ModelosTabs from "@/components/modelos-tabs";
import { CATALOG, DEFAULT_ON, TYPES } from "@/components/models-catalog";

// Ajustes › Modelos de IA: cómo se conecta la organización a los proveedores.
// TODO(backend): leer y guardar en la configuración del enrutador de modelos de la organización.
const MODES = [
  ["incluido", "Incluido en tu cuota", "Moodly gestiona proveedores y consumo."],
  ["byok", "Tus propias claves", "El consumo se factura en tu cuenta del proveedor."],
  ["nube", "Tu nube", "Azure, AWS o Google Cloud (Enterprise)."],
];
const OPTIONS = ["Automático (recomendado)", "Claude Haiku 5.5", "Claude Sonnet 5.5", "Claude Opus 5.5", "GPT-5.6 Luna", "GPT-5.6 Sol", "Gemini 3.5 Flash", "Gemini 3.1 Pro", "Mistral Large"];
const AGENTS = [
  ["Recepción", "var(--green-fg)", "Automático (recomendado)", "Rápido y económico"],
  ["Atención al cliente", "var(--mist)", "Automático (recomendado)", "Equilibrado + tus documentos"],
  ["Comercial", "var(--rose-fg)", "Claude Opus 5.5", "Redacción de calidad"],
  ["Administración", "var(--amber-fg)", "Gemini 3.5 Flash", "Visión para facturas"],
];
const PROVIDERS = [
  ["openai", "OpenAI", true, "Conectada el 2 oct"],
  ["anthropic", "Anthropic", true, "Conectada el 2 oct"],
  ["googlegemini", "Google Gemini", false, ""],
  ["mistralai", "Mistral AI", false, ""],
];
const USAGE = [["Recepción", 41, "var(--green-fg)", "52 €"], ["Atención al cliente", 33, "var(--mist)", "42 €"], ["Comercial", 14, "var(--rose-fg)", "18 €"], ["Administración", 12, "var(--amber-fg)", "16 €"]];

// Catálogo de modelos: fuente única en components/models-catalog.js.

const box = { background: "var(--paper)", borderRadius: "12px", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "var(--muted)" };

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#2457f5" : "var(--track-2)", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)" }} />
    </button>
  );
}

export default function Modelos() {
  const [mode, setMode] = useState("incluido");
  const [models, setModels] = useState(AGENTS.map((a) => a[2]));
  const [fallback, setFallback] = useState(true);
  const [euOnly, setEuOnly] = useState(true);
  const [mask, setMask] = useState(true);
  const [enabled, setEnabled] = useState(() => new Set(DEFAULT_ON));
  const toggleModel = (id) => setEnabled((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const count = (p) => p.models.filter((m) => enabled.has(m.id)).length;

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px" }}>Modelos de IA. <span style={muted}>Qué inteligencia usa cada agente.</span></h1>
        <ModelosTabs active="catalogo" />

        <section style={box}>
          <h2 style={h2}>Cómo te conectas a la IA</h2>
          <div role="radiogroup" aria-label="Modo de uso" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {MODES.map(([id, t, d]) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} style={{ textAlign: "left", padding: "16px", borderRadius: "12px", border: mode === id ? "1px solid var(--blue-fg)" : "1px solid var(--line)", background: mode === id ? "var(--blue-bg)" : "var(--paper)", font: "400 14px/20px var(--font-display)", color: "var(--ink)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: 500, fontSize: "15px" }}>{t}{id === "nube" && <span style={{ marginLeft: "8px", padding: "1px 8px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", fontSize: "11px", fontWeight: 400 }}>Enterprise</span>}</span>
                <span style={muted}>{d}</span>
              </button>
            ))}
          </div>
        </section>

        {mode === "byok" && (
          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <h2 style={h2}>Tus claves de proveedor</h2>
              <span style={{ fontSize: "13px", ...muted }}>Se guardan cifradas y nunca se muestran de nuevo.</span>
            </div>
            {PROVIDERS.map(([logo, name, connected, when]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--paper-2b)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${logo}.svg`} alt="" width="22" height="22" /></span>
                <span style={{ flex: "1 1 160px", display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>{name}</span><span style={{ fontSize: "13px", color: connected ? "var(--green-fg)" : "var(--muted-2)" }}>{connected ? `● ${when}` : "Sin conectar"}</span></span>
                <button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: connected ? "1px solid var(--line)" : 0, background: connected ? "var(--paper)" : "var(--ink)", color: connected ? "var(--ink)" : "var(--on-ink)", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>{connected ? "Cambiar clave" : "Añadir clave"}</button>
              </div>
            ))}
          </section>
        )}

        {mode === "nube" && (
          <section style={{ ...box, background: "var(--ink)", color: "var(--on-ink)" }}>
            <h2 style={h2}>Despliegue en tu nube</h2>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", opacity: 0.75 }}>Conecta tu suscripción de Azure OpenAI, Amazon Bedrock o Google Vertex AI. Tu gestor de cuenta te acompaña en la configuración.</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{[["azure", "Azure OpenAI"], ["aws", "Amazon Bedrock"], ["googlevertex", "Vertex AI"]].map(([l, n]) => (<span key={l} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "800px", background: "var(--paper)", color: "var(--ink)", fontSize: "13px" }}><img src={`/logos/${l}.svg`} alt="" width="18" height="18" />{n}</span>))}</div>
          </section>
        )}

        <section style={{ ...box, padding: 0, gap: 0, overflowX: "auto" }}>
          <div style={{ padding: "20px 24px" }}><h2 style={h2}>Modelo por agente</h2></div>
          <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px" }}>
            <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th style={{ padding: "12px 24px", fontWeight: 500 }}>Agente</th><th style={{ padding: "12px", fontWeight: 500 }}>Modelo</th><th style={{ padding: "12px 24px", fontWeight: 500 }}>Recomendación</th></tr></thead>
            <tbody>
              {AGENTS.map(([name, color, , tip], i) => (
                <tr key={name} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "12px 24px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><span style={{ width: "10px", height: "10px", borderRadius: "800px", background: color }} />{name}</span></td>
                  <td style={{ padding: "8px 12px" }}>
                    <label style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }} htmlFor={`m-${i}`}>Modelo de {name}</label>
                    <select id={`m-${i}`} value={models[i]} onChange={(e) => setModels(models.map((m, j) => (j === i ? e.target.value : m)))} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/20px var(--font-display)" }}>{OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>
                  </td>
                  <td style={{ padding: "12px 24px", ...muted }}>{tip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ ...box, gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={h2}>Modelos permitidos</h2>
            <span style={{ fontSize: "13px", ...muted }}>{enabled.size} activados · el enrutador elige el mejor por tarea</span>
          </div>
          {CATALOG.map((g) => (
            <div key={g.region} style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{g.region}</span>
                <span style={{ fontSize: "12px", ...muted }}>{g.note}</span>
                {g.region === "Operado en la UE" && <span style={{ padding: "1px 8px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "11px" }}>Recomendado</span>}
              </div>
              {g.providers.map((p) => (
                <div key={p.name} style={{ border: "1px solid var(--line-soft)", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--paper-2a)", borderBottom: "1px solid var(--line-soft)" }}>
                    {p.logo ? <img src={`/logos/${p.logo}.svg`} alt="" width="18" height="18" style={{ borderRadius: "4px" }} /> : <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 600 }}>{p.name[0]}</span>}
                    <span style={{ fontSize: "14px", fontWeight: 500, flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: "12px", ...muted }}>{count(p)}/{p.models.length} activados</span>
                  </div>
                  {p.models.map((m) => {
                    const [label, bg, fg] = TYPES[m.type];
                    const on = enabled.has(m.id);
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderTop: "1px solid var(--tint-a)", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 150px", fontSize: "14px", fontWeight: 500 }}>{m.n}</span>
                        <span style={{ padding: "2px 9px", borderRadius: "800px", background: bg, color: fg, fontSize: "11px", lineHeight: "16px", flex: "none" }}>{label}</span>
                        <span style={{ fontSize: "12px", width: "56px", textAlign: "right", ...muted }}>{m.ctx}</span>
                        <span style={{ fontSize: "12px", width: "120px", textAlign: "right", ...muted }}>{m.out ? `${m.in} / ${m.out}` : m.in}<span style={{ fontSize: "10px" }}> €/M</span></span>
                        <Switch label={`Activar ${m.n}`} on={on} onClick={() => toggleModel(m.id)} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
          <span style={{ fontSize: "12px", ...muted }}>Precios de referencia por millón de tokens (entrada / salida), orientativos. «Gestionar acceso» por grupo disponible en Enterprise.</span>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <section style={box}>
            <h2 style={h2}>Privacidad y continuidad</h2>
            {[
              ["Solo regiones de la UE", "Usa únicamente modelos alojados en la Unión Europea.", euOnly, () => setEuOnly(!euOnly)],
              ["Cambio automático si un proveedor falla", "Pasa a un modelo equivalente de otro proveedor.", fallback, () => setFallback(!fallback)],
              ["Enmascarar datos personales", "Oculta DNI, teléfonos y tarjetas antes de enviarlos al modelo.", mask, () => setMask(!mask)],
            ].map(([t, d, on, fn]) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "14px", lineHeight: "20px" }}><span style={{ fontWeight: 500 }}>{t}</span><span style={muted}>{d}</span></span>
                <Switch label={t} on={on} onClick={fn} />
              </div>
            ))}
          </section>
          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}><h2 style={h2}>Consumo de IA este mes</h2><span style={{ fontSize: "14px" }}><strong style={{ fontWeight: 500 }}>128 €</strong><span style={muted}> de 300 € incluidos</span></span></div>
            <div aria-hidden="true" style={{ height: "10px", borderRadius: "800px", background: "var(--sunken)", display: "flex", overflow: "hidden" }}>{USAGE.map(([n, pct, c]) => (<span key={n} style={{ width: `${pct * 0.62}%`, background: c }} />))}</div>
            {USAGE.map(([n, pct, c, eur]) => (<div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "20px" }}><span style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "8px", height: "8px", borderRadius: "800px", background: c }} />{n}</span><span style={muted}>{eur} · {pct} %</span></div>))}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
              <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>Tope de gasto</span><span style={{ fontSize: "13px", ...muted }}>300 €/mes · aviso al 80 %. Al llegar, pasa al equipo.</span></span>
              <button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 13px/18px var(--font-display)", cursor: "pointer" }}>Cambiar</button>
            </div>
            <a href="/plataforma/configuracion/plan" style={{ fontSize: "14px", color: "var(--blue-fg)" }}>Ver plan y consumo →</a>
          </section>
        </div>
      </main>
    </div>
  );
}
