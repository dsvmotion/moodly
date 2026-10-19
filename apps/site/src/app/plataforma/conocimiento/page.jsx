import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="conocimiento" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px", maxWidth: "720px" }}>Conocimiento. <span style={{ color: "var(--muted)" }}>Lo que tus agentes usan para responder. Si no está aquí, no se lo inventan.</span></h1>
<a href="/plataforma/ingesta" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/21px var(--font-display)", textDecoration: "none" }}>Añadir conocimiento</a>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<div style={{ flex: "3 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>

<div style={{ borderRadius: "12px", border: "2px dashed var(--line)", padding: "28px", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", background: "#ffffff66" }}>
<span style={{ width: "48px", height: "48px", borderRadius: "800px", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"></path></svg></span>
<span style={{ flex: "1 1 240px", fontSize: "14px", lineHeight: "21px" }}><span style={{ display: "block", fontSize: "16px", lineHeight: "24px", fontWeight: "500" }}>Arrastra aquí tarifas, cartas, protocolos o folletos</span><span style={{ color: "var(--muted)" }}>PDF, Word, Excel o fotos. También puedes pegar la dirección de tu web.</span></span>
<span style={{ display: "flex", gap: "8px" }}><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)" }}>Subir archivo</button><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/21px var(--font-display)" }}>Añadir web</button></span>
</div>

<section style={{ background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
<div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Fuentes</h2><span style={{ fontSize: "14px", color: "var(--muted-2)" }}>5 fuentes</span></div>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--coral)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "500" }}>PDF</span><span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontWeight: "500" }}>Tarifas 2026.pdf</span><span style={{ color: "var(--muted-2)", fontSize: "12px" }}>Usado por Recepción y Atención · 24 servicios detectados</span></span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Leído</span></div>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--mist)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "500" }}>WEB</span><span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontWeight: "500" }}>clinicadentalsol.es</span><span style={{ color: "var(--muted-2)", fontSize: "12px" }}>12 páginas · se revisa cada semana</span></span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Leído</span></div>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "500" }}>DOC</span><span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontWeight: "500" }}>Preparación antes de una cirugía.docx</span><span style={{ color: "var(--muted-2)", fontSize: "12px" }}>Usado por Atención</span></span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "12px" }}>✓ Leído</span></div>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--linen)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "500" }}>XLS</span><span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontWeight: "500" }}>Aseguradoras aceptadas.xlsx</span><span style={{ color: "var(--muted-2)", fontSize: "12px" }}>Subido hace 2 min</span></span><span style={{ padding: "2px 10px", borderRadius: "800px", background: "var(--sunken)", color: "var(--muted)", fontSize: "12px" }}>Leyendo…</span></div>
<div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 20px", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--ink)", color: "var(--on-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "500" }}>FAQ</span><span style={{ flex: "1 1 200px" }}><span style={{ display: "block", fontWeight: "500" }}>Preguntas frecuentes</span><span style={{ color: "var(--muted-2)", fontSize: "12px" }}>18 respuestas escritas por tu equipo</span></span><a href="#" data-demo="" style={{ fontSize: "14px", color: "var(--blue-fg)" }}>Editar</a></div>
</section>

<section style={{ background: "var(--paper)", borderRadius: "12px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Preguntas frecuentes</h2><a href="#" data-demo="" style={{ color: "var(--blue-fg)" }}>+ Añadir</a></div>
<div style={{ padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}><div style={{ fontWeight: "500" }}>¿Tenéis parking?</div><div style={{ color: "var(--muted)" }}>Sí, parking público a 50 metros, en la calle Calle Mayor.</div></div>
<div style={{ padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}><div style={{ fontWeight: "500" }}>¿Se puede pagar a plazos?</div><div style={{ color: "var(--muted)" }}>Sí, para tratamientos de más de 427 €, hasta 12 meses sin intereses.</div></div>
</section>
</div>

<aside style={{ flex: "2 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<section style={{ background: "var(--amber-bg)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Preguntas sin respuesta</h2>
<span style={{ color: "var(--amber-fg)" }}>Tus clientes preguntaron esto y el agente no lo sabía. Responde una vez y lo sabrá siempre.</span>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontWeight: "500" }}>«¿Aceptáis MediSalud?»</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Preguntado 7 veces esta semana</span><button data-demo="" type="button" style={{ alignSelf: "flex-start", padding: "9px 14px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/20px var(--font-display)" }}>Responder</button></div>
<div style={{ background: "var(--paper)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontWeight: "500" }}>«¿Hacéis ortodoncia invisible?»</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Preguntado 3 veces</span><button data-demo="" type="button" style={{ alignSelf: "flex-start", padding: "9px 14px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/20px var(--font-display)" }}>Responder</button></div>
</section>
<section style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>También usa</h2>
<a href="/plataforma/memoria" style={{ display: "flex", justifyContent: "space-between" }}><span>Servicios, objetivos y reglas</span><span style={{ color: "var(--muted-2)" }}>Memoria ›</span></a>
<a href="/plataforma/horarios" style={{ display: "flex", justifyContent: "space-between" }}><span>Horarios y festivos</span><span style={{ color: "var(--muted-2)" }}>Horarios ›</span></a>
</section>
</aside>
</div>
</main>
</div>
</>
  );
}
