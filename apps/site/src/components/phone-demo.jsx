"use client";
import { useEffect, useRef, useState } from "react";

/*
 * Demo de teléfono en vivo: una conversación de WhatsApp que se escribe sola y
 * muestra a los agentes trabajando (reserva una cita, crea la ficha, pide
 * aprobación). Es el único momento con movimiento autónomo de la web: enseña el
 * producto en acción en vez de un pantallazo estático.
 * Respeta prefers-reduced-motion (muestra el estado final, sin animación).
 *
 * `scale` encoge el teléfono (p. ej. en el collage del hero) manteniendo la
 * proporción; sin `scale` es responsive (se adapta al ancho del móvil).
 */

// Guion. type: 'in' (cliente), 'out' (agente), 'chips', 'typing'. ms = espera antes.
const SCRIPT = [
  { type: "in", text: "Hola, ¿tenéis hueco para una limpieza dental esta semana?", ms: 700 },
  { type: "typing", ms: 900 },
  { type: "out", text: "¡Hola, Laura! Tengo el jueves a las 10:30 o el viernes a las 17:00. ¿Cuál te viene mejor?", ms: 500 },
  { type: "in", text: "El jueves perfecto", ms: 1100 },
  { type: "chips", chips: [["Calendar · Cita creada", "#9dbecc"], ["CRM · Ficha actualizada", "#a3c2a7"]], ms: 800 },
  { type: "typing", ms: 700 },
  { type: "out", text: "Hecho: jueves a las 10:30 con la Dra. Ruiz. Te enviaré un recordatorio el día antes.", ms: 500 },
];
const RESET_MS = 3200;

function Bubble({ item }) {
  const mine = item.type === "out";
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <span
        style={{
          maxWidth: "80%",
          padding: "9px 13px",
          borderRadius: "14px",
          fontSize: "13.5px",
          lineHeight: "19px",
          fontFamily: "var(--font-body)",
          background: mine ? "#000000" : "#ffffff",
          color: mine ? "#ffffff" : "#000000",
          border: mine ? "0" : "1px solid #0000000f",
          boxShadow: "0 1px 2px #00000008",
        }}
      >
        {item.text}
      </span>
    </div>
  );
}

export default function PhoneDemo({ scale }) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const reduced = useRef(false);
  const scroller = useRef(null);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced.current) {
      setShown(SCRIPT.length);
      return;
    }
    let step = 0;
    let timer;
    const run = () => {
      if (step >= SCRIPT.length) {
        timer = setTimeout(() => {
          setShown(0);
          setTyping(false);
          step = 0;
          run();
        }, RESET_MS);
        return;
      }
      const item = SCRIPT[step];
      timer = setTimeout(() => {
        if (item.type === "typing") {
          setTyping(true);
          step += 1;
          run();
        } else {
          setTyping(false);
          step += 1;
          setShown(step);
          run();
        }
      }, item.ms);
    };
    run();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced.current ? "auto" : "smooth" });
  }, [shown, typing]);

  const visible = SCRIPT.slice(0, shown).filter((s) => s.type !== "typing");

  const phone = (
    <div
      aria-label="Demostración: un agente de Moodly reserva una cita por WhatsApp"
      role="img"
      style={{
        width: scale ? "320px" : "min(320px, 86vw)",
        borderRadius: "40px",
        border: "8px solid #000000",
        background: "#000000",
        boxShadow: "0 30px 64px #00000033",
        overflow: "hidden",
        flex: "none",
      }}
    >
      <style>{`
        @keyframes mo-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes mo-pop { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
        @keyframes mo-blink { 0%, 60%, 100% { opacity: .25; } 30% { opacity: 1; } }
        .mo-anim { animation: mo-rise .32s cubic-bezier(.2,.7,.2,1) both; }
        .mo-chips { animation: mo-pop .3s ease both; }
        @media (prefers-reduced-motion: reduce) { .mo-anim, .mo-chips { animation: none !important; } }
      `}</style>
      <div style={{ height: "564px", background: "#ece9e2", display: "flex", flexDirection: "column", fontFamily: "var(--font-display)" }}>
        <div style={{ background: "#004c39", color: "#ffffff", padding: "40px 16px 12px", display: "flex", alignItems: "center", gap: "10px", flex: "none" }}>
          <span style={{ width: "34px", height: "34px", borderRadius: "800px", background: "#ffffff22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500 }}>LM</span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: "15px", fontWeight: 500 }}>Laura M.</span>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>WhatsApp · Recepción atiende</span>
          </span>
        </div>
        <div ref={scroller} style={{ flex: 1, overflow: "hidden", padding: "14px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ alignSelf: "center", fontSize: "11px", color: "#6b6b70", background: "#ffffffcc", borderRadius: "800px", padding: "2px 10px" }}>Hoy</span>
          {visible.map((item, i) =>
            item.type === "chips" ? (
              <div key={i} className="mo-chips" style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {item.chips.map(([label, bg]) => (
                  <span key={label} style={{ padding: "5px 10px", borderRadius: "800px", background: bg, fontSize: "11px", lineHeight: "14px", fontFamily: "var(--font-body)" }}>{label}</span>
                ))}
              </div>
            ) : (
              <div key={i} className="mo-anim">
                <Bubble item={item} />
              </div>
            ),
          )}
          {typing ? (
            <div className="mo-anim" style={{ alignSelf: "flex-start", display: "flex", gap: "4px", padding: "11px 14px", borderRadius: "14px", background: "#ffffff", border: "1px solid #0000000f" }}>
              {[0, 1, 2].map((d) => (
                <span key={d} style={{ width: "6px", height: "6px", borderRadius: "800px", background: "#9b9ba1", animation: `mo-blink 1s ${d * 0.2}s infinite` }} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!scale) return phone;
  // Footprint real = (320 contenido + 16 borde) x (564 + 16) escalado.
  return (
    <div style={{ width: `${336 * scale}px`, height: `${580 * scale}px`, flex: "none" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{phone}</div>
    </div>
  );
}
