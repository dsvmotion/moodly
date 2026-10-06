import LangLink from "@/components/lang-link";
import { Fragment } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export default function Page() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>

<SiteHeader />

<section style={{ padding: "80px 24px 48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
<h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "720px" }}>Negocios que ya trabajan con Moodly</h1>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px", fontSize: "14px", lineHeight: "14px" }}><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#000000", color: "#ffffff" }}>Todos</span><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#ffffff" }}>Clínicas</span><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#ffffff" }}>Restaurantes</span><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#ffffff" }}>Gestorías</span><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#ffffff" }}>Inmobiliarias</span><span style={{ padding: "10px 16px", borderRadius: "800px", background: "#ffffff" }}>Agencias</span></div>
</section>

<section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px" }}>
<LangLink href="/#demo" style={{ borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "clamp(32px, 5vw, 64px)", display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "flex-end", minHeight: "420px", boxSizing: "border-box" }}>
<div style={{ flex: "2 1 420px", display: "flex", flexDirection: "column", gap: "16px" }}><span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: "#ffffff33", fontSize: "12px" }}>Clínica dental · [Ciudad]</span><span style={{ fontSize: "32px", lineHeight: "35.2px", letterSpacing: "-0.64px" }}>Cómo [Clínica] dejó de perder llamadas en horas de consulta</span><span style={{ fontSize: "16px", lineHeight: "24px", opacity: ".75" }}>“[Cita del cliente sobre el cambio en su recepción.]” — [Nombre], [Cargo]</span></div>
<div style={{ flex: "1 1 260px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}><span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "40px", lineHeight: "44px", letterSpacing: "-1.6px" }}>[00]%</span><span style={{ fontSize: "14px", opacity: ".75" }}>menos ausencias</span></span><span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "40px", lineHeight: "44px", letterSpacing: "-1.6px" }}>[00] h</span><span style={{ fontSize: "14px", opacity: ".75" }}>ahorradas al mes</span></span></div>
</LangLink>

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
<LangLink href="/#demo" style={{ display: "flex", flexDirection: "column", gap: "14px" }}><span style={{ height: "280px", borderRadius: "12px", background: "#ff6301", display: "flex", alignItems: "flex-end", padding: "20px", boxSizing: "border-box", fontSize: "12px" }}>[Foto del restaurante]</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Restaurante · [Ciudad]</span><span style={{ fontSize: "18px", lineHeight: "23px", letterSpacing: "-0.36px" }}>Cómo [Restaurante] gestiona sus reservas sin descolgar el teléfono</span></LangLink>
<LangLink href="/#demo" style={{ display: "flex", flexDirection: "column", gap: "14px" }}><span style={{ height: "280px", borderRadius: "12px", background: "#f6f2e8", display: "flex", alignItems: "flex-end", padding: "20px", boxSizing: "border-box", fontSize: "12px" }}>[Foto de la gestoría]</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Gestoría · [Ciudad]</span><span style={{ fontSize: "18px", lineHeight: "23px", letterSpacing: "-0.36px" }}>Cómo [Gestoría] recibe toda la documentación antes del plazo</span></LangLink>
<LangLink href="/#demo" style={{ display: "flex", flexDirection: "column", gap: "14px" }}><span style={{ height: "280px", borderRadius: "12px", background: "#ffbab5", display: "flex", alignItems: "flex-end", padding: "20px", boxSizing: "border-box", fontSize: "12px" }}>[Foto de la inmobiliaria]</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Inmobiliaria · [Ciudad]</span><span style={{ fontSize: "18px", lineHeight: "23px", letterSpacing: "-0.36px" }}>Cómo [Inmobiliaria] responde a cada lead en menos de un minuto</span></LangLink>
</div>

<div style={{ borderRadius: "12px", background: "#ffffff", padding: "clamp(32px, 5vw, 56px)", display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "12px" }}><h2 style={{ margin: "0", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: "1.12", fontWeight: "400", letterSpacing: "-0.025em" }}>¿Quieres ser uno de nuestros casos? <span style={{ color: "#5f5f63" }}>Buscamos negocios piloto con condiciones especiales.</span></h2></div>
<LangLink href="/#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>Quiero ser piloto</LangLink>
</div>
</div>
</section>


<SiteFooter />
</div>
</>
  );
}
