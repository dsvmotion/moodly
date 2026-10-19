"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { pageData } from "@/components/sede-data";

// Facturas e inventario por sede (ver sede-data). Vista Facturas / Inventario real;
// filtro por estado; aprobar por fila o en bloque (estado local). La factura que
// surgió en una conversación (F-0412) enlaza a su aprobación.
// TODO(backend): invoices_mirror + aprobación vía motor de políticas + audit_logs.
const VIEWS = [["facturas", "Facturas"], ["inventario", "Inventario"]];
const STATE = { ok: ["#dcebdd", "#004c39", "Bien"], atento: ["#ffe8d6", "#8e4e00", "Vigilar"], bajo: ["#fbe1ea", "#a30042", "Bajo mínimo"] };
const small = (dark) => ({ padding: "6px 12px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "500 13px/13px var(--font-display)", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" });

export default function Screen() {
  const { sede } = useSede();
  const d = pageData("facturas", sede);
  const [view, setView] = useState("facturas");
  const [tab, setTab] = useState("aprobar");
  const [over, setOver] = useState({});    // id → estado cambiado aquí
  const [ordered, setOrdered] = useState({}); // pedidos de stock aprobados

  const invoices = d.invoices.map((i) => ({ ...i, status: over[i.id] ?? i.status }));
  const count = (st) => invoices.filter((i) => i.status === st).length;
  const rows = invoices.filter((i) => i.status === tab);
  const approve = (ids) => setOver((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, "enviada"])) }));
  const TABS = [["aprobar", `Por aprobar · ${count("aprobar")}`], ["enviada", `Enviadas · ${count("enviada")}`], ["cobrada", `Cobradas · ${count("cobrada")}`]];

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="facturas" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Facturas e inventario. <span style={{ color: "#5f5f63" }}>Preparado por Administración, aprobado por ti.</span></h1>
          <Pills label="Vista" variant="segmented" options={VIEWS} value={view} onChange={setView} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <button type="button" onClick={() => { setView("facturas"); setTab("aprobar"); }} style={{ textAlign: "left", border: 0, font: "inherit", cursor: "pointer", background: "#ffe8d6", color: "#8e4e00", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px" }}>Por aprobar</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{count("aprobar")}</span></button>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Enviadas este mes</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.enviadas}</span></div>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Pendiente de cobro</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.pendiente}</span></div>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "18px" }}><span style={{ display: "block", fontSize: "12px", color: "#5f5f63" }}>Cobrado este mes</span><span style={{ fontSize: "28px", lineHeight: "32px", letterSpacing: "-0.8px" }}>{d.cards.cobrado}</span></div>
        </div>

        {view === "facturas" ? (
          <section style={{ background: "#ffffff", borderRadius: "12px", overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", gap: "12px", flexWrap: "wrap" }}>
              <Pills label="Estado de la factura" options={TABS} value={tab} onChange={setTab} size="sm" />
              {tab === "aprobar" && rows.length > 0 && <button data-demo="" type="button" onClick={() => approve(rows.map((r) => r.id))} style={{ padding: "9px 16px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>Aprobar las {rows.length}</button>}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "620px" }}>
              <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "10px 20px", fontWeight: "500" }}>Factura</th><th style={{ padding: "10px", fontWeight: "500" }}>Cliente</th><th style={{ padding: "10px", fontWeight: "500" }}>Importe</th><th style={{ padding: "10px", fontWeight: "500" }}>Envío</th><th style={{ padding: "10px", fontWeight: "500" }}>Fecha</th><th style={{ padding: "10px 20px" }}></th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} style={{ padding: "20px", color: "#5f5f63" }}>{tab === "aprobar" ? "Nada por aprobar. Todo enviado." : "No hay facturas en este estado."}</td></tr>}
                {rows.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: "1px solid #0000000f" }}>
                    <td style={{ padding: "12px 20px" }}>{inv.id}</td>
                    <td style={{ padding: "12px 10px" }}>{inv.client}{inv.sede ? <span style={{ color: "#6b6b70" }}> · {inv.sede}</span> : null}</td>
                    <td style={{ padding: "12px 10px" }}>{inv.amount}</td>
                    <td style={{ padding: "12px 10px", color: "#5f5f63" }}>{inv.via}</td>
                    <td style={{ padding: "12px 10px", color: "#5f5f63" }}>{inv.date}</td>
                    <td style={{ padding: "12px 20px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: "6px" }}>
                        {inv.approval && <a href={`/plataforma/aprobaciones?i=${inv.approval}`} style={small(false)}>Ver</a>}
                        {inv.status === "aprobar" ? <button data-demo="" type="button" onClick={() => approve([inv.id])} style={small(true)}>Aprobar</button>
                          : <button data-demo="" type="button" style={small(false)}>PDF</button>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: 0, padding: "12px 20px 16px", fontSize: "12px", color: "#6b6b70" }}>Las facturas rutinarias se aprueban aquí, en bloque. En Aprobaciones solo aparecen las que surgen de una conversación.</p>
          </section>
        ) : (
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <section style={{ flex: "3 1 480px", minWidth: "0", background: "#ffffff", borderRadius: "12px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "480px" }}>
                <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "10px 20px", fontWeight: "500" }}>Material</th><th style={{ padding: "10px", fontWeight: "500" }}>Hay</th><th style={{ padding: "10px", fontWeight: "500" }}>Mínimo</th><th style={{ padding: "10px 20px", fontWeight: "500" }}>Estado</th></tr></thead>
                <tbody>
                  {d.inventory.map((it) => { const st = STATE[it.state]; return (
                    <tr key={`${it.name}${it.sede ?? ""}`} style={{ borderTop: "1px solid #0000000f" }}>
                      <td style={{ padding: "12px 20px" }}>{it.name}{it.sede ? <span style={{ color: "#6b6b70" }}> · {it.sede}</span> : null}</td>
                      <td style={{ padding: "12px 10px" }}>{it.qty}</td>
                      <td style={{ padding: "12px 10px", color: "#5f5f63" }}>{it.min}</td>
                      <td style={{ padding: "12px 20px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: st[0], color: st[1], fontSize: "12px" }}>{st[2]}</span></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </section>
            <section style={{ flex: "2 1 320px", minWidth: "0", background: "#8e4e00", color: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Stock bajo</h2>
              {d.stock.map((s) => { const k = `${s.name}${s.sede ?? ""}`; return (
                <div key={k} style={{ background: "#ffffff", color: "#000000", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "500" }}>{s.name}{s.sede ? <span style={{ color: "#6b6b70", fontWeight: 400 }}> · {s.sede}</span> : null}</span><span style={{ color: s.leftColor }}>{s.left}</span></span>
                  <span style={{ height: "6px", borderRadius: "800px", background: "#ebebed" }}><span style={{ display: "block", width: `${s.pct}%`, height: "6px", borderRadius: "800px", background: s.bar }}></span></span>
                  <span style={{ color: "#5f5f63" }}>{s.note}</span>
                  {s.action ? (ordered[k] ? <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: "800px", background: "#dcebdd", color: "#004c39", fontSize: "13px" }}>✓ Pedido aprobado</span>
                    : <button data-demo="" type="button" onClick={() => setOrdered((o) => ({ ...o, [k]: true }))} style={{ alignSelf: "flex-start", padding: "9px 14px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/20px var(--font-display)", cursor: "pointer" }}>{s.action}</button>) : null}
                </div>
              ); })}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
