import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>

<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="memoria" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-1.28px", maxWidth: "720px" }}>Memoria del negocio. <span style={{ color: "#5f5f63" }}>Todo lo que tus agentes saben de tu empresa. Edítalo cuando quieras.</span></h1>
<button data-demo="" type="button" style={{ padding: "10px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Añadir información</button>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<div style={{ flex: "3 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>

<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Objetivos</h2><a href="#" data-demo="" style={{ fontSize: "14px", color: "#2457f5" }}>Editar</a></div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderRadius: "12px", background: "#f6f2e8" }}><span style={{ fontWeight: "500" }}>Q4</span><span>Llenar las tardes de los martes y jueves</span></div>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderRadius: "12px", background: "#f6f2e8" }}><span style={{ fontWeight: "500" }}>Q4</span><span>Bajar las ausencias por debajo del 42%</span></div>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderRadius: "12px", background: "#f6f2e8" }}><span style={{ fontWeight: "500" }}>2026</span><span>Llegar a 5 reseñas en Google</span></div>
</div>
</section>

<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", overflow: "hidden" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #0000000f" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Servicios y precios</h2><a href="#" data-demo="" style={{ fontSize: "14px", color: "#2457f5" }}>Importar desde facturación</a></div>
<div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "480px" }}>
<thead><tr style={{ background: "#ebebed", textAlign: "left" }}><th style={{ padding: "10px 24px", fontWeight: "500" }}>Servicio</th><th style={{ padding: "10px 12px", fontWeight: "500" }}>Duración</th><th style={{ padding: "10px 12px", fontWeight: "500" }}>Precio</th><th style={{ padding: "10px 24px", fontWeight: "500" }}>Profesionales</th></tr></thead>
<tbody>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Limpieza dental</td><td style={{ padding: "12px" }}>45 min</td><td style={{ padding: "12px" }}>42 €</td><td style={{ padding: "12px 24px", color: "#5f5f63" }}>Dra. Ruiz, Dr. Vidal</td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Revisión</td><td style={{ padding: "12px" }}>30 min</td><td style={{ padding: "12px" }}>42 €</td><td style={{ padding: "12px 24px", color: "#5f5f63" }}>Todos</td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Blanqueamiento</td><td style={{ padding: "12px" }}>60 min</td><td style={{ padding: "12px" }}>427 €</td><td style={{ padding: "12px 24px", color: "#5f5f63" }}>Dr. Vidal</td></tr>
<tr style={{ borderTop: "1px solid #0000000f" }}><td style={{ padding: "12px 24px" }}>Ortodoncia (primera visita)</td><td style={{ padding: "12px" }}>45 min</td><td style={{ padding: "12px" }}>Gratis</td><td style={{ padding: "12px 24px", color: "#5f5f63" }}>Dr. Vidal</td></tr>
</tbody>
</table>
</div>
</section>

<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Reglas del negocio</h2><a href="/plataforma/reglas" style={{ fontSize: "14px", color: "#2457f5" }}>+ Nueva regla</a></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>No ofrecer descuentos en la primera visita</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Todos los agentes</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Las urgencias se atienden el mismo día antes de las 13:00</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Recepción</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Nunca dar diagnósticos ni consejos médicos</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Atención</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Facturas siempre con aprobación</span><span style={{ fontSize: "12px", color: "#6b6b70" }}>Administración</span></div>
</section>
</div>

<div style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<section style={{ background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Lo que han aprendido</h2>
<span style={{ color: "#5f5f63" }}>Confírmalo para que lo usen siempre, o descártalo.</span>
<div style={{ borderRadius: "12px", background: "#f6f2e8", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
<span>«Los pacientes preguntan mucho si aceptamos MediSalud». Respuesta propuesta: sí, con copago.</span>
<span style={{ display: "flex", gap: "6px" }}><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Confirmar</button><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Descartar</button></span>
</div>
<div style={{ borderRadius: "12px", background: "#f6f2e8", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
<span>«Las citas de los lunes a primera hora se cancelan más». ¿Pedir confirmación el domingo?</span>
<span style={{ display: "flex", gap: "6px" }}><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)" }}>Confirmar</button><button data-demo="" type="button" style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)" }}>Descartar</button></span>
</div>
</section>
<section style={{ borderRadius: "12px", background: "#004c39", color: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Modo coach</h2><span style={{ padding: "4px 10px", borderRadius: "800px", background: "#ffffff33", fontSize: "12px", lineHeight: "14px" }}>Próximamente</span></div>
<span style={{ opacity: ".86" }}>Con tu memoria y tus objetivos, el coach propondrá mejoras, comparará tu negocio con la competencia y sugerirá campañas.</span>
<a href="#" data-demo="" style={{ color: "#ffffff", textDecoration: "underline" }}>Avísame cuando esté disponible</a>
</section>
</div>
</div>
</main>
</div>
</>
  );
}
