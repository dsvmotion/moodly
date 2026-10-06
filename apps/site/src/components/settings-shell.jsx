import SettingsNav from "./settings-nav";

// Envoltorio del modo Configuración: menú de ajustes + contenido.
export default function SettingsShell({ active, title, intro, actions, children }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active={active} /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "980px" }}>
        {(title || actions) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>{title}{intro && <span style={{ color: "#5f5f63" }}> {intro}</span>}</h1>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
