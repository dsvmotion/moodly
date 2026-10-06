import { Fragment } from "react";
import Sidebar from "@/components/app-sidebar";

export default function Screen() {
  return (
    <>

<div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="horarios" /></div>

<main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px", maxWidth: "720px" }}>Horarios. <span style={{ color: "#5f5f63" }}>Cuándo abre tu negocio y qué hacen los agentes cuando está cerrado.</span></h1>
<button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "#000000", color: "#ffffff", font: "400 14px/21px var(--font-display)" }}>Guardar</button>
</div>

<div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
<section style={{ flex: "3 1 460px", minWidth: "0", background: "#ffffff", borderRadius: "12px", padding: "8px 24px 16px", fontSize: "14px", lineHeight: "21px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}><h2 style={{ margin: "0", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Horario de apertura</h2><span style={{ padding: "6px 12px", borderRadius: "800px", boxShadow: "inset 0 0 0 1px #0000001a" }}>Sede Centro ⌄</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Lunes</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>9:00 – 14:00</span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>16:00 – 20:00</span><a href="#" data-demo="" style={{ color: "#2457f5" }}>+ Tramo</a></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Martes</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>9:00 – 14:00</span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>16:00 – 20:00</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Miércoles</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>9:00 – 14:00</span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>16:00 – 20:00</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Jueves</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>9:00 – 14:00</span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>16:00 – 20:00</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Viernes</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#000000", position: "relative" }}><span style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ padding: "8px 14px", borderRadius: "800px", background: "#f4f4f5" }}>9:00 – 15:00</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Sábado</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#d4d4d8", position: "relative" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ color: "#6b6b70" }}>Cerrado</span></div>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0", borderTop: "1px solid #0000000f", flexWrap: "wrap" }}><span style={{ width: "90px" }}>Domingo</span><span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: "#d4d4d8", position: "relative" }}><span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "800px", background: "#ffffff" }}></span></span><span style={{ color: "#6b6b70" }}>Cerrado</span></div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 4px", borderTop: "1px solid #0000000f", flexWrap: "wrap", gap: "8px" }}><span><span style={{ display: "block", fontWeight: "500" }}>Festivos y cierres</span><span style={{ color: "#6b6b70" }}>12 oct · 1 nov · 6 dic · 8 dic · vacaciones 1–15 ago</span></span><a href="#" data-demo="" style={{ color: "#2457f5" }}>Editar calendario</a></div>
</section>

<div style={{ flex: "2 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 4px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Cuando está cerrado</h2>
<label style={{ display: "flex", gap: "12px", padding: "14px", borderRadius: "12px", border: "2px solid #000000", cursor: "pointer" }}><input type="radio" name="cerrado" defaultChecked style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>Atiende y reserva</span><span style={{ color: "#5f5f63" }}>El agente responde y reserva citas para cuando abráis.</span></span></label>
<label style={{ display: "flex", gap: "12px", padding: "15px", borderRadius: "12px", border: "1px solid #0000001a", cursor: "pointer" }}><input type="radio" name="cerrado" style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>Solo toma nota</span><span style={{ color: "#5f5f63" }}>Responde que estáis cerrados y os deja el mensaje para mañana.</span></span></label>
<label style={{ display: "flex", gap: "12px", padding: "15px", borderRadius: "12px", border: "1px solid #0000001a", cursor: "pointer" }}><input type="radio" name="cerrado" style={{ accentColor: "#000000", marginTop: "3px" }} /><span><span style={{ display: "block", fontWeight: "500" }}>No responde</span><span style={{ color: "#5f5f63" }}>Los mensajes esperan a que abráis.</span></span></label>
</section>
<section style={{ background: "#ffffff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", lineHeight: "21px" }}>
<h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Pasar a una persona cuando…</h2>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>El cliente pide hablar con alguien</span><span style={{ color: "#5f5f63" }}>Recepción</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Hay una queja o el cliente está molesto</span><span style={{ color: "#5f5f63" }}>Gerente</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>Es una urgencia</span><span style={{ color: "#5f5f63" }}>Dra. Ruiz</span></div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid #0000000f" }}><span>El agente no sabe la respuesta</span><span style={{ color: "#5f5f63" }}>Recepción</span></div>
<span style={{ marginTop: "8px", fontSize: "12px", lineHeight: "18px", color: "#6b6b70" }}>Avisamos por la app y por WhatsApp a la persona indicada.</span>
</section>
</div>
</div>
</main>
</div>
</>
  );
}
