"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import Pills from "@/components/pills";
import { useSede } from "@/components/use-sede";
import { pageData, clientDetail } from "@/components/sede-data";

// Clientes por sede (ver sede-data): lista + ficha. Seleccionar una fila cambia la
// ficha; los filtros y el buscador filtran de verdad. Admite ?c=Nombre para abrir
// un cliente concreto desde otras pantallas (llamadas, conversaciones, leads).
const FILTERS = [["todos", "Todos"], ["cita", "Con cita próxima"], ["inactivo", "Sin venir 6+ meses"], ["presupuesto", "Presupuesto pendiente"]];
const pillBtn = { padding: "10px 16px", borderRadius: "800px", fontSize: "14px", lineHeight: "21px", textDecoration: "none" };

export default function Screen() {
  const { sede } = useSede();
  const d = pageData("clientes", sede);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [selName, setSelName] = useState(null);

  // ?c=Nombre → preselecciona ese cliente (solo al cargar).
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("c"); if (c) setSelName(c); }, []);

  const visible = d.list.filter((c) => (filter === "todos" || (c.seg ?? []).includes(filter)) && (!q.trim() || `${c.name} ${c.sub}`.toLowerCase().includes(q.trim().toLowerCase())));
  // Si el seleccionado no está en la lista visible (cambio de sede/filtro), se muestra el primero visible.
  const current = visible.find((c) => c.name === selName) ?? visible[0] ?? null;
  const det = clientDetail(current);

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="clientes" /></div>

      <main style={{ flex: "999 1 560px", minWidth: "0", padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "32px", lineHeight: "35.2px", fontWeight: "400", letterSpacing: "-0.64px" }}>Clientes. <span style={{ color: "var(--muted)" }}>{`${d.count} fichas, actualizadas por tus agentes.`}</span></h1>
          <div style={{ display: "flex", gap: "8px" }}><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "400 14px/21px var(--font-display)" }}>Importar</button><button data-demo="" type="button" style={{ padding: "11px 18px", borderRadius: "800px", border: "0", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/21px var(--font-display)" }}>Añadir cliente</button></div>
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ flex: "2 1 380px", minWidth: "0", background: "var(--paper)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid var(--line-soft)" }}>
              <label htmlFor="buscar-cli" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar cliente</label>
              <input id="buscar-cli" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o motivo" style={{ padding: "11px 16px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--canvas)", font: "400 14px/21px var(--font-display)", color: "var(--ink)" }} />
              <Pills label="Filtrar clientes" options={FILTERS} value={filter} onChange={setFilter} size="sm" />
            </div>
            <div style={{ fontSize: "14px", lineHeight: "21px" }}>
              {visible.length === 0 && <p style={{ margin: 0, padding: "20px 16px", color: "var(--muted)" }}>Ningún cliente coincide con el filtro.</p>}
              {visible.map((c, i) => {
                const on = current && c.name === current.name;
                return (
                  <button key={`${c.name}-${c.sede ?? ""}`} type="button" aria-pressed={on} onClick={() => setSelName(c.name)} style={{ width: "100%", textAlign: "left", display: "flex", gap: "12px", alignItems: "center", padding: "12px 16px", background: on ? "var(--tint)" : "transparent", border: 0, borderTop: i === 0 ? "none" : "1px solid var(--line-soft)", font: "inherit", color: "var(--ink)", cursor: "pointer" }}>
                    <span style={{ width: "36px", height: "36px", borderRadius: "800px", background: c.color, boxShadow: c.color === "var(--linen)" ? "inset 0 0 0 1px var(--line)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500", flex: "none" }}>{c.initials}</span>
                    <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontWeight: "500" }}>{c.name}</span><span style={{ display: "block", fontSize: "12px", color: "var(--muted-2)" }}>{c.sub}{c.sede ? ` · ${c.sede}` : ""}</span></span>
                    {c.flag ? <span style={{ padding: "2px 8px", borderRadius: "800px", background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: "12px" }}>{c.flag}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {det && (
            <section aria-label={`Ficha de ${det.name}`} style={{ flex: "3 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <span style={{ width: "64px", height: "64px", borderRadius: "800px", background: det.color, boxShadow: det.color === "var(--linen)" ? "inset 0 0 0 1px var(--line)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "500", flex: "none" }}>{det.initials}</span>
                <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "21px" }}>
                  <span style={{ fontSize: "24px", lineHeight: "26.4px", letterSpacing: "-0.48px" }}>{det.name}</span>
                  <span style={{ color: "var(--muted)" }}>{det.meta}</span>
                  <span style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>{det.tags.map((t, i) => (<span key={i} style={{ padding: "4px 10px", borderRadius: "800px", background: t.startsWith("✓") ? "var(--green-bg)" : "var(--canvas)", color: t.startsWith("✓") ? "var(--green-fg)" : "var(--ink)", fontSize: "12px" }}>{t}</span>))}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a href={`/plataforma/conversaciones?c=${encodeURIComponent(det.name)}`} style={{ ...pillBtn, border: "1px solid var(--line)", color: "var(--ink)" }}>Escribir</a>
                  <a href="/plataforma/agenda" style={{ ...pillBtn, background: "var(--ink)", color: "var(--on-ink)" }}>Nueva cita</a>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                {Object.entries(det.stats).map(([k, v]) => (
                  <div key={k} style={{ background: "var(--paper)", borderRadius: "12px", padding: "16px" }}><span style={{ display: "block", fontSize: "12px", color: "var(--muted)" }}>{k}</span><span style={{ fontSize: "24px", letterSpacing: "-0.48px" }}>{v}</span></div>
                ))}
              </div>

              <div style={{ background: "var(--paper)", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", fontSize: "14px", lineHeight: "21px" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "18px", lineHeight: "19.8px", fontWeight: "400", letterSpacing: "-0.36px" }}>Historial</h2>
                {det.history.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: "14px", padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}><span style={{ width: "10px", height: "10px", marginTop: "6px", borderRadius: "800px", background: h.color, flex: "none" }}></span><span style={{ flex: "1" }}>{h.text}</span><span style={{ fontSize: "12px", color: "var(--muted-2)" }}>{h.time}</span></div>
                ))}
              </div>

              <div style={{ background: "var(--paper)", borderRadius: "12px", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "14px", lineHeight: "21px" }}>
                <span style={{ color: "var(--muted)" }}>{`Datos personales de ${det.name.split(" ")[0]}: exportar o borrar (RGPD)`}</span>
                <a href={`/plataforma/privacidad?c=${encodeURIComponent(det.name)}`} style={{ color: "var(--blue-fg)", textDecoration: "none" }}>Privacidad y datos →</a>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
