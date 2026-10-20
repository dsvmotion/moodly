import { Fragment } from "react";
import SettingsNav from "@/components/settings-nav";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><SettingsNav active="plan" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Plan y consumo. <span style={{ color: "#5f5f63" }}>Sin sorpresas a fin de mes.</span></h1>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><a href="/plataforma/checkout" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Cambiar de plan</a><a href="/plataforma/topes" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", textDecoration: "none" }}>Topes de gasto</a></div>

<div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
<section style={{ flex: "1 1 300px", borderRadius: "12px", border: "1px solid #2457f5", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>Mantenimiento</span><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#2457f5", color: "#ffffff", fontSize: "12px", lineHeight: "14px" }}>Activo</span></span>
<span style={{ fontSize: "32px", lineHeight: "35px", letterSpacing: "-0.64px" }}>70 € <span style={{ fontSize: "16px", color: "#5f5f63" }}>/mes</span></span>
<span style={{ color: "#5f5f63" }}>3 agentes · 1 sede · llamadas de voz · hasta 1.000 conversaciones</span>
<span style={{ color: "#5f5f63" }}>Próximo cobro: 1 nov · tarjeta •••• 4242</span>
<span style={{ display: "flex", gap: "8px", marginTop: "4px" }}><a href="/precios" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff" }}>Cambiar plan</a><a href="#" data-demo="" style={{ padding: "10px 16px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff" }}>Método de pago</a></span>
</section>

<section style={{ flex: "2 1 420px", background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" }}>
<span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}><span style={{ fontSize: "18px", lineHeight: "20px", letterSpacing: "-0.36px" }}>Consumo de IA este mes</span><span style={{ color: "#5f5f63" }}>Quedan 9 días</span></span>
<span style={{ fontSize: "32px", lineHeight: "35px", letterSpacing: "-0.64px" }}>78 % <span style={{ fontSize: "16px", color: "#5f5f63" }}>de lo incluido</span></span>
<div style={{ height: "12px", borderRadius: "800px", background: "#ebebed", overflow: "hidden", display: "flex" }}><span style={{ width: "40%", background: "#004c39" }}></span><span style={{ width: "24%", background: "#9dbecc" }}></span><span style={{ width: "14%", background: "#8e4e00" }}></span></div>
<span style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", lineHeight: "18px", color: "#5f5f63" }}><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#004c39" }}></span>Recepción 40 %</span><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#9dbecc" }}></span>Atención 24 %</span><span style={{ display: "flex", gap: "6px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#8e4e00" }}></span>Administración 14 %</span></span>
<div style={{ borderRadius: "12px", background: "#ffe8d6", color: "#8e4e00", padding: "12px 16px" }}><strong style={{ fontWeight: "500" }}>A este ritmo llegarás al 100 % el día 28.</strong> No cobramos de más sin avisarte: te propondremos el plan adecuado.</div>
</section>
</div>

<div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "2 1 420px", background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Si me paso del consumo incluido…</h2>
<label style={{ display: "flex", gap: "12px", padding: "12px 0", borderTop: "1px solid #0000000f", cursor: "pointer" }}><input type="radio" name="tope" defaultChecked style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>Avísame y sigue funcionando</span><span style={{ color: "#5f5f63" }}>Hasta un máximo de 20 € extra este mes.</span></span></label>
<label style={{ display: "flex", gap: "12px", padding: "12px 0", borderTop: "1px solid #0000000f", cursor: "pointer" }}><input type="radio" name="tope" style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>Para los agentes</span><span style={{ color: "#5f5f63" }}>Dejan de responder hasta el mes siguiente y te avisamos.</span></span></label>
<label style={{ display: "flex", gap: "12px", padding: "12px 0", borderTop: "1px solid #0000000f", cursor: "pointer" }}><input type="radio" name="tope" style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>Sube de plan automáticamente</span><span style={{ color: "#5f5f63" }}>Nunca más de 100 €/mes.</span></span></label>
</section>

<section style={{ flex: "1 1 300px", background: "#ffffff", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Facturas de Moodly</h2>
<div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Octubre 2026</span><span>70,00 € · <a href="#" data-demo="" style={{ color: "#2457f5" }}>PDF</a></span></div>
<div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Septiembre 2026</span><span>70,00 € · <a href="#" data-demo="" style={{ color: "#2457f5" }}>PDF</a></span></div>
<div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Implantación</span><span>2.400,00 € · <a href="#" data-demo="" style={{ color: "#2457f5" }}>PDF</a></span></div>
</section>
</div>
</main>
</div>
</>
  );
}
