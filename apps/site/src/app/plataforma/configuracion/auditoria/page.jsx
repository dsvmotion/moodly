import SettingsShell from "@/components/settings-shell";

const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const sub = { fontSize: "13px", color: "#5f5f63" };
const btn = { padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", font: "400 14px/20px var(--font-display)", cursor: "pointer" };
// Registro de acciones (referencia Langdock: gobernanza y auditoría).
const LOG = [
  ["10:42", "Recepción", "agente", "Reservó una cita para Laura M. (jueves 10:30)", "WhatsApp"],
  ["10:18", "Marta Ruiz", "persona", "Aprobó la factura F-0412 a Laura M.", "Aprobaciones"],
  ["09:58", "Administración", "agente", "Avisó de stock bajo de guantes de nitrilo", "Inventario"],
  ["09:31", "Recepción", "agente", "Atendió una llamada y confirmó 2 citas", "Teléfono"],
  ["Ayer", "Javier Vidal", "persona", "Cambió la regla «Enviar factura» a Con aprobación", "Reglas"],
  ["Ayer", "Sistema", "sistema", "Google Calendar se desconectó", "Integraciones"],
];
const TAG = { agente: ["#dcebdd", "#004c39"], persona: ["#e8edff", "#2457f5"], sistema: ["#ebebed", "#5f5f63"] };

export default function Auditoria() {
  return (
    <SettingsShell active="auditoria" title="Registro de auditoría." intro="Cada acción, con quién y cuándo." actions={<button type="button" data-demo="" style={btn}>Exportar CSV</button>}>
      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "12px 24px", fontWeight: 500 }}>Cuándo</th><th style={{ padding: "12px", fontWeight: 500 }}>Autor</th><th style={{ padding: "12px", fontWeight: 500 }}>Acción</th><th style={{ padding: "12px 24px", fontWeight: 500 }}>Dónde</th></tr></thead>
          <tbody>
            {LOG.map(([when, who, kind, what, where], i) => (
              <tr key={i} style={{ borderTop: "1px solid #0000000f" }}>
                <td style={{ padding: "12px 24px", color: "#6b6b70", whiteSpace: "nowrap" }}>{when}</td>
                <td style={{ padding: "12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>{who}<span style={{ padding: "1px 8px", borderRadius: "800px", background: TAG[kind][0], color: TAG[kind][1], fontSize: "11px" }}>{kind}</span></span></td>
                <td style={{ padding: "12px" }}>{what}</td>
                <td style={{ padding: "12px 24px", color: "#6b6b70" }}>{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <span style={sub}>Se guardan [N] días según tu plan. El registro no se puede editar.</span>
    </SettingsShell>
  );
}
