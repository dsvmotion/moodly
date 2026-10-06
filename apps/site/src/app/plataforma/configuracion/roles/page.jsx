import SettingsShell from "@/components/settings-shell";

const card = { background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const sub = { fontSize: "13px", color: "#5f5f63" };
// Roles del sistema + permisos (referencia Langdock: roles con nº de permisos + roles personalizados).
const ROLES = [
  ["Dueño", "1 persona", "Todos los permisos, incluidos plan, facturación y seguridad.", true],
  ["Gerente", "2 personas", "Aprueba facturas y cambios, ve informes y ajusta reglas. Sin plan ni facturación.", true],
  ["Recepción", "3 personas", "Conversaciones, agenda y clientes. Puede tomar el control de un chat.", true],
  ["Profesional", "4 personas", "Solo su agenda y los avisos que le tocan.", true],
];
const PERMS = ["Ver conversaciones", "Tomar el control de un chat", "Ver y mover la agenda", "Ver clientes y leads", "Aprobar facturas", "Ver informes", "Configurar agentes y reglas", "Gestionar el equipo", "Plan y facturación", "Seguridad y accesos"];
const MATRIX = {
  "Ver conversaciones": [1, 1, 1, 0], "Tomar el control de un chat": [1, 1, 1, 0], "Ver y mover la agenda": [1, 1, 1, 1], "Ver clientes y leads": [1, 1, 1, 0], "Aprobar facturas": [1, 1, 0, 0], "Ver informes": [1, 1, 0, 0], "Configurar agentes y reglas": [1, 1, 0, 0], "Gestionar el equipo": [1, 0, 0, 0], "Plan y facturación": [1, 0, 0, 0], "Seguridad y accesos": [1, 0, 0, 0],
};

export default function Roles() {
  return (
    <SettingsShell active="roles" title="Roles." intro="Qué puede hacer cada persona." actions={<button type="button" data-demo="" style={{ padding: "11px 18px", borderRadius: "800px", border: 0, background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)", cursor: "pointer" }}>Crear rol</button>}>
      <section style={card}>
        <h2 style={h2}>Roles del sistema</h2>
        <span style={sub}>Vienen con la plataforma. Para cambiar el rol de alguien, ve a Miembros.</span>
        {ROLES.map(([name, count, desc]) => (
          <div key={name} style={{ display: "flex", gap: "16px", justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid #0000000f", paddingTop: "14px" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 320px" }}><span style={{ fontWeight: 500 }}>{name} <span style={{ fontWeight: 400, color: "#6b6b70" }}>· {count}</span></span><span style={sub}>{desc}</span></span>
          </div>
        ))}
      </section>
      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "20px 24px" }}><h2 style={h2}>Permisos por rol</h2></div>
        <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", background: "#ebebed" }}><th style={{ padding: "12px 24px", fontWeight: 500 }}>Permiso</th>{ROLES.map(([n]) => <th key={n} style={{ padding: "12px", fontWeight: 500, textAlign: "center" }}>{n}</th>)}</tr></thead>
          <tbody>
            {PERMS.map((perm) => (
              <tr key={perm} style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>{perm}</td>{MATRIX[perm].map((v, i) => <td key={i} style={{ padding: "12px", textAlign: "center", color: v ? "#004c39" : "#d4d4d8" }}>{v ? "✓" : "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>
    </SettingsShell>
  );
}
