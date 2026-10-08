import SettingsShell from "@/components/settings-shell";
import { PRICING as P, eur } from "@/components/pricing";

const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const sub = { fontSize: "13px", color: "#5f5f63" };
const btn = { padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/20px var(--font-display)", cursor: "pointer" };
const INVOICES = [["Octubre 2026 (en curso)", "≈ 214,00 €", "Estimada"], ["Septiembre 2026", "198,10 €", "Pagada"], ["Agosto 2026 · prueba", "0,00 €", "Pagada"]];

export default function Facturacion() {
  return (
    <SettingsShell active="facturacion" title="Facturación." intro="Método de pago y facturas.">
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <section style={{ ...card, flex: "1 1 300px" }}>
          <h2 style={h2}>Método de pago</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "14px" }}><span style={{ width: "40px", height: "28px", borderRadius: "6px", background: "#1a1f71", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 600 }}>VISA</span><span style={{ flex: 1 }}>•••• 4242<br /><span style={sub}>Caduca 09/28</span></span></div>
          <span style={{ display: "flex", gap: "8px" }}><button type="button" data-demo="" style={btn}>Cambiar tarjeta</button></span>
          <div style={{ borderTop: "1px solid #0000000f", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={sub}>Datos de facturación</span><span>[Razón social] · NIF [NIF]</span><span style={sub}>[Dirección fiscal]</span><button type="button" data-demo="" style={{ ...btn, alignSelf: "flex-start", marginTop: "6px" }}>Editar datos</button></div>
        </section>
        <section style={{ ...card, flex: "1 1 300px", background: "#000000", color: "#ffffff" }}>
          <span style={{ fontSize: "13px", opacity: 0.7 }}>Plan actual</span>
          <span style={{ fontSize: "20px", lineHeight: "24px" }}>Negocio · fijo + uso</span>
          <span style={{ fontSize: "36px", lineHeight: "40px", fontWeight: 100, letterSpacing: "-0.04em" }}>{eur(147)}<span style={{ fontSize: "15px", opacity: 0.7, fontWeight: 400 }}> fijo/mes</span></span>
          <span style={{ fontSize: "14px", opacity: 0.75 }}>3 agentes × {P.perAgent} € · 750 conversaciones incluidas · después {eur(P.perConversation, 2)}</span>
          <a href="/plataforma/configuracion/plan" style={{ marginTop: "auto", color: "#ffffff", fontSize: "14px" }}>Ver plan y consumo →</a>
        </section>
      </div>
      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "20px 24px" }}><h2 style={h2}>Facturas</h2></div>
        <table style={{ width: "100%", minWidth: "520px", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "12px 24px", fontWeight: 500 }}>Periodo</th><th style={{ padding: "12px", fontWeight: 500 }}>Importe</th><th style={{ padding: "12px", fontWeight: 500 }}>Estado</th><th style={{ padding: "12px 24px", fontWeight: 500 }}></th></tr></thead>
          <tbody>
            {INVOICES.map(([per, amt, st]) => (
              <tr key={per} style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>{per}</td><td style={{ padding: "12px" }}>{amt}</td><td style={{ padding: "12px", color: st === "Pagada" ? "#004c39" : "#8e4e00" }}>{st}</td><td style={{ padding: "12px 24px" }}><a href="#" data-demo="" style={{ color: "#2457f5" }}>PDF</a></td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </SettingsShell>
  );
}
