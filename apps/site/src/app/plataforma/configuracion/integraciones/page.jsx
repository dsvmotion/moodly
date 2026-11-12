"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import { ALL, INITIAL } from "@/components/integrations-data";

// Integraciones con estado local (prototipo). TODO(backend): OAuth real y estado en `integrations`.
const CATS = ["Todas", "Mensajería", "Calendario", "Email", "CRM", "Facturación", "Reseñas", "Almacenamiento", "Voz"];

const btn = (dark) => ({ padding: "8px 14px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "400 14px/20px var(--font-display)", cursor: "pointer" });
const h2s = { margin: 0, fontSize: "18px", lineHeight: "19.8px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "var(--muted)" };

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ flex: "none", width: "40px", height: "24px", borderRadius: "800px", border: 0, padding: "3px", background: on ? "#2457f5" : "var(--track-2)", cursor: "pointer", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)" }} />
    </button>
  );
}

export default function Integraciones() {
  const [state, setState] = useState(INITIAL);
  const [suite, setSuite] = useState("google");
  const [newActions, setNewActions] = useState(true);
  const [cat, setCat] = useState("Todas");
  const set = (id, v) => setState((s) => ({ ...s, [id]: v }));
  const connected = ALL.filter((i) => state[i.id]);
  const available = ALL.filter((i) => !state[i.id] && (cat === "Todas" || i.cat === cat));
  const broken = ALL.filter((i) => state[i.id] === "error");

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="integraciones" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "21px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px", maxWidth: "720px" }}>Integraciones. <span style={muted}>Las herramientas donde trabajan tus agentes, y qué pueden hacer en cada una.</span></h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><a href="/plataforma/conectar" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Conectar un canal</a></div>

        {broken.map((i) => (
          <div key={i.id} role="alert" style={{ borderRadius: "12px", background: "var(--rose-bg)", color: "var(--rose-fg)", padding: "14px 20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 320px" }}><strong style={{ fontWeight: 500 }}>× {i.name} se ha desconectado.</strong> {i.agents} no puede usarla hasta que la reconectes.</span>
            <a href={`/plataforma/configuracion/integraciones/detalle?i=${i.id}`} style={{ ...btn(true), textDecoration: "none" }}>Reconectar</a>
          </div>
        ))}

        <section style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2 style={h2s}>Conjunto por defecto</h2>
            <span style={{ fontSize: "13px", ...muted }}>La base que se propone a cada agente nuevo. Puedes cambiar integraciones sueltas después.</span>
          </div>
          <div role="radiogroup" aria-label="Conjunto por defecto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
            {[["google", "Google Workspace", "Gmail, Calendar, Drive"], ["microsoft", "Microsoft 365", "Outlook, OneDrive"], ["none", "Ninguno", "Eliges una a una"]].map(([id, t, d]) => (
              <button key={id} type="button" role="radio" aria-checked={suite === id} onClick={() => setSuite(id)} style={{ textAlign: "left", padding: "14px 16px", borderRadius: "12px", border: suite === id ? "1px solid var(--blue-fg)" : "1px solid var(--line)", background: suite === id ? "var(--blue-bg)" : "var(--paper)", color: "var(--ink)", font: "400 14px/20px var(--font-display)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 500 }}>{t}</span><span style={muted}>{d}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
            <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>Nuevas acciones activadas por defecto</span><span style={{ fontSize: "13px", ...muted }}>Cuando una integración añade una acción, queda disponible sin revisión.</span></span>
            <Switch label="Nuevas acciones por defecto" on={newActions} onClick={() => setNewActions(!newActions)} />
          </div>
        </section>

        <h2 style={{ ...h2s, marginTop: "4px" }}>{`Conectadas · ${connected.length}`}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {connected.map((i) => (
            <div key={i.id} style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: state[i.id] === "error" ? "inset 0 0 0 1px var(--rose-fg)" : "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 500 }}>{i.logo ? <img src={`/logos/${i.logo}`} alt="" width="24" height="24" style={{ objectFit: "contain", borderRadius: "4px" }} /> : i.name[0]}</span>
                {state[i.id] === "error"
                  ? <span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--rose-bg)", color: "var(--rose-fg)", fontSize: "12px" }}>× Desconectada</span>
                  : <span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>● Conectada</span>}
              </span>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>{i.name}</span>
              <span style={{ ...muted }}>{i.use}</span>
              <span style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "var(--paper-2b)", fontSize: "13px", lineHeight: "19px" }}><span aria-hidden="true">⚡</span><span><span style={{ color: "var(--muted-2)" }}>El agente puede:</span> {i.actions}</span></span>
              <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{`La usa: ${i.agents}`}</span>
              <span style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                {state[i.id] === "error"
                  ? <a href={`/plataforma/configuracion/integraciones/detalle?i=${i.id}`} style={{ ...btn(true), textDecoration: "none" }}>Reconectar</a>
                  : <a href={`/plataforma/configuracion/integraciones/detalle?i=${i.id}`} style={{ ...btn(false), textDecoration: "none" }}>Gestionar</a>}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
          <h2 style={h2s}>{`Disponibles · ${ALL.length - connected.length}`}</h2>
          <a href="/es/integraciones" style={{ color: "var(--blue-fg)" }}>Ver las 121 integraciones →</a>
        </div>
        <div role="tablist" aria-label="Categorías" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} style={{ padding: "8px 14px", borderRadius: "800px", border: cat === c ? "1px solid var(--ink)" : "1px solid var(--line)", background: cat === c ? "var(--ink)" : "var(--paper)", color: cat === c ? "var(--on-ink)" : "var(--ink)", font: "400 14px/18px var(--font-display)", cursor: "pointer" }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {available.map((i) => (
            <div key={i.id} style={{ background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              {i.logo ? <img src={`/logos/${i.logo}`} alt="" width="26" height="26" style={{ objectFit: "contain", borderRadius: "4px", flex: "none" }} /> : <span aria-hidden="true" style={{ width: "26px", height: "26px", borderRadius: "4px", background: "var(--sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flex: "none" }}>{i.name[0]}</span>}
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>{i.name}</span><span style={{ fontSize: "12px", color: "var(--muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.actions}</span></span>
              <button type="button" onClick={() => set(i.id, "on")} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>Conectar</button>
            </div>
          ))}
        </div>

        <section style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", paddingBottom: "8px" }}><h2 style={h2s}>Plantillas de WhatsApp</h2><span style={{ color: "var(--muted-2)" }}>Meta revisa cada plantilla antes de poder usarla</span></div>
          {[["Recordatorio de cita 24 h", true], ["Factura disponible", true], ["Hueco libre para lista de espera", false]].map(([n, ok]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}><span>{n}</span><span style={{ padding: "2px 10px", borderRadius: "800px", background: ok ? "var(--green-bg)" : "var(--amber-bg)", color: ok ? "var(--green-fg)" : "var(--amber-fg)", fontSize: "12px" }}>{ok ? "✓ Aprobada" : "En revisión"}</span></div>
          ))}
        </section>
      </main>
    </div>
  );
}
