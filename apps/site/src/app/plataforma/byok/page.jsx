"use client";
import { useEffect, useRef, useState } from "react";
import SettingsNav from "@/components/settings-nav";

// A2 — Conectar BYOK / nube propia (ADR 0019). Pega la clave del proveedor (o
// conecta un rol de tu nube), se valida con una llamada de prueba y se guarda
// CIFRADA con KMS (clave por tenant), nunca legible desde el navegador.
// TODO(backend): provider_connections + integration_secrets (KMS envelope);
// validación = llamada de prueba real por la vía elegida; health check periódico.
const box = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const field = { padding: "11px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000", width: "100%", boxSizing: "border-box" };

const PROVIDERS = {
  anthropic: { name: "Anthropic", vias: ["API directa", "AWS Bedrock", "Google Vertex"], regions: ["UE · Fráncfort", "UE · Irlanda", "EE. UU. · Virginia", "Asia · Tokio"], hint: "sk-ant-…" },
  openai: { name: "OpenAI", vias: ["API directa", "Azure OpenAI"], regions: ["UE · Suecia", "UE · Francia", "EE. UU. · Este"], hint: "sk-…" },
  google: { name: "Google", vias: ["Google AI", "Google Vertex"], regions: ["UE · Bélgica", "EE. UU. · Iowa", "Global"], hint: "AIza…" },
  mistral: { name: "Mistral AI", vias: ["La Plateforme (UE)", "Bedrock", "Vertex"], regions: ["UE · París"], hint: "…" },
  cartesia: { name: "Cartesia", vias: ["API", "On-prem UE"], regions: ["UE", "EE. UU."], hint: "key_…" },
};

export default function Byok() {
  const [provId, setProvId] = useState("anthropic");
  const [byoc, setByoc] = useState(false);
  const [via, setVia] = useState("API directa");
  const [region, setRegion] = useState("UE · Fráncfort");
  const [key, setKey] = useState("");
  const [phase, setPhase] = useState("form"); // form | testing | error | done
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const q = new URLSearchParams(window.location.search);
    const p = q.get("prov");
    if (p && PROVIDERS[p]) { setProvId(p); setVia(PROVIDERS[p].vias[0]); setRegion(PROVIDERS[p].regions[0]); }
    if (q.get("byoc")) setByoc(true);
  }, []);

  const prov = PROVIDERS[provId];
  const validate = () => {
    setPhase("testing");
    setTimeout(() => {
      // Demo: una clave demasiado corta simula el fallo típico de credencial
      // inválida; con algo razonable, la llamada de prueba pasa.
      if (!byoc && key.trim().length < 8) setPhase("error");
      else setPhase("done");
    }, reduced.current ? 0 : 1300);
  };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@keyframes mo-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}.mo-rise{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 460px", minWidth: 0, maxWidth: "720px", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href="/plataforma/proveedores" style={{ fontSize: "14px", color: "#5f5f63" }}>‹ Proveedores y vías</a>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>{byoc ? "Conectar tu nube" : "Conectar tus claves"} · {prov.name}</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>{byoc ? "Conecta un rol de tu cuenta (Bedrock / Vertex / Azure). Los modelos corren en tu nube y tu región; nosotros solo orquestamos." : "Pega tu clave del proveedor. La validamos con una llamada de prueba y la ciframos con KMS."}</span>
        </div>

        {phase === "done" ? (
          <section className="mo-rise" style={{ ...box, padding: "24px", display: "flex", flexDirection: "column", gap: "16px", animation: "mo-rise .3s ease both" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <span style={{ width: "44px", height: "44px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flex: "none" }}>✓</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}><span style={{ fontSize: "17px", fontWeight: 500 }}>{prov.name} conectado{byoc ? " (tu nube)" : " (BYOK)"}</span><span style={{ fontSize: "14px", ...muted }}>Llamada de prueba correcta por {via} · {region}. Salud: operativo.</span></div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "#f6f2e8", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span aria-hidden="true">🔒</span><span>{byoc ? "No almacenamos tus modelos ni los datos de inferencia; corren en tu cuenta." : "Tu clave se guardó cifrada con KMS (clave por cliente). No vuelve a mostrarse; solo puedes rotarla o revocarla."}</span></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><a href="/plataforma/residencia" style={btnLight}>Ajustar residencia</a><a href="/plataforma/proveedores" style={btnDark}>Volver a proveedores</a></div>
          </section>
        ) : (
          <section style={{ ...box, padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Vía de servicio
                <select value={via} onChange={(e) => setVia(e.target.value)} style={field}>{prov.vias.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Región
                <select value={region} onChange={(e) => setRegion(e.target.value)} style={field}>{prov.regions.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
            </div>

            {byoc ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Rol / cuenta (según la vía)
                  <input placeholder={via.includes("Bedrock") ? "arn:aws:iam::123456789012:role/moodly-bedrock" : via.includes("Vertex") ? "moodly@tu-proyecto.iam.gserviceaccount.com" : "https://tu-recurso.openai.azure.com"} style={field} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Secreto / clave de acceso
                  <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="••••••••" style={field} />
                </label>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5f5f63" }}>Clave de API de {prov.name}
                <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={prov.hint} style={field} />
              </label>
            )}

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "#f6f2e8", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span aria-hidden="true">🔒</span><span>Se cifra con KMS (envelope encryption, clave por cliente) y nunca se muestra desde el navegador. Validamos con una llamada de prueba antes de guardar.</span></div>

            {phase === "error" && <div role="alert" className="mo-rise" style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "#fbe1ea", color: "#a30042", fontSize: "14px", lineHeight: "20px" }}><span>×</span><span>La llamada de prueba falló: la credencial no es válida o no tiene acceso a {via}. Revísala e inténtalo de nuevo.</span></div>}

            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #0000000f", paddingTop: "16px" }}>
              <a href="/plataforma/proveedores" style={btnLight}>Cancelar</a>
              <button type="button" disabled={phase === "testing"} onClick={validate} style={{ ...btnDark, opacity: phase === "testing" ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>{phase === "testing" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid #ffffff55", borderTopColor: "#ffffff", animation: "mo-spin .7s linear infinite" }} />Validando…</> : phase === "error" ? "Reintentar" : "Validar y guardar"}</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
