"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import ModelosTabs from "@/components/modelos-tabs";

// A1 — Proveedores y vías de servicio (ADR 0019). Por cada proveedor de IA se
// elige CÓMO se sirve: gestionado por Moodly (multi-región), BYOK (claves del
// cliente) o nube propia (Bedrock/Vertex/Azure en su cuenta). La residencia es
// una política por tenant (ver /plataforma/residencia), no un límite global.
// TODO(backend): model_providers + provider_connections(modo, vía, región);
// secretos en KMS (envelope encryption). Medición por vía en agent_runs.
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const MODES = [
  { id: "managed", label: "Gestionado por Moodly", desc: "Nosotros ponemos las claves y la infraestructura. Multi-región." },
  { id: "byok", label: "BYOK (tus claves)", desc: "Tus claves del proveedor, cifradas con KMS. Pagas la IA a tu proveedor." },
  { id: "byoc", label: "Tu nube", desc: "Bedrock / Vertex / Azure en tu cuenta y tu región. Enterprise." },
];

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", logo: "anthropic", models: "Claude Haiku · Sonnet · Opus", vias: ["API directa", "AWS Bedrock", "Google Vertex"], regions: ["UE (Fráncfort, Irlanda)", "EE. UU.", "Asia-Pacífico"], mode: "managed", status: "active" },
  { id: "openai", name: "OpenAI", logo: "openai", models: "GPT-5.6 · GPT-6", vias: ["API directa", "Azure OpenAI"], regions: ["UE (Suecia, Francia)", "EE. UU."], mode: "managed", status: "active" },
  { id: "google", name: "Google", logo: "googlegemini", models: "Gemini 3.x", vias: ["Google AI", "Google Vertex"], regions: ["UE (Bélgica)", "EE. UU.", "Global"], mode: "managed", status: "active" },
  { id: "mistral", name: "Mistral AI", logo: "mistralai", models: "Large · Small · Devstral", vias: ["La Plateforme (UE)", "Bedrock", "Vertex"], regions: ["UE (París)"], mode: "managed", status: "active" },
  { id: "cartesia", name: "Cartesia (voz)", logo: "", models: "Sonic · clonación", vias: ["API", "On-prem UE"], regions: ["UE", "EE. UU."], mode: "managed", status: "active" },
];

export default function Proveedores() {
  const [prov, setProv] = useState(PROVIDERS);
  const setMode = (id, mode) => setProv((p) => p.map((x) => (x.id === id ? { ...x, mode, status: mode === "managed" ? "active" : "pending" } : x)));

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Proveedores y vías de servicio</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>Elige cómo se sirve cada proveedor: gestionado por nosotros, con tus claves o en tu propia nube. Dónde se procesan los datos lo decide tu <a href="/plataforma/residencia" style={{ color: "var(--blue-fg)" }}>política de residencia</a>.</span>
        </div>

        <ModelosTabs active="proveedores" />

        <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "var(--slate-bg)", color: "var(--slate-fg)", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)", flexWrap: "wrap" }}>
          <span aria-hidden="true">🌍</span>
          <span style={{ flex: "1 1 240px", minWidth: 0 }}>Residencia actual: <strong style={{ fontWeight: 500 }}>Sin restricción</strong> — máxima disponibilidad y mejor coste. El enrutador elige región por calidad, latencia y coste.</span>
          <a href="/plataforma/residencia" style={{ ...btnLight, padding: "7px 12px", flex: "none" }}>Cambiar</a>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {prov.map((p) => (
            <section key={p.id} style={{ ...box, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "center", minWidth: 0 }}>
                  <span style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "15px", fontWeight: 500 }}>{p.logo ? <img src={`/logos/${p.logo}.svg`} alt="" width="24" height="24" /> : p.name[0]}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <span style={{ fontSize: "16px", fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: "13px", ...muted }}>{p.models}</span>
                  </div>
                </div>
                <span style={{ padding: "4px 11px", borderRadius: "800px", fontSize: "12px", flex: "none", ...(p.status === "active" ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }) }}>{p.status === "active" ? "✓ Activo" : "Falta conectar"}</span>
              </div>

              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "13px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontSize: "12px", ...muted }}>Vías disponibles</span>
                  <span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{p.vias.map((v) => <span key={v} style={{ padding: "3px 10px", borderRadius: "800px", background: "var(--canvas)", fontSize: "12px" }}>{v}</span>)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontSize: "12px", ...muted }}>Regiones</span>
                  <span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{p.regions.map((r) => <span key={r} style={{ padding: "3px 10px", borderRadius: "800px", background: "var(--canvas)", fontSize: "12px" }}>{r}</span>)}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "12px", ...muted }}>Modo de conexión</span>
                <div role="radiogroup" aria-label={`Modo de ${p.name}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                  {MODES.map((m) => {
                    const sel = p.mode === m.id;
                    return (
                      <button key={m.id} type="button" role="radio" aria-checked={sel} onClick={() => setMode(p.id, m.id)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: "10px", border: "1px solid", borderColor: sel ? "var(--ink)" : "var(--line)", background: sel ? "var(--paper-2a)" : "var(--paper)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px", outline: sel ? "1px solid var(--ink)" : "none" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500 }}>{m.label}</span>
                        <span style={{ fontSize: "12px", lineHeight: "17px", color: "var(--muted-2)", fontFamily: "var(--font-body)" }}>{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {p.mode !== "managed" && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
                  <span style={{ fontSize: "13px", ...muted }}>{p.mode === "byok" ? "Pega tu clave del proveedor; se cifra con KMS y no se muestra nunca." : "Conecta un rol de tu cuenta (AWS/GCP/Azure) y elige la región."}</span>
                  <a href={p.mode === "byok" ? `/plataforma/byok?prov=${p.id}` : `/plataforma/byok?prov=${p.id}&byoc=1`} style={{ ...btnDark, flex: "none", textDecoration: "none" }}>{p.mode === "byok" ? "Conectar clave" : "Conectar nube"}</a>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
