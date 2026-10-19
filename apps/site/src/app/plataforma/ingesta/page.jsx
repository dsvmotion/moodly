"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";

// Flujo: ingesta de conocimiento. Añadir una fuente (archivo, página web o texto
// pegado) y verla pasar por subida → procesado → indexada, con el número de
// fragmentos. El paso que faltaba entre "Conocimiento" vacío y el agente citando
// documentos del negocio.
// TODO(backend): knowledge_sources + knowledge_chunks (pgvector); subida a
// Storage; troceado + embeddings en el worker (pg-boss); estado por fuente.
const box = { background: "#ffffff", border: "1px solid #0000001a", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "#5f5f63", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #000000", background: "#000000", color: "#ffffff", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const TABS = [{ id: "file", label: "Archivo" }, { id: "url", label: "Página web" }, { id: "text", label: "Pegar texto" }];
const INITIAL = [
  { id: 1, name: "Precios y tratamientos 2026.pdf", meta: "PDF · 320 KB", status: "ready", chunks: 42, when: "hace 3 días" },
  { id: 2, name: "clinicadentalsol.es/faq", meta: "Página web", status: "ready", chunks: 18, when: "hace 3 días" },
  { id: 3, name: "Protocolo de urgencias.docx", meta: "Word · 88 KB", status: "ready", chunks: 11, when: "la semana pasada" },
];
const STATUS = {
  uploading: { label: "Subiendo…", bg: "#eef1f6", fg: "#3a4a63" },
  processing: { label: "Procesando…", bg: "#ffe8d6", fg: "#8e4e00" },
  ready: { label: "Indexada", bg: "#dcebdd", fg: "#004c39" },
};

export default function Ingesta() {
  const [tab, setTab] = useState("file");
  const [name, setName] = useState("");
  const [sources, setSources] = useState(INITIAL);
  const reduced = useRef(false);
  const nextId = useRef(100);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const placeholder = tab === "url" ? "https://tusitio.es/precios" : tab === "text" ? "Pega aquí el texto (política de cancelación, FAQ…)" : "Nombre.pdf (o arrastra un archivo)";

  const add = () => {
    const label = name.trim() || (tab === "url" ? "nueva-pagina.es" : tab === "text" ? "Texto pegado" : "Documento.pdf");
    const meta = tab === "url" ? "Página web" : tab === "text" ? "Texto · pegado" : "PDF · nuevo";
    const id = nextId.current++;
    setSources((s) => [{ id, name: label, meta, status: "uploading", chunks: 0, when: "ahora" }, ...s]);
    setName("");
    const step = (status, chunks) => setSources((s) => s.map((x) => (x.id === id ? { ...x, status, chunks } : x)));
    const d = reduced.current ? 0 : 1;
    setTimeout(() => step("processing", 0), d ? 900 : 0);
    setTimeout(() => step("ready", 7 + Math.floor(Math.random() * 20)), d ? 2400 : 0);
  };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "#000000", background: "#f4f4f5", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@keyframes mo-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}.mo-rise{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="conocimiento" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>Conocimiento del negocio</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>Lo que subas aquí es lo que el agente usa para responder. Añade precios, protocolos o tu FAQ; lo troceamos e indexamos solo.</span>
        </div>

        <section style={{ ...box, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div role="tablist" aria-label="Tipo de fuente" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", borderRadius: "800px", border: "1px solid", borderColor: tab === t.id ? "#000000" : "#0000001a", background: tab === t.id ? "#000000" : "#ffffff", color: tab === t.id ? "#ffffff" : "#000000", font: "500 13px/13px var(--font-display)", cursor: "pointer" }}>{t.label}</button>
            ))}
          </div>
          {tab === "text" ? (
            <textarea value={name} onChange={(e) => setName(e.target.value)} rows={4} placeholder={placeholder} style={{ resize: "vertical", padding: "12px 14px", borderRadius: "12px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000" }} />
          ) : tab === "file" ? (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "28px", borderRadius: "12px", border: "1.5px dashed #0000002a", background: "#fafafa", textAlign: "center", cursor: "pointer" }}>
              <span style={{ fontSize: "22px" }} aria-hidden="true">⬆︎</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ width: "min(320px, 100%)", padding: "10px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000", textAlign: "center" }} />
              <span style={{ fontSize: "12px", ...muted }}>PDF, Word o texto · hasta 20 MB</span>
            </label>
          ) : (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ padding: "11px 14px", borderRadius: "10px", border: "1px solid #0000001a", font: "400 14px/20px var(--font-body)", color: "#000000" }} />
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={add} style={btnDark}>Añadir al conocimiento</button></div>
        </section>

        <section style={{ ...box, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #0000000f", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>Fuentes</span>
            <span style={{ fontSize: "13px", ...muted }}>{sources.filter((s) => s.status === "ready").length} indexadas · {sources.reduce((a, s) => a + s.chunks, 0)} fragmentos</span>
          </div>
          {sources.map((s, i) => {
            const st = STATUS[s.status];
            return (
              <div key={s.id} className={s.when === "ahora" ? "mo-rise" : undefined} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", padding: "14px 20px", borderTop: i ? "1px solid #0000000f" : 0, flexWrap: "wrap", animation: s.when === "ahora" ? "mo-rise .3s ease both" : undefined }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                  <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: "14px" }} aria-hidden="true">{s.meta.startsWith("Página") ? "🌐" : s.meta.startsWith("Texto") ? "✎" : "📄"}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ fontSize: "14px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    <span style={{ fontSize: "12px", ...muted }}>{s.meta} · {s.status === "ready" ? `${s.chunks} fragmentos` : s.when}</span>
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "4px 11px", borderRadius: "800px", background: st.bg, color: st.fg, fontSize: "12px", flex: "none" }}>
                  {s.status !== "ready" && <span className="mo-spin" style={{ width: "11px", height: "11px", borderRadius: "800px", border: `2px solid ${st.fg}44`, borderTopColor: st.fg, animation: "mo-spin .7s linear infinite" }} />}
                  {st.label}
                </span>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
