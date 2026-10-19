"use client";
import { useState } from "react";
import SettingsShell from "@/components/settings-shell";
import Pills from "@/components/pills";

// Registro de auditoría: filtrar por autor y periodo, buscar, abrir el detalle de
// cada acción (antes/después, IP, enlace) y exportar a CSV lo que estás viendo.
// TODO(backend): audit_logs (solo inserción) con filtros en servidor y retención
// por plan; la exportación se genera en servidor.
const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const muted = { color: "var(--muted)" };
const btn = { padding: "9px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/18px var(--font-display)", cursor: "pointer" };
const TAG = { agente: ["var(--green-bg)", "var(--green-fg)", "Agente"], persona: ["var(--blue-bg)", "var(--blue-fg)", "Persona"], sistema: ["var(--sunken)", "var(--muted)", "Sistema"] };
// [id, día (0 = hoy), hora, autor, tipo, acción, dónde, sede, ip, antes, después, enlace]
const LOG = [
  ["a1", 0, "11:02", "Administración", "agente", "Preparó la factura F-0412 para Laura M. (75,00 €)", "Facturas", "Sede Centro", "—", null, "Borrador · pendiente de aprobación", "/plataforma/aprobaciones?i=f0412"],
  ["a2", 0, "10:42", "Recepción", "agente", "Reservó una cita para Laura M. (jueves 10:30)", "WhatsApp → Calendar", "Sede Centro", "—", null, "Cita creada con la Dra. Ruiz", "/plataforma/conversaciones?c=Laura%20M."],
  ["a3", 0, "10:31", "Recepción", "agente", "Atendió la llamada de Sara Pérez y reservó revisión", "Teléfono", "Sede Centro", "—", null, "Cita mar 9:30", "/plataforma/llamadas"],
  ["a4", 0, "10:18", "Marta Ruiz", "persona", "Aprobó la respuesta a la reseña de Pedro G.", "Aprobaciones", "Sede Centro", "88.12.40.7", "Pendiente", "Aprobada y publicada", "/plataforma/aprobaciones?i=resena"],
  ["a5", 0, "09:58", "Administración", "agente", "Avisó de stock bajo de guantes de nitrilo", "Inventario", "Sede Centro", "—", null, "Pedido preparado: 10 cajas", "/plataforma/facturas"],
  ["a6", 0, "09:40", "Comercial", "agente", "Preparó el presupuesto de ortodoncia de Javier R. (1.900 €)", "WhatsApp", "Sede Norte", "—", null, "Pendiente de aprobación", "/plataforma/aprobaciones?i=presu-javier"],
  ["a7", 0, "07:12", "Sistema", "sistema", "Google Calendar perdió el permiso (token revocado)", "Integraciones", "Sede Centro", "—", "Conectada", "Necesita reconexión", "/plataforma/configuracion/integraciones/detalle?i=gcal"],
  ["a8", 1, "19:30", "Administración", "agente", "Registró el cobro de Iván Rubio (427,18 €)", "Holded", "Sede Centro", "—", "Pendiente", "Cobrada", "/plataforma/facturas"],
  ["a9", 1, "18:05", "Javier Soler", "persona", "Cambió la regla «Enviar factura» a Con aprobación", "Reglas", "Toda la organización", "81.40.12.33", "Solo", "Con aprobación", "/plataforma/reglas"],
  ["a10", 1, "12:20", "Marta Ruiz", "persona", "Publicó la versión v7 del agente de Atención", "Agentes", "Toda la organización", "88.12.40.7", "v6", "v7", "/plataforma/publicar?a=customer"],
  ["a11", 3, "16:44", "Marta Ruiz", "persona", "Invitó a Andrés Gil como Profesional", "Equipo", "Sede Norte", "88.12.40.7", null, "Invitación enviada", "/plataforma/configuracion/equipo"],
  ["a12", 4, "09:10", "Sistema", "sistema", "Renovó la suscripción (Negocio · 198,10 €)", "Facturación", "Toda la organización", "—", null, "Pagada", "/plataforma/configuracion/facturacion"],
  ["a13", 6, "13:02", "Marta Ruiz", "persona", "Aceptó el DPA (versión 2026-10)", "Protección de datos", "Toda la organización", "88.12.40.7", "Pendiente", "Aceptado", "/plataforma/subprocesadores"],
  ["a14", 12, "10:00", "Javier Soler", "persona", "Activó la verificación en dos pasos", "Seguridad", "Toda la organización", "81.40.12.33", "Desactivada", "Activada", "/plataforma/configuracion/seguridad"],
];
const WHEN = (d, h) => (d === 0 ? `Hoy ${h}` : d === 1 ? `Ayer ${h}` : `Hace ${d} días · ${h}`);
const KINDS = [["todo", "Todo"], ["agente", "Agentes"], ["persona", "Personas"], ["sistema", "Sistema"]];
const PERIODS = [["1", "Hoy"], ["7", "7 días"], ["30", "30 días"]];

export default function Auditoria() {
  const [kind, setKind] = useState("todo");
  const [period, setPeriod] = useState("30");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const rows = LOG.filter((r) => (kind === "todo" || r[4] === kind) && r[1] < Number(period) && (!q.trim() || `${r[3]} ${r[5]} ${r[6]} ${r[7]}`.toLowerCase().includes(q.trim().toLowerCase())));
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Cuándo;Autor;Tipo;Acción;Dónde;Sede;IP;Antes;Después", ...rows.map((r) => [WHEN(r[1], r[2]), r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]].map(esc).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `auditoria-moodly-${period}d.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cur = LOG.find((r) => r[0] === open);

  return (
    <SettingsShell active="auditoria" title="Registro de auditoría." intro="Cada acción, con quién y cuándo." actions={<button type="button" onClick={exportCsv} disabled={!rows.length} style={{ ...btn, opacity: rows.length ? 1 : 0.5 }}>Exportar CSV ({rows.length})</button>}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <Pills label="Tipo de autor" options={KINDS} value={kind} onChange={setKind} size="sm" />
        <Pills label="Periodo" variant="segmented" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
        <label style={{ flex: "1 1 200px" }}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar en el registro</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, acción o sede" style={{ width: "100%", boxSizing: "border-box", padding: "9px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/18px var(--font-display)", color: "var(--ink)" }} /></label>
      </div>

      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", background: "var(--sunken)" }}><th scope="col" style={{ padding: "12px 24px", fontWeight: 500 }}>Cuándo</th><th scope="col" style={{ padding: "12px", fontWeight: 500 }}>Autor</th><th scope="col" style={{ padding: "12px", fontWeight: 500 }}>Acción</th><th scope="col" style={{ padding: "12px 24px", fontWeight: 500 }}>Dónde</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: "20px 24px", ...muted }}>Nada en el registro con estos filtros.</td></tr>}
            {rows.map((r) => (
              <tr key={r[0]} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 24px", color: "var(--muted-2)", whiteSpace: "nowrap" }}>{WHEN(r[1], r[2])}</td>
                <td style={{ padding: "12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>{r[3]}<span style={{ padding: "1px 8px", borderRadius: "800px", background: TAG[r[4]][0], color: TAG[r[4]][1], fontSize: "11px" }}>{TAG[r[4]][2]}</span></span></td>
                <td style={{ padding: "12px" }}><button type="button" onClick={() => setOpen(r[0])} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--line-strong)", textUnderlineOffset: "3px" }}>{r[5]}</button></td>
                <td style={{ padding: "12px 24px", color: "var(--muted-2)" }}>{r[6]} · {r[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <span style={{ fontSize: "13px", ...muted }}>Se guardan 365 días en tu plan. El registro no se puede editar ni borrar.</span>

      {cur && (
        <div role="dialog" aria-modal="true" aria-label="Detalle de la acción" onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "#00000040", display: "flex", justifyContent: "flex-end" }}>
          <aside onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 100%)", height: "100%", background: "var(--paper)", boxShadow: "-12px 0 40px #00000026", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", fontSize: "14px", lineHeight: "21px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "18px", lineHeight: "24px" }}>{cur[5]}</span>
              <button type="button" onClick={() => setOpen(null)} aria-label="Cerrar" style={{ width: "32px", height: "32px", flex: "none", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", cursor: "pointer" }}>×</button>
            </div>
            {[["Cuándo", WHEN(cur[1], cur[2])], ["Autor", `${cur[3]} (${TAG[cur[4]][2].toLowerCase()})`], ["Dónde", cur[6]], ["Sede", cur[7]], ["IP", cur[8]], ["ID", `evt_${cur[0]}_2026`]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "10px" }}><span style={muted}>{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--line-soft)", paddingTop: "12px" }}>
              <span style={muted}>Cambio</span>
              {cur[9] && <span style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--rose-bg)", color: "var(--rose-fg)", textDecoration: "line-through" }}>{cur[9]}</span>}
              <span style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--green-bg)", color: "var(--green-fg)" }}>{cur[10]}</span>
            </div>
            <a href={cur[11]} style={{ marginTop: "auto", alignSelf: "flex-start", padding: "10px 16px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)", textDecoration: "none" }}>Ir al elemento →</a>
          </aside>
        </div>
      )}
    </SettingsShell>
  );
}
