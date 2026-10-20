import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

// Estructura común de las páginas de la web: cabecera, presentación, contenido y pie.
export const wrap = { maxWidth: "1232px", margin: "0 auto" };
export const section = { padding: "clamp(72px, 9vw, 128px) clamp(16px, 4vw, 40px) 0" };
export const h2 = { margin: 0, fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.025em" };
export const h3 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
export const muted = { color: "#5f5f63" };
export const card = { background: "#ffffff", border: "1px solid #0000000f", borderRadius: "12px", padding: "28px", boxSizing: "border-box" };
export const pillBtn = (dark) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", border: dark ? "1px solid #000000" : "1px solid #0000001a" });

export default function PageShell({ eyebrow, title, intro, actions, children, center = true }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100vh" }}>
      <SiteHeader />
      <section style={{ padding: "clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left", gap: "18px" }}>
          {eyebrow && <span style={{ padding: "6px 12px", borderRadius: "800px", background: "#ffffff", border: "1px solid #0000000f", fontSize: "14px", lineHeight: "14px", color: "#5f5f63" }}>{eyebrow}</span>}
          <h1 style={{ margin: 0, fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: 1.06, fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "820px" }}>{title}</h1>
          {intro && <p style={{ margin: 0, fontSize: "18px", lineHeight: "27px", fontWeight: 300, maxWidth: "600px" }}>{intro}</p>}
          {actions && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start", marginTop: "6px" }}>{actions}</div>}
        </div>
      </section>
      {children}
      <SiteFooter />
    </div>
  );
}
