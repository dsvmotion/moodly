"use client";
import { useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { callsFor } from "@/components/sede-data";

// Llamadas por sede (ver sede-data): lista + detalle. Seleccionar una llamada
// muestra su resumen, acciones y transcripción. TODO(backend): calls (grabación
// solo con consentimiento) + transcripción del proveedor de voz.
const KIND = {
  reserva: { icon: "☎", bg: "#004c39", fg: "#ffffff", label: "Cita reservada" },
  confirma: { icon: "✓", bg: "#004c39", fg: "#ffffff", label: "Asistencia confirmada" },
  info: { icon: "i", bg: "var(--mist)", fg: "var(--ink)", label: "Información" },
  traspaso: { icon: "→", bg: "var(--amber-bg)", fg: "var(--amber-fg)", label: "Pasada a una persona" },
};
const TOTAL = { "Sede Centro": 42, "Sede Norte": 18, "Todas las sedes": 60 };
const FILTERS = [["todas", "Todas"], ["traspaso", "Pasadas a una persona"], ["reserva", "Con cita"]];
const pill = { padding: "10px 16px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", textDecoration: "none" };

export default function Screen() {
  const { sede } = useSede();
  const calls = callsFor(sede);
  const [filter, setFilter] = useState("todas");
  const [selKey, setSelKey] = useState(null);
  const [playing, setPlaying] = useState(false);
  const keyOf = (c) => `${c.name}|${c.time}`;
  const visible = calls.filter((c) => filter === "todas" || c.kind === filter);
  const cur = visible.find((c) => keyOf(c) === selKey) ?? visible[0] ?? null;
  const pick = (c) => { setSelKey(keyOf(c)); setPlaying(false); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="llamadas" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Llamadas. <span style={{ color: "var(--muted)" }}>Hoy: {TOTAL[sede] ?? 42} atendidas, 0 perdidas.</span></h1>
          <a href="/plataforma/voz?a=reception" style={{ ...pill, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}>Voz y saludo</a>
        </div>
        <Pills label="Filtrar llamadas" options={FILTERS} value={filter} onChange={setFilter} size="sm" />

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "2 1 360px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", overflow: "hidden", fontSize: "14px", lineHeight: "21px" }}>
            {visible.length === 0 && <p style={{ margin: 0, padding: "20px 16px", color: "var(--muted)" }}>No hay llamadas con este filtro.</p>}
            {visible.map((c, i) => {
              const k = KIND[c.kind]; const on = cur && keyOf(c) === keyOf(cur);
              return (
                <button key={keyOf(c)} type="button" aria-pressed={on} onClick={() => pick(c)} style={{ width: "100%", textAlign: "left", display: "flex", gap: "12px", padding: "14px 16px", background: on ? "var(--tint)" : "transparent", border: 0, borderTop: i ? "1px solid var(--line-soft)" : 0, font: "inherit", color: "var(--ink)", cursor: "pointer" }}>
                  <span aria-hidden="true" style={{ width: "36px", height: "36px", borderRadius: "800px", background: k.bg, color: k.fg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "13px" }}>{k.icon}</span>
                  <span style={{ flex: "1", minWidth: "0" }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "500" }}>{c.name}</span><span style={{ fontSize: "12px", color: "var(--muted-2)", whiteSpace: "nowrap" }}>{c.time} · {c.dur}</span></span>
                    <span style={{ display: "block", color: "var(--muted)" }}>{c.line}{c.sede ? ` · ${c.sede}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </section>

          {cur && (
            <section aria-label={`Llamada de ${cur.name}`} style={{ flex: "3 1 460px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span><span style={{ display: "block", fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{cur.name}</span><span style={{ fontSize: "14px", lineHeight: "21px", color: "var(--muted)" }}>{`${cur.time} · ${cur.dur} · atendida por ${cur.agent} · ${KIND[cur.kind].label}`}</span></span>
                <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {cur.client ? <a href={`/plataforma/clientes?c=${encodeURIComponent(cur.client)}`} style={{ ...pill, border: "1px solid var(--line)", color: "var(--ink)" }}>Ver ficha</a> : <span style={{ ...pill, color: "var(--muted-2)" }}>Sin ficha</span>}
                  <button data-demo="" type="button" style={{ ...pill, border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)", cursor: "pointer" }}>Llamar de vuelta</button>
                </span>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px", fontSize: "14px", lineHeight: "21px" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "var(--canvas)" }}>
                  <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pausar grabación" : "Reproducir grabación"} style={{ width: "36px", height: "36px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", cursor: "pointer" }}>{playing ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"></path></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>}</button>
                  <span style={{ flex: "1", height: "4px", borderRadius: "800px", background: "var(--track)" }}><span style={{ display: "block", width: playing ? "55%" : "0%", height: "4px", borderRadius: "800px", background: "var(--ink)", transition: "width 1.2s linear" }}></span></span>
                  <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{playing ? "en curso" : "0:00"} / {cur.dur}</span>
                </div>
                <div style={{ borderRadius: "12px", background: "var(--sage)", padding: "14px 16px" }}><strong style={{ fontWeight: "500" }}>Resumen:</strong> {cur.summary}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{cur.tags.map(([bg, t]) => <span key={t} style={{ padding: "5px 10px", borderRadius: "800px", background: bg, fontSize: "12px", lineHeight: "14px" }}>{t}</span>)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>Transcripción</span>
                  {cur.transcript.map(([who, text], i) => <div key={i} style={{ display: "flex", gap: "12px" }}><span style={{ width: "72px", color: "var(--muted-2)", flex: "none" }}>{who}</span><span>{text}</span></div>)}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
