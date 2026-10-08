"use client";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { pageData } from "@/components/sede-data";

// Leads por sede (ver sede-data). «Todas las sedes» une las columnas de cada sede.
export default function Screen() {
  const { sede } = useSede();
  const d = pageData("leads", sede);
  const colBg = "#ebebed";
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="leads" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Leads. <span style={{ color: "#5f5f63" }}>{d.open} oportunidades abiertas · {d.budget} en presupuestos.</span></h1>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "14px", lineHeight: "14px" }}><span style={{ padding: "9px 14px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Todos los orígenes</span><span style={{ padding: "9px 14px", borderRadius: "800px", background: "#ffffff" }}>WhatsApp</span><span style={{ padding: "9px 14px", borderRadius: "800px", background: "#ffffff" }}>Web</span><span style={{ padding: "9px 14px", borderRadius: "800px", background: "#ffffff" }}>Instagram</span></div>
        </div>

        <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${d.columns.length}, minmax(240px, 1fr))`, gap: "16px", minWidth: "1000px", fontSize: "14px", lineHeight: "21px" }}>
            {d.columns.map((col) => (
              <section key={col.title} style={{ background: colBg, borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px" }}><span style={{ fontWeight: "500" }}>{col.title}</span><span style={{ color: "#5f5f63" }}>{col.count}</span></div>
                {col.cards.map((c, i) =>
                  c.won ? (
                    <div key={i} style={{ background: "#a30042", color: "#ffffff", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ opacity: ".75" }}>{c.label}</span><span style={{ fontSize: "24px", lineHeight: "26px", letterSpacing: "-0.48px" }}>{c.value}</span></div>
                  ) : (
                    <div key={i} style={{ background: "#ffffff", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "500" }}>{c.name}</span>{c.pill ? <span style={{ padding: "0 8px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "20px" }}>{c.pill}</span> : null}</span>
                      <span style={{ color: "#5f5f63" }}>{c.sub}</span>
                      {c.tag ? <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "800px", background: c.tagBg, color: c.tagFg, fontSize: "12px" }}>{c.tag}</span> : null}
                      {c.note ? <span style={{ fontSize: "12px", color: "#6b6b70" }}>{c.note}</span> : null}
                      {c.via && c.when ? <span style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b6b70" }}><span>{c.via}</span><span>{c.when}</span></span> : null}
                      {c.via && !c.when && !c.tag && !c.note ? <span style={{ fontSize: "12px", color: "#6b6b70" }}>{c.via}</span> : null}
                      {c.sede ? <span style={{ fontSize: "12px", color: "#6b6b70" }}>{c.sede}</span> : null}
                    </div>
                  )
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
