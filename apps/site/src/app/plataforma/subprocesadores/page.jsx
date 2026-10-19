"use client";
import { useState } from "react";
import SettingsNav from "@/components/settings-nav";
import ModelosTabs from "@/components/modelos-tabs";

// A9 — DPA y lista de subencargados (ADR 0019; MANUAL §11). Aceptar el DPA (🔒) y
// ver la lista pública de subencargados, que se genera según los proveedores,
// vías y regiones activos del tenant. Compliance como producto.
// TODO(backend): dpa_acceptances(versión, fecha, quién) en audit_logs; la lista
// se deriva de provider_connections + integrations activas; versión del DPA
// cambia → re-aceptación.
const CARD = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

// Derivada de los proveedores/vías activos (aquí fija para el prototipo).
const SUBS = [
  { name: "Supabase", purpose: "Alojamiento de base de datos y ficheros", loc: "UE · Fráncfort", kind: "Infraestructura" },
  { name: "Railway", purpose: "Worker y colas", loc: "UE", kind: "Infraestructura" },
  { name: "Meta (WhatsApp)", purpose: "Canal de mensajería", loc: "UE / EE. UU.", kind: "Canal" },
  { name: "Anthropic (vía AWS Bedrock)", purpose: "Modelos de lenguaje", loc: "UE · Fráncfort", kind: "Modelo" },
  { name: "OpenAI (vía Azure)", purpose: "Modelos de lenguaje", loc: "UE · Suecia", kind: "Modelo" },
  { name: "Google (vía Vertex)", purpose: "Modelos de lenguaje", loc: "UE · Bélgica", kind: "Modelo" },
  { name: "Cartesia", purpose: "Síntesis y clonación de voz", loc: "UE", kind: "Voz" },
];
const KIND_COLOR = { Infraestructura: ["var(--slate-bg)", "var(--slate-fg)"], Canal: ["var(--blue-bg)", "var(--blue-fg)"], Modelo: ["var(--violet-bg-2)", "var(--violet-fg)"], Voz: ["var(--rose-bg)", "var(--rose-fg)"] };

export default function Subprocesadores() {
  const [dpa, setDpa] = useState("pending"); // pending | confirming | accepted

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="modelos" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Protección de datos (RGPD)</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>El acuerdo de tratamiento (DPA) y la lista de subencargados que tratan datos por ti. La lista se actualiza sola según los proveedores y regiones que tengas activos.</span>
        </div>
        <ModelosTabs active="datos" />

        <section style={{ ...CARD, padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", minWidth: 0 }}>
            <span style={{ width: "42px", height: "42px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "18px", ...(dpa === "accepted" ? { background: "var(--green-bg)", color: "var(--green-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }) }} aria-hidden="true">{dpa === "accepted" ? "✓" : "§"}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
              <span style={{ fontSize: "16px", fontWeight: 500 }}>Acuerdo de tratamiento de datos (DPA)</span>
              <span style={{ fontSize: "13px", ...muted }}>{dpa === "accepted" ? "Aceptado el 14 oct 2026 por Marta Ruiz · versión 2026-10" : "Pendiente de aceptar · versión 2026-10"}</span>
            </div>
          </div>
          {dpa === "accepted" ? <a href="#" data-demo="" style={{ ...btnLight, flex: "none", textDecoration: "none" }}>Descargar PDF</a> : <button type="button" onClick={() => setDpa("confirming")} style={{ ...btnDark, flex: "none" }}>Revisar y aceptar</button>}
        </section>

        <section style={{ ...CARD, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>Subencargados ({SUBS.length})</span>
            <span style={{ fontSize: "12px", ...muted }}>Residencia: sin restricción · <a href="/plataforma/residencia" style={{ color: "var(--blue-fg)" }}>cambiar</a></span>
          </div>
          {SUBS.map((s, i) => {
            const k = KIND_COLOR[s.kind];
            return (
              <div key={s.name} style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line-soft)" : 0, display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: "1 1 240px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: "13px", ...muted }}>{s.purpose}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "none" }}>
                  <span style={{ padding: "3px 10px", borderRadius: "800px", background: k[0], color: k[1], fontSize: "12px" }}>{s.kind}</span>
                  <span style={{ fontSize: "13px", ...muted, minWidth: "96px", textAlign: "right" }}>{s.loc}</span>
                </div>
              </div>
            );
          })}
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", fontSize: "12px", lineHeight: "18px", ...muted }}>Si activas un proveedor o una región nueva (p. ej. BYOC o «solo EE. UU.»), la lista y el DPA se actualizan y puede requerirse volver a aceptar.</div>
        </section>
      </main>

      {dpa === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Aceptar DPA" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setDpa("pending")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "440px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>Aceptar el DPA (versión 2026-10)</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Confirmas el acuerdo de tratamiento de datos y la lista de subencargados actual. Queda registrado con tu nombre, la versión y la fecha.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={() => setDpa("pending")} style={btnLight}>Cancelar</button>
              <button type="button" onClick={() => setDpa("accepted")} style={btnDark}>Acepto el DPA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
