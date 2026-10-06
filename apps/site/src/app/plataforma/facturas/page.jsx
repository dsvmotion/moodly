"use client";
import Sidebar from "@/components/app-sidebar";
import { useSede } from "@/components/use-sede";
import { pageData } from "@/components/sede-data";

// Facturas e inventario por sede (ver sede-data). «Todas las sedes» suma los totales
// y une las tablas de facturas y el stock bajo de cada sede.
export default function Screen() {
  const { sede } = useSede();
  const d = pageData("facturas", sede);
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="facturas" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Facturas e inventario. <span style={{ color: "#5f5f63" }}>Preparado por Administración, aprobado por ti.</span></h1>
          <span style={{ display: "flex", padding: "4px", borderRadius: "800px", background: "#ffffff", fontSize: "14px", lineHeight: "20px" }}><span style={{ padding: "8px 16px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Facturas</span><span style={{ padding: "8px 16px", borderRadius: "800px" }}>Inventario</span></span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div style={{ background: "#ffe8d6", color: "#8e4e00", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px" }}>Por aprobar</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.porAprobar}</span></div>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Enviadas este mes</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.enviadas}</span></div>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Pendiente de cobro</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.pendiente}</span></div>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Cobrado este mes</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.cobrado}</span></div>
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "3 1 480px", minWidth: "0", background: "#ffffff", borderRadius: "12px", overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", gap: "12px", flexWrap: "wrap" }}><span style={{ display: "flex", gap: "6px", fontSize: "14px", lineHeight: "14px" }}><span style={{ padding: "8px 12px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Por aprobar · {d.cards.porAprobar}</span><span style={{ padding: "8px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Enviadas</span><span style={{ padding: "8px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Cobradas</span></span><button data-demo="" type="button" style={{ padding: "9px 16px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/20px var(--font-display)" }}>Aprobar las {d.cards.porAprobar}</button></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "560px" }}>
              <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "10px 20px", fontWeight: "500" }}>Factura</th><th style={{ padding: "10px", fontWeight: "500" }}>Cliente</th><th style={{ padding: "10px", fontWeight: "500" }}>Importe</th><th style={{ padding: "10px", fontWeight: "500" }}>Envío</th><th style={{ padding: "10px 20px" }}></th></tr></thead>
              <tbody>
                {d.invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: "1px solid #0000000f" }}>
                    <td style={{ padding: "12px 20px" }}>{inv.id}</td>
                    <td style={{ padding: "12px 10px" }}>{inv.client}{inv.sede ? <span style={{ color: "#6b6b70" }}> · {inv.sede}</span> : null}</td>
                    <td style={{ padding: "12px 10px" }}>{inv.amount}</td>
                    <td style={{ padding: "12px 10px", color: "#5f5f63" }}>{inv.via}</td>
                    <td style={{ padding: "12px 20px", textAlign: "right" }}><a href="/plataforma/aprobaciones" style={{ color: "#2457f5" }}>Revisar</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ flex: "2 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#8e4e00", color: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Stock bajo</h2>
              {d.stock.map((s, i) => (
                <div key={i} style={{ background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{s.name}{s.sede ? <span style={{ color: "#6b6b70", fontWeight: 400 }}> · {s.sede}</span> : null}</span><span style={{ color: s.leftColor }}>{s.left}</span></span>
                  <span style={{ height: "6px", borderRadius: "800px", background: "#ebebed" }}><span style={{ display: "block", width: `${s.pct}%`, height: "6px", borderRadius: "800px", background: s.bar }}></span></span>
                  <span style={{ color: "#5f5f63" }}>{s.note}</span>
                  {s.action ? <button data-demo="" type="button" style={{ alignSelf: "flex-start", padding: "9px 14px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/20px var(--font-display)" }}>{s.action}</button> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
