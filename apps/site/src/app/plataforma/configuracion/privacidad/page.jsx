import SettingsShell from "@/components/settings-shell";

const card = { background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const sub = { fontSize: "13px", color: "var(--muted)" };
const btn = { padding: "8px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", font: "400 14px/20px var(--font-display)", cursor: "pointer" };
const SESSIONS = [["Chrome · macOS · Madrid", "Esta sesión", "var(--green-fg)"], ["App Moodly · iPhone", "hace 2 h", "var(--muted)"], ["Chrome · Windows", "hace 3 días", "var(--muted)"]];

export default function Privacidad() {
  return (
    <SettingsShell active="privacidad" title="Privacidad." intro="Tus sesiones, tus avisos y tus datos.">
      <section style={card}>
        <h2 style={h2}>Sesiones abiertas</h2>
        {SESSIONS.map(([dev, when, color]) => (
          <div key={dev} style={{ display: "flex", justifyContent: "space-between", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "12px" }}><span>{dev}</span><span style={{ color }}>{when}</span></div>
        ))}
        <button type="button" data-demo="" style={{ ...btn, alignSelf: "flex-start", color: "var(--rose-fg)" }}>Cerrar las demás sesiones</button>
      </section>
      <section style={card}>
        <h2 style={h2}>Avisos por correo</h2>
        {[["Novedades del producto", "Nuevas funciones y mejoras de Moodly."], ["Consejos y buenas prácticas", "Ideas para sacar más partido a tus agentes."]].map(([t, d]) => (
          <label key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid var(--line-soft)", paddingTop: "12px" }}><span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontWeight: 500 }}>{t}</span><span style={sub}>{d}</span></span><input type="checkbox" defaultChecked style={{ width: "18px", height: "18px", accentColor: "var(--ink)" }} /></label>
        ))}
      </section>
      <section style={{ ...card, border: "1px solid var(--rose-line)" }}>
        <h2 style={h2}>Tus datos (RGPD)</h2>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={sub}>Descarga todo lo que Moodly guarda sobre ti, o elimina tu usuario.</span>
          <span style={{ display: "flex", gap: "8px" }}><button type="button" data-demo="" style={btn}>Exportar mis datos</button><button type="button" data-demo="" style={{ ...btn, color: "var(--rose-fg)" }}>Eliminar mi usuario</button></span>
        </div>
      </section>
    </SettingsShell>
  );
}
