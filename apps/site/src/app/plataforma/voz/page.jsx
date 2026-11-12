"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { useAgentParam } from "@/components/agent-param";

// Flujo: alta de la voz del agente (skill de voz, llamadas y notas de voz).
// Dos modos: persona de catálogo o CLONAR la voz propia del negocio (con
// consentimiento). Proveedor agnóstico (piloto: Cartesia, UE).
// TODO(backend): voice_personas, voice_samples (audio + consentimiento +
// retención), voice_eval_runs; proveedor vía adaptador.
const PERSONAS = [
  { id: "clara", name: "Clara", meta: "Mujer · cálida y cercana", color: "#a3c2a7" },
  { id: "marco", name: "Marco", meta: "Hombre · claro y profesional", color: "#9dbecc" },
  { id: "sofia", name: "Sofía", meta: "Mujer · enérgica y joven", color: "#f6f2e8" },
  { id: "propia", name: "Vuestra voz", meta: "Clonada de un audio propio", color: "var(--green-fg)", clone: true },
];
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

function Pill({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} style={{ padding: "8px 14px", borderRadius: "800px", border: value === o ? "1px solid var(--ink)" : "1px solid var(--line)", background: value === o ? "var(--ink)" : "var(--paper)", color: value === o ? "var(--on-ink)" : "var(--ink)", font: "400 14px/18px var(--font-display)", cursor: "pointer" }}>{o}</button>
      ))}
    </div>
  );
}

export default function Voz() {
  const { key: aKey, name: aName } = useAgentParam();
  const [persona, setPersona] = useState("clara");
  const [tono, setTono] = useState("Cercano");
  const [velocidad, setVelocidad] = useState("Normal");
  const [trato, setTrato] = useState("Tú");
  const [uploaded, setUploaded] = useState(false);
  const [consent, setConsent] = useState(false);
  const p = PERSONAS.find((x) => x.id === persona);
  const isClone = p?.clone;
  const ready = !isClone || (uploaded && consent);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="agentes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "720px" }}>
          <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", fontSize: "12px" }}>{`${aName} · voz`}</span>
          <h1 style={{ margin: "6px 0 0", fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px" }}>La voz de tu negocio. <span style={{ color: "var(--muted)" }}>Cómo suena el agente al teléfono y en las notas de voz.</span></h1>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "3 1 420px", minWidth: 0 }}>
            <h2 style={h2}>Elige una voz</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
              {PERSONAS.map((x) => (
                <button key={x.id} type="button" aria-pressed={persona === x.id} onClick={() => setPersona(x.id)} style={{ textAlign: "left", padding: "16px", borderRadius: "12px", border: persona === x.id ? "2px solid var(--ink)" : "1px solid var(--line)", background: "var(--paper)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ width: "32px", height: "32px", borderRadius: "800px", background: x.color, flex: "none" }} />{x.clone && <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)" }}>Clonar</span>}</span>
                  <span><span style={{ display: "block", fontSize: "15px", fontWeight: 500 }}>{x.name}</span><span style={{ display: "block", fontSize: "12px", lineHeight: "17px", ...muted }}>{x.meta}</span></span>
                  {!x.clone && <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--blue-fg)" }}>▶ Escuchar</span>}
                </button>
              ))}
            </div>

            {isClone ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Sube 1-2 minutos de audio de la persona cuya voz usará el agente (un saludo, una llamada de ejemplo). La clonación es instantánea.</span>
                {uploaded ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "14px" }}><span>✓</span><span style={{ flex: 1 }}>recepcion-marta.m4a · 1:12</span><button type="button" onClick={() => setUploaded(false)} style={{ ...btnLight, padding: "6px 12px" }}>Quitar</button></div>
                ) : (
                  <button type="button" onClick={() => setUploaded(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "22px", borderRadius: "12px", border: "1px dashed var(--line-strong)", background: "var(--paper-2a)", color: "var(--muted)", font: "400 14px/20px var(--font-body)", cursor: "pointer" }}>⬆ Subir audio (mp3, m4a, wav)</button>
                )}
                <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", lineHeight: "19px", ...muted }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: "2px", flex: "none" }} />
                  <span>Confirmo que tengo el <strong style={{ fontWeight: 500, color: "var(--ink)" }}>consentimiento</strong> de la persona para clonar y usar su voz. Puedo borrarla cuando quiera.</span>
                </label>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "13px", ...muted }}>Tono</span><Pill label="Tono" options={["Cercano", "Neutro", "Formal"]} value={tono} onChange={setTono} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "13px", ...muted }}>Velocidad</span><Pill label="Velocidad" options={["Pausada", "Normal", "Ágil"]} value={velocidad} onChange={setVelocidad} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "13px", ...muted }}>Trato</span><Pill label="Trato" options={["Tú", "Usted"]} value={trato} onChange={setTrato} /></div>
              </div>
            )}
          </section>

          <section style={{ ...box, flex: "2 1 300px", minWidth: 0, background: "#004c39", color: "#ffffff", border: 0 }}>
            <h2 style={h2}>Pruébala</h2>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: "21px", opacity: 0.85, fontFamily: "var(--font-body)" }}>«Hola, soy de Estudio de Belleza Sol. Te llamo para confirmar tu cita del jueves a las 10:30. ¿Te viene bien?»</p>
            <button type="button" style={{ ...btnLight, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "8px" }}>▶ Escuchar prueba</button>
            <div style={{ marginTop: "auto", fontSize: "12px", lineHeight: "18px", opacity: 0.8, display: "flex", gap: "8px", alignItems: "flex-start", fontFamily: "var(--font-body)" }}><span>🔒</span><span>Voz procesada en la UE (Cartesia). El audio y las muestras se guardan cifrados y los puedes borrar.</span></div>
          </section>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: "16px" }}>
          <span style={{ fontSize: "13px", ...muted }}>{`La voz se aplica a las llamadas y notas de voz del agente de ${aName}.`}</span>
          <button type="button" disabled={!ready} style={{ ...btnDark, opacity: ready ? 1 : 0.45, cursor: ready ? "pointer" : "not-allowed" }}>{isClone ? "Clonar y activar" : "Guardar y activar"}</button>
        </div>
      </main>
    </div>
  );
}
