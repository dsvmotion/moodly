"use client";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { pageData } from "@/components/sede-data";

// Clientes por sede (ver sede-data). «Todas las sedes» une las fichas de cada sede.
export default function Screen() {
  const { sede } = useSede();
  const d = pageData("clientes", sede);
  const det = d.detail;
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="clientes" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Clientes. <span style={{ color: "#5f5f63" }}>{d.count} fichas, actualizadas por tus agentes.</span></h1>
          <div style={{ display: "flex", gap: "8px" }}><a href="/plataforma/privacidad" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/21px var(--font-display)", textDecoration: "none" }}>Privacidad (RGPD)</a><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Añadir cliente</button></div>
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "2 1 380px", minWidth: "0", background: "#ffffff", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid #0000000f" }}>
              <label htmlFor="buscar-cli" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar cliente</label>
              <input id="buscar-cli" type="search" placeholder="Buscar por nombre, teléfono o email" style={{ padding: "11px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#f4f4f5", font: "400 14px/21px var(--font-display)", color: "#000000" }} />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "14px", lineHeight: "14px" }}><span style={{ padding: "8px 12px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Todos</span><span style={{ padding: "8px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Con cita próxima</span><span style={{ padding: "8px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Sin venir 6+ meses</span><span style={{ padding: "8px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Presupuesto pendiente</span></div>
            </div>
            <div style={{ fontSize: "14px", lineHeight: "21px" }}>
              {d.list.map((c, i) => (
                <a key={i} href="#" data-demo="" style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 16px", background: c.active ? "#0000000d" : "transparent", borderTop: i === 0 ? "none" : "1px solid #0000000f", textDecoration: "none", color: "#000000" }}>
                  <span style={{ width: "36px", height: "36px", borderRadius: "800px", background: c.color, boxShadow: c.color === "#f6f2e8" ? "inset 0 0 0 1px #0000001a" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500", flex: "none" }}>{c.initials}</span>
                  <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontWeight: "500" }}>{c.name}</span><span style={{ display: "block", fontSize: "12px", color: "#6b6b70" }}>{c.sub}{c.sede ? ` · ${c.sede}` : ""}</span></span>
                  {c.flag ? <span style={{ padding: "2px 8px", borderRadius: "800px", background: "#ffe8d6", color: "#8e4e00", fontSize: "12px" }}>{c.flag}</span> : null}
                </a>
              ))}
            </div>
          </section>

          <section style={{ flex: "3 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ width: "64px", height: "64px", borderRadius: "800px", background: det.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "500" }}>{det.initials}</span>
              <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{det.name}</span>
                <span style={{ color: "#5f5f63" }}>{det.meta}</span>
                <span style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>{det.tags.map((t, i) => (<span key={i} style={{ padding: "4px 10px", borderRadius: "800px", background: i === 0 ? "#dcebdd" : "#f4f4f5", color: i === 0 ? "#004c39" : "#000000", fontSize: "12px" }}>{t}</span>))}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}><a href="/plataforma/conversaciones" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", fontSize: "14px", lineHeight: "21px", textDecoration: "none", color: "#000000" }}>Escribir</a><a href="/plataforma/agenda" style={{ padding: "10px 16px", borderRadius: "800px", background: "#000000", color: "#ffffff", fontSize: "14px", lineHeight: "21px", textDecoration: "none" }}>Nueva cita</a></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              {Object.entries(det.stats).map(([k, v]) => (
                <div key={k} style={{ background: "#ffffff", borderRadius: "12px", padding: "16px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>{k}</span><span style={{ fontSize: "24px", letterSpacing: "-0.48px" }}>{v}</span></div>
              ))}
            </div>

            <div style={{ background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Historial</h2>
              {det.history.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", padding: "12px 0", borderTop: "1px solid #0000000f" }}><span style={{ width: "10px", height: "10px", marginTop: "6px", borderRadius: "800px", background: h.color, flex: "none" }}></span><span style={{ flex: "1" }}>{h.text}</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>{h.time}</span></div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
