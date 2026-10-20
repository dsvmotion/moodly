import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="coach" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "12px", lineHeight: "14px" }}>Próximamente</span><h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px", maxWidth: "720px" }}>Modo coach. <span style={{ color: "var(--muted)" }}>Ideas para crecer, a partir de lo que tus agentes ven cada día.</span></h1></div>
<span style={{ padding: "11px 16px", borderRadius: "800px", background: "var(--paper)", fontSize: "14px", lineHeight: "21px" }}>Semana del 6 de octubre</span>
</div>

<section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Esta semana te propongo</h2>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ borderRadius: "12px", background: "var(--coral)", padding: "22px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "240px" }}><span style={{ fontSize: "12px", opacity: ".75" }}>Marketing</span><span style={{ fontSize: "18px", lineHeight: "22px", letterSpacing: "-0.36px" }}>Recupera a 5 pacientes que no vienen desde hace 6 meses</span><span style={{ opacity: ".75" }}>Una campaña por WhatsApp con revisión gratuita llenaría los martes por la tarde.</span><span style={{ marginTop: "auto", display: "flex", gap: "8px" }}><button data-demo="" type="button" style={{ padding: "9px 14px", borderRadius: "800px", border: "0", background: "#2457f5", color: "#ffffff", font: "400 14px/20px var(--font-display)" }}>Preparar campaña</button><button data-demo="" type="button" style={{ padding: "9px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/20px var(--font-display)" }}>Ahora no</button></span></div>
<div style={{ borderRadius: "12px", background: "var(--mist)", padding: "22px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "240px" }}><span style={{ fontSize: "12px", opacity: ".75" }}>Agenda</span><span style={{ fontSize: "18px", lineHeight: "22px", letterSpacing: "-0.36px" }}>Abre los jueves hasta las 21:00</span><span style={{ opacity: ".75" }}>El 42% de las peticiones de cita que no pudiste atender eran para jueves por la tarde.</span><span style={{ marginTop: "auto", display: "flex", gap: "8px" }}><a href="/plataforma/horarios" style={{ padding: "9px 14px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)" }}>Ver horarios</a><button data-demo="" type="button" style={{ padding: "9px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/20px var(--font-display)" }}>Ahora no</button></span></div>
<div style={{ borderRadius: "12px", background: "var(--sage)", padding: "22px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "240px" }}><span style={{ fontSize: "12px", opacity: ".75" }}>Conocimiento</span><span style={{ fontSize: "18px", lineHeight: "22px", letterSpacing: "-0.36px" }}>7 pacientes preguntaron por MediSalud</span><span style={{ opacity: ".75" }}>Si la aceptáis, decirlo en la web y en el agente podría traer nuevos pacientes.</span><span style={{ marginTop: "auto", display: "flex", gap: "8px" }}><a href="/plataforma/conocimiento" style={{ padding: "9px 14px", borderRadius: "800px", background: "var(--ink)", color: "var(--on-ink)" }}>Responder</a><button data-demo="" type="button" style={{ padding: "9px 14px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/20px var(--font-display)" }}>Ahora no</button></span></div>
</div>
</section>

<div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "3 1 460px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", overflowX: "auto" }}>
<div style={{ padding: "18px 24px 8px" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Frente a tu competencia</h2><span style={{ fontSize: "12px", lineHeight: "18px", color: "var(--muted-2)" }}>Clínicas dentales a menos de 2 km · datos públicos</span></div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", lineHeight: "21px", minWidth: "480px" }}>
<thead><tr style={{ textAlign: "left" }}><th style={{ padding: "10px 24px", fontWeight: "500" }}></th><th style={{ padding: "10px", fontWeight: "500" }}>Tú</th><th style={{ padding: "10px", fontWeight: "500" }}>Media de la zona</th><th style={{ padding: "10px 24px", fontWeight: "500" }}></th></tr></thead>
<tbody>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}>Valoración en Google</td><td style={{ padding: "12px 10px" }}>4,6</td><td style={{ padding: "12px 10px" }}>4,4</td><td style={{ padding: "12px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Mejor</span></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}>Número de reseñas</td><td style={{ padding: "12px 10px" }}>427</td><td style={{ padding: "12px 10px" }}>427</td><td style={{ padding: "12px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>! Por debajo</span></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}>Precio de una limpieza</td><td style={{ padding: "12px 10px" }}>42 €</td><td style={{ padding: "12px 10px" }}>42 €</td><td style={{ padding: "12px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--canvas)", fontSize: "12px" }}>= Similar</span></td></tr>
<tr style={{ borderTop: "1px solid var(--line-soft)" }}><td style={{ padding: "12px 24px" }}>Cita online o por WhatsApp</td><td style={{ padding: "12px 10px" }}>Sí, 24/7</td><td style={{ padding: "12px 10px" }}>4 de 4</td><td style={{ padding: "12px 24px" }}><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Mejor</span></td></tr>
</tbody>
</table>
</section>

<section style={{ flex: "2 1 300px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Tus objetivos</h2><a href="/plataforma/memoria" style={{ color: "var(--blue-fg)" }}>Editar</a></div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span>Llenar las tardes de los martes</span><span>64 %</span></span><span style={{ height: "8px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: "64%", height: "8px", borderRadius: "800px", background: "#004c39" }}></span></span></div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span>Ausencias por debajo del 5 %</span><span>80 %</span></span><span style={{ height: "8px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: "80%", height: "8px", borderRadius: "800px", background: "#004c39" }}></span></span></div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ display: "flex", justifyContent: "space-between" }}><span>5 reseñas en Google</span><span>45 %</span></span><span style={{ height: "8px", borderRadius: "800px", background: "var(--sunken)" }}><span style={{ display: "block", width: "45%", height: "8px", borderRadius: "800px", background: "#a30042" }}></span></span></div>
</section>
</div>
</main>
</div>
</>
  );
}
