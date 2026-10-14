"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";

// A3 — Nube del cliente (BYOC) de extremo a extremo (ADR 0019). Conectar un rol
// de la cuenta del cliente (Bedrock / Vertex / Azure), elegir región y qué
// modelos de esa cuenta se exponen. Los modelos corren en su nube y su región.
// TODO(backend): provider_connections(modo='byoc', vía, región, rol); credencial
// en KMS; validación = llamada de prueba por cada modelo expuesto; health check.
const CARD = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "12px 20px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "12px 20px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const H = { margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" };
const SUB = { fontSize: "15px", lineHeight: "23px", ...muted };
const field = { padding: "11px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000", width: "100%", boxSizing: "border-box" };

const CLOUDS = {
  bedrock: { name: "AWS Bedrock", logo: "aws", cred: "ARN del rol IAM", ph: "arn:aws:iam::123456789012:role/moodly-bedrock", regions: ["eu-central-1 · Fráncfort", "eu-west-1 · Irlanda", "us-east-1 · Virginia"], models: ["Claude Haiku 5.5", "Claude Sonnet 5.5", "Claude Opus 5.5", "Mistral Large", "Llama 4"] },
  vertex: { name: "Google Vertex", logo: "googlecloud", cred: "Cuenta de servicio", ph: "moodly@tu-proyecto.iam.gserviceaccount.com", regions: ["europe-west1 · Bélgica", "europe-west4 · Países Bajos", "us-central1 · Iowa"], models: ["Gemini 3.1 Pro", "Gemini 3.5 Flash", "Claude Sonnet 5.5", "Mistral Large"] },
  azure: { name: "Azure OpenAI", logo: "azure", cred: "Endpoint + clave", ph: "https://tu-recurso.openai.azure.com", regions: ["swedencentral · Suecia", "francecentral · Francia", "eastus · EE. UU."], models: ["GPT-5.6 Luna", "GPT-5.6 Terra", "GPT-5.6 Sol", "GPT-6 Astra"] },
};
const STEP_LABELS = ["Nube y región", "Credenciales", "Modelos", "Listo"];

export default function Nube() {
  const [step, setStep] = useState(1);
  const [cloud, setCloud] = useState("bedrock");
  const [region, setRegion] = useState("eu-central-1 · Fráncfort");
  const [models, setModels] = useState(["Claude Haiku 5.5", "Claude Sonnet 5.5"]);
  const [phase, setPhase] = useState("idle"); // idle | testing | error | done
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const c = CLOUDS[cloud];
  const pickCloud = (id) => { setCloud(id); setRegion(CLOUDS[id].regions[0]); setModels(CLOUDS[id].models.slice(0, 2)); };
  const toggle = (m) => setModels((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  const validate = () => { setPhase("testing"); setTimeout(() => { setPhase("done"); setStep(4); }, reduced.current ? 0 : 1500); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@keyframes mo-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}.mo-rise{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="configuracion" /></div>
      <main style={{ flex: "999 1 460px", minWidth: 0, maxWidth: "820px", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <a href="/plataforma/proveedores" style={{ fontSize: "14px", color: "#5f5f63" }}>‹ Proveedores y vías</a>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "13px" }}>
            {STEP_LABELS.map((l, i) => { const n = i + 1; const cur = step === n; const done = step > n; return <li key={l} aria-current={cur ? "step" : undefined} style={{ padding: "6px 12px", borderRadius: "800px", ...(cur ? { background: "#000000", color: "#ffffff" } : done ? { background: "#dcebdd", color: "#004c39" } : { boxShadow: "inset 0 0 0 1px #0000001a", color: "#5f5f63" }) }}>{done ? "✓" : n} · {l}</li>; })}
          </ol>
        </div>

        {step === 1 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Conecta tu nube</h1><span style={SUB}>Los modelos correrán en tu cuenta y tu región; nosotros solo orquestamos. Pagas la IA a tu proveedor de nube.</span></div>
            <div role="radiogroup" aria-label="Nube" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {Object.entries(CLOUDS).map(([id, x]) => {
                const seld = cloud === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={seld} onClick={() => pickCloud(id)} style={{ ...CARD, textAlign: "left", padding: "18px", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer", borderColor: seld ? "#000000" : "#0000001a", outline: seld ? "1px solid #000000" : "none" }}>
                    <span style={{ fontSize: "15px", fontWeight: 500 }}>{x.name}</span>
                    <span style={{ fontSize: "12px", ...muted }}>{x.models.length} modelos · {x.regions.length} regiones</span>
                  </button>
                );
              })}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63", maxWidth: "360px" }}>Región<select value={region} onChange={(e) => setRegion(e.target.value)} style={field}>{c.regions.map((r) => <option key={r}>{r}</option>)}</select></label>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={() => setStep(2)} style={btnDark}>Continuar</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Credenciales de {c.name}</h1><span style={SUB}>Damos acceso de solo-inferencia con los permisos mínimos. Se cifra con KMS y no se muestra.</span></div>
            <div style={{ ...CARD, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>{c.cred}<input placeholder={c.ph} style={field} /></label>
              {cloud === "azure" && <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Clave<input type="password" placeholder="••••••••" style={field} /></label>}
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "#f6f2e8", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span aria-hidden="true">🔒</span><span>Región elegida: <strong style={{ fontWeight: 500 }}>{region}</strong>. Todo el procesado se queda ahí; tu política de residencia lo verifica.</span></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}><button type="button" onClick={() => setStep(1)} style={btnLight}>Atrás</button><button type="button" onClick={() => setStep(3)} style={btnDark}>Continuar</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h1 style={H}>Qué modelos exponemos</h1><span style={SUB}>Solo los que marques estarán disponibles para tus agentes. Validamos cada uno con una llamada de prueba.</span></div>
            <div style={{ ...CARD, overflow: "hidden" }}>
              {c.models.map((m, i) => {
                const on = models.includes(m);
                return (
                  <label key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 20px", borderTop: i ? "1px solid #0000000f" : 0, cursor: "pointer" }}>
                    <span style={{ fontSize: "14px" }}>{m}</span>
                    <input type="checkbox" checked={on} onChange={() => toggle(m)} />
                  </label>
                );
              })}
            </div>
            {phase === "error" && <div role="alert" style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "#fbe1ea", color: "#a30042", fontSize: "14px" }}><span>×</span><span>El rol no tiene acceso a alguno de los modelos. Revisa los permisos en tu nube.</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setStep(2)} style={btnLight}>Atrás</button>
              <button type="button" disabled={phase === "testing" || models.length === 0} onClick={validate} style={{ ...btnDark, opacity: phase === "testing" || models.length === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>{phase === "testing" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid #ffffff55", borderTopColor: "#ffffff", animation: "mo-spin .7s linear infinite" }} />Validando {models.length} modelos…</> : `Validar y conectar (${models.length})`}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mo-rise" style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <span style={{ width: "44px", height: "44px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flex: "none" }}>✓</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><h1 style={H}>{c.name} conectado (tu nube)</h1><span style={SUB}>{models.length} modelos operativos en {region}. Salud: correcto.</span></div>
            </div>
            <div style={{ ...CARD, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {models.map((m) => <div key={m} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "14px" }}><span>{m}</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "12px" }}>operativo</span></div>)}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}><a href="/plataforma/residencia" style={btnLight}>Ajustar residencia</a><a href="/plataforma/proveedores" style={btnDark}>Volver a proveedores</a></div>
          </div>
        )}
      </main>
    </div>
  );
}
