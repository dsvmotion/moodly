"use client";
import { useState } from "react";
import MobileFrame from "@/components/mobile-frame";
import { SEDES, useSede } from "@/components/use-sede";

// Ajustes (móvil): los avisos son interruptores reales; «Sede activa» cambia la
// sede de toda la plataforma (la misma que el selector de escritorio).
// TODO(backend): preferencias de notificación por usuario + push (PWA).
const NOTIFS = [["aprob", "Algo espera tu aprobación", true], ["urg", "Urgencias y quejas", true], ["integ", "Integración desconectada", true], ["semanal", "Resumen semanal", false]];
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", color: "var(--ink)", textDecoration: "none", width: "100%", border: 0, background: "transparent", font: "inherit", cursor: "pointer", textAlign: "left", boxSizing: "border-box" };
const card = { background: "var(--paper)", borderRadius: "12px", overflow: "hidden" };
const label = { fontSize: "12px", color: "var(--muted-2)", padding: "8px 4px 0" };

export default function Screen() {
  const { sede, setSede } = useSede();
  const [on, setOn] = useState(Object.fromEntries(NOTIFS.map(([k, , v]) => [k, v])));
  const nextSede = () => setSede(SEDES[(SEDES.indexOf(sede) + 1) % SEDES.length]);
  return (
    <MobileFrame active="mas" back="/plataforma/movil/mas" title="Ajustes">
      <span style={label}>Avisos en el móvil</span>
      <div style={card}>
        {NOTIFS.map(([k, text], i) => (
          <button key={k} type="button" role="switch" aria-checked={on[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))} style={{ ...row, borderTop: i ? "1px solid var(--line-soft)" : 0 }}>
            <span>{text}</span>
            <span aria-hidden="true" style={{ width: "40px", height: "24px", borderRadius: "800px", background: on[k] ? "var(--ink)" : "var(--track)", position: "relative", flex: "none" }}><span style={{ position: "absolute", top: "3px", left: on[k] ? "19px" : "3px", width: "18px", height: "18px", borderRadius: "800px", background: "var(--paper)", transition: "left .15s ease" }} /></span>
          </button>
        ))}
      </div>
      <span style={label}>Cuenta</span>
      <div style={card}>
        <a href="/plataforma/movil/perfil" style={row}><span>Mi perfil</span><span style={{ color: "var(--muted-2)" }}>›</span></a>
        <button type="button" onClick={nextSede} style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Sede activa</span><span style={{ color: "var(--muted-2)" }}>{sede.replace("Sede ", "")} · cambiar</span></button>
        <button data-demo="" type="button" style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Verificación en dos pasos</span><span style={{ color: "var(--green-fg)" }}>Activada</span></button>
        <button data-demo="" type="button" style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Idioma</span><span style={{ color: "var(--muted-2)" }}>Español ›</span></button>
      </div>
      <span style={label}>Ayuda</span>
      <div style={card}>
        <button data-demo="" type="button" style={row}><span>Hablar con soporte</span><span style={{ color: "var(--muted-2)" }}>›</span></button>
        <a href="/plataforma/configuracion/privacidad" style={{ ...row, borderTop: "1px solid var(--line-soft)" }}><span>Privacidad y datos</span><span style={{ color: "var(--muted-2)" }}>›</span></a>
      </div>
    </MobileFrame>
  );
}
