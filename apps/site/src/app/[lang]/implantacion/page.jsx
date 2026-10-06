import LangLink from "@/components/lang-link";
import { Fragment } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export default function Page() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f7f7f8", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased" }}>

<SiteHeader />

<section style={{ padding: "80px 24px 64px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
<h1 style={{ margin: "0", fontSize: "clamp(38px, 4.6vw, 52px)", lineHeight: "1.1", fontWeight: 100, letterSpacing: "-0.03em", maxWidth: "760px" }}>De la primera llamada a tu agente trabajando</h1>
<p style={{ margin: "0", fontSize: "18px", lineHeight: "27px", fontWeight: "300", maxWidth: "520px" }}>Lo hacemos contigo, paso a paso. Tú nos cuentas cómo funciona tu negocio; nosotros lo convertimos en agentes.</p>
</section>

<section style={{ padding: "0 clamp(16px, 4vw, 40px)" }}>
<div style={{ maxWidth: "984px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
<div style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: "1px solid #000000", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>Semana 1</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Llamada de diagnóstico</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>30 minutos para entender tu negocio, tus herramientas y lo que más tiempo os quita. Sales con tu plan y, si necesitas algo a medida, un presupuesto cerrado.</span></div></div>
<div style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: "1px solid #0000001a", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>Semana 1–2</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Conexión y configuración</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Conectamos WhatsApp, email, calendario, CRM y facturación. Cargamos tus servicios, precios, horarios y reglas en la plantilla de tu sector.</span></div></div>
<div style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: "1px solid #0000001a", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>Semana 2</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Pruebas contigo</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Probáis el agente juntos con conversaciones reales de tu negocio y ajustamos tono y reglas hasta que te convence.</span></div></div>
<div style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: "1px solid #0000001a", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>Semana 3</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Puesta en marcha prudente</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Empieza con más cosas «con aprobación». Revisamos la primera semana contigo y pasamos a automático lo que funciona.</span></div></div>
<div style={{ display: "flex", gap: "32px", padding: "32px 0", borderTop: "1px solid #0000001a", borderBottom: "1px solid #0000001a", flexWrap: "wrap" }}><span style={{ width: "120px", font: "400 14px/24px var(--font-mono)", color: "#6b6b70" }}>Después</span><div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>Mantenimiento y mejora</span><span style={{ fontSize: "16px", lineHeight: "24px", color: "#5f5f63" }}>Plataforma funcionando, consumo de IA incluido, informes mensuales y nuevas skills de tu sector.</span></div></div>
<span style={{ marginTop: "16px", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>Plazos orientativos: [por confirmar según el número de agentes e integraciones].</span>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 0" }}>
<div style={{ maxWidth: "1232px", margin: "0 auto", display: "flex", gap: "24px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 420px", borderRadius: "12px", background: "#f6f2e8", padding: "40px", display: "flex", flexDirection: "column", gap: "16px" }}><h2 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>Lo que necesitamos de ti</h2><ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "16px", lineHeight: "24px" }}><li>· Acceso a las herramientas que quieras conectar</li><li>· Tus servicios, precios y horarios (vale una tarifa en PDF)</li><li>· Las preguntas que más os hacen</li><li>· 2–3 horas de tu tiempo en total</li></ul></div>
<div style={{ flex: "1 1 420px", borderRadius: "12px", background: "#000000", color: "#ffffff", padding: "40px", display: "flex", flexDirection: "column", gap: "16px" }}><h2 style={{ margin: "0", fontSize: "24px", lineHeight: "26.4px", fontWeight: "400", letterSpacing: "-0.48px" }}>Lo que recibes</h2><ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "16px", lineHeight: "24px" }}><li>✓ Agentes configurados para tu sector</li><li>✓ Herramientas conectadas y probadas</li><li>✓ Reglas y aprobaciones a tu medida</li><li>✓ Formación para tu equipo</li><li>✓ Acompañamiento la primera semana</li></ul></div>
</div>
</section>

<section style={{ padding: "clamp(88px, 10vw, 144px) clamp(16px, 4vw, 40px) 64px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center" }}>
<h2 style={{ margin: "0", fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: "1.08", fontWeight: "400", letterSpacing: "-0.035em", maxWidth: "520px" }}>Implantación según tu escala, con presupuesto cerrado.</h2>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}><LangLink href="/#demo" style={{ padding: "11px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", background: "#000000", color: "#ffffff" }}>Reservar llamada de diagnóstico</LangLink><LangLink href="/precios" style={{ padding: "10px 18px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", border: "1px solid #0000001a" }}>Calcular mi precio</LangLink></div>

</div>
</section>
<SiteFooter />
</div>
</>
  );
}
