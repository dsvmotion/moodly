"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";
import Pills from "@/components/pills";
import { PRICING as P, eur } from "@/components/pricing";

// Facturación (portal): cambiar la tarjeta, editar los datos fiscales (con
// validación de NIF/CIF), ver y descargar facturas, y cambiar de plan.
// TODO(backend): Stripe Customer Portal / Elements (la tarjeta nunca pasa por
// nuestros servidores); billing_accounts; facturas desde Stripe.
const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "var(--muted)" };
const btn = (dark) => ({ padding: "9px 16px", borderRadius: "800px", border: dark ? "1px solid var(--ink)" : "1px solid var(--line)", background: dark ? "var(--ink)" : "var(--paper)", color: dark ? "var(--on-ink)" : "var(--ink)", font: "500 14px/18px var(--font-display)", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" });
const field = { boxSizing: "border-box", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/18px var(--font-body)", color: "var(--ink)" };
const INVOICES = [["2026-10", "Octubre 2026 (en curso)", "≈ 214,00 €", "estimada"], ["2026-09", "Septiembre 2026", "198,10 €", "pagada"], ["2026-08", "Agosto 2026 · prueba", "0,00 €", "pagada"]];
const ST = { pagada: ["var(--green-bg)", "var(--green-fg)", "Pagada"], estimada: ["var(--amber-bg)", "var(--amber-fg)", "Estimada"] };
// NIF/NIE/CIF español (formato) — la comprobación fiscal completa la hace el backend.
const TAX_ID = /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/;

function Modal({ label, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "460px", maxHeight: "90vh", overflowY: "auto", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 24px 64px #00000033", fontSize: "14px" }}>{children}</div>
    </div>
  );
}

export default function Facturacion() {
  const [pm, setPm] = useState({ brand: "VISA", last4: "4242", exp: "09/28" });
  const [billing, setBilling] = useState({ name: "Estudio de Belleza Sol S.L.", tax: "B12345674", address: "Calle Mayor 12, 28013 Madrid", email: "facturas@estudiobellezasol.es" });
  const [modal, setModal] = useState(null); // null | card | billing
  const [cardDraft, setCardDraft] = useState({ num: "", exp: "", cvc: "" });
  const [bDraft, setBDraft] = useState(billing);
  const [tab, setTab] = useState("todas");
  const [saved, setSaved] = useState("");
  const num = cardDraft.num.replace(/\s/g, "");
  const cardOk = /^\d{16}$/.test(num) && /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardDraft.exp) && /^\d{3,4}$/.test(cardDraft.cvc);
  const taxOk = TAX_ID.test(bDraft.tax.trim().toUpperCase());
  const billOk = bDraft.name.trim().length > 2 && taxOk && bDraft.address.trim().length > 5 && /\S+@\S+\.\S+/.test(bDraft.email);
  const rows = INVOICES.filter((i) => tab === "todas" || i[3] === tab);

  return (
    <SettingsShell active="facturacion" title="Facturación." intro="Método de pago, datos fiscales y facturas.">
      {saved && <div role="status" style={{ ...card, background: "var(--green-bg)", color: "var(--green-fg)", padding: "14px 20px" }}>✓ {saved}</div>}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <section style={{ ...card, flex: "1 1 300px" }}>
          <h2 style={h2}>Método de pago</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
            <span style={{ width: "44px", height: "30px", borderRadius: "6px", background: "#1a1f71", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", flex: "none" }}>{pm.brand}</span>
            <span style={{ flex: 1 }}><span style={{ display: "block" }}>•••• {pm.last4}</span><span style={{ fontSize: "13px", ...muted }}>{`Caduca ${pm.exp}`}</span></span>
            <button type="button" onClick={() => { setCardDraft({ num: "", exp: "", cvc: "" }); setModal("card"); }} style={btn(false)}>Cambiar tarjeta</button>
          </div>
          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "14px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "13px", ...muted }}>Datos de facturación</span><span>{billing.name} · {billing.tax}</span><span style={{ fontSize: "13px", ...muted }}>{billing.address} · {billing.email}</span></span>
            <button type="button" onClick={() => { setBDraft(billing); setModal("billing"); }} style={{ ...btn(false), alignSelf: "flex-start" }}>Editar datos</button>
          </div>
        </section>
        <section style={{ ...card, flex: "1 1 300px", background: "var(--ink)", color: "var(--on-ink)" }}>
          <span style={{ fontSize: "13px", opacity: 0.7 }}>Plan actual</span>
          <span style={{ fontSize: "20px", lineHeight: "24px" }}>Negocio · fijo + uso</span>
          <span style={{ fontSize: "36px", lineHeight: "40px", fontWeight: 100, letterSpacing: "-0.04em" }}>{eur(147)}<span style={{ fontSize: "15px", opacity: 0.7, fontWeight: 400 }}> fijo/mes</span></span>
          <span style={{ fontSize: "14px", opacity: 0.75 }}>{`Prueba · ${P.trialDays} días con ${P.trialCreditEur} € de crédito de IA · después, bajo demanda, paquete o plan mensual`}</span>
          <span style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "auto" }}>
            <a href="/plataforma/checkout" style={{ color: "var(--on-ink)", fontSize: "14px" }}>Cambiar de plan →</a>
            <a href="/plataforma/configuracion/plan" style={{ color: "var(--on-ink)", fontSize: "14px", opacity: 0.75 }}>Ver consumo</a>
          </span>
        </section>
      </div>

      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "20px 24px 6px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}><h2 style={h2}>Facturas</h2><Pills label="Estado de la factura" options={[["todas", "Todas"], ["pagada", "Pagadas"], ["estimada", "En curso"]]} value={tab} onChange={setTab} size="sm" /></div>
        <table style={{ width: "100%", minWidth: "520px", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th scope="col" style={{ padding: "12px 24px", fontWeight: 500 }}>Periodo</th><th scope="col" style={{ padding: "12px", fontWeight: 500 }}>Importe</th><th scope="col" style={{ padding: "12px", fontWeight: 500 }}>Estado</th><th scope="col" style={{ padding: "12px 24px" }}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Descargar</span></th></tr></thead>
          <tbody>
            {rows.map(([id, per, amt, st]) => (
              <tr key={id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 24px" }}>{per}</td><td style={{ padding: "12px" }}>{amt}</td>
                <td style={{ padding: "12px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: ST[st][0], color: ST[st][1], fontSize: "12px" }}>{ST[st][2]}</span></td>
                <td style={{ padding: "12px 24px", textAlign: "right" }}>{st === "pagada" ? <button type="button" data-demo="" aria-label={`Descargar PDF de ${per}`} style={{ ...btn(false), padding: "6px 12px" }}>PDF</button> : <span style={{ fontSize: "13px", ...muted }}>Se emite el día 1</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal === "card" && (
        <Modal label="Cambiar tarjeta" onClose={() => setModal(null)}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Nueva tarjeta</span>
          <span style={{ fontSize: "13px", ...muted }}>Los datos van directos al procesador de pagos (Stripe); nunca pasan por nuestros servidores. No se cobra nada ahora.</span>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...muted }}>Número de tarjeta<input inputMode="numeric" autoComplete="cc-number" value={cardDraft.num} onChange={(e) => setCardDraft({ ...cardDraft, num: e.target.value.replace(/[^\d ]/g, "").slice(0, 19) })} placeholder="1234 1234 1234 1234" style={field} /></label>
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, ...muted }}>Caducidad<input autoComplete="cc-exp" value={cardDraft.exp} onChange={(e) => setCardDraft({ ...cardDraft, exp: e.target.value.slice(0, 5) })} placeholder="MM/AA" style={field} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, ...muted }}>CVC<input inputMode="numeric" autoComplete="cc-csc" value={cardDraft.cvc} onChange={(e) => setCardDraft({ ...cardDraft, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" style={field} /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><button type="button" onClick={() => setModal(null)} style={btn(false)}>Cancelar</button><button type="button" disabled={!cardOk} onClick={() => { setPm({ brand: num.startsWith("5") ? "MC" : "VISA", last4: num.slice(-4), exp: cardDraft.exp }); setModal(null); setSaved(`Tarjeta •••• ${num.slice(-4)} guardada. Se usará en el próximo cobro.`); }} style={{ ...btn(true), opacity: cardOk ? 1 : 0.45, cursor: cardOk ? "pointer" : "not-allowed" }}>Guardar tarjeta</button></div>
        </Modal>
      )}

      {modal === "billing" && (
        <Modal label="Editar datos de facturación" onClose={() => setModal(null)}>
          <span style={{ fontSize: "17px", fontWeight: 500 }}>Datos de facturación</span>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...muted }}>Razón social<input value={bDraft.name} onChange={(e) => setBDraft({ ...bDraft, name: e.target.value })} style={field} /></label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...muted }}>NIF / CIF<input value={bDraft.tax} onChange={(e) => setBDraft({ ...bDraft, tax: e.target.value.toUpperCase() })} aria-invalid={!taxOk} aria-describedby="tax-help" style={{ ...field, borderColor: taxOk ? "var(--line)" : "var(--rose-fg)" }} /><span id="tax-help" role={taxOk ? undefined : "alert"} style={{ fontSize: "12px", color: taxOk ? "var(--muted)" : "var(--rose-fg)" }}>{taxOk ? "Formato correcto." : "Revisa el formato: 8 números y letra (NIF) o letra y 8 caracteres (CIF)."}</span></label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...muted }}>Dirección fiscal<input value={bDraft.address} onChange={(e) => setBDraft({ ...bDraft, address: e.target.value })} style={field} /></label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...muted }}>Email para facturas<input type="email" value={bDraft.email} onChange={(e) => setBDraft({ ...bDraft, email: e.target.value })} style={field} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}><button type="button" onClick={() => setModal(null)} style={btn(false)}>Cancelar</button><button type="button" disabled={!billOk} onClick={() => { setBilling({ ...bDraft, tax: bDraft.tax.trim().toUpperCase() }); setModal(null); setSaved("Datos de facturación actualizados. Saldrán en la próxima factura."); }} style={{ ...btn(true), opacity: billOk ? 1 : 0.45, cursor: billOk ? "pointer" : "not-allowed" }}>Guardar</button></div>
        </Modal>
      )}
    </SettingsShell>
  );
}
