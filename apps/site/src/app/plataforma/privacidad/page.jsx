"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/app-sidebar";
import { usePlatformLang } from "@/components/plataforma-i18n";

// Flujo: ejercer los derechos RGPD sobre los datos de un cliente — exportar
// (portabilidad / acceso) y borrar (supresión). Con confirmación escrita y un
// periodo de gracia antes del borrado definitivo.
// TODO(backend): export junta datos de todas las tablas del tenant para ese
// cliente (Edge Function, firmado y temporal); el borrado programa un job
// (pg-boss) tras 30 días, anonimiza y deja constancia en audit_logs.
const box = { background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "12px", boxSizing: "border-box" };
const muted = { color: "var(--muted)", fontFamily: "var(--font-body)" };
const btnDark = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };
const btnLight = { padding: "11px 18px", borderRadius: "800px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", font: "500 14px/14px var(--font-display)", cursor: "pointer" };

const INCLUDES = ["Ficha de cliente y datos de contacto", "Conversaciones (WhatsApp, email)", "Citas y su historial", "Facturas emitidas", "Notas y etiquetas del agente"];

export default function Privacidad() {
  const [name, setName] = useState("Laura Martín");
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("c"); if (c) setName(c); }, []);
  const first = name.split(" ")[0];
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [exp, setExp] = useState("idle"); // idle | working | ready
  const [del, setDel] = useState("idle"); // idle | confirming | scheduled
  const [typed, setTyped] = useState("");
  // La palabra que hay que escribir para borrar va en el idioma de la plataforma.
  const [lang] = usePlatformLang();
  const word = { es: "BORRAR", en: "DELETE", fr: "SUPPRIMER", de: "LÖSCHEN" }[lang];
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }, []);

  const runExport = () => { setExp("working"); setTimeout(() => setExp("ready"), reduced.current ? 0 : 1400); };

  return (
    <div style={{ fontFamily: "var(--font-display)", color: "var(--ink)", background: "var(--canvas)", letterSpacing: "-0.16px", WebkitFontSmoothing: "antialiased", minHeight: "100dvh", display: "flex", flexWrap: "wrap" }}>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}}`}</style>
      <div style={{ flex: "1 1 220px", maxWidth: "248px", display: "flex" }}><Sidebar active="clientes" /></div>
      <main style={{ flex: "999 1 560px", minWidth: 0, padding: "32px clamp(16px, 3vw, 40px) 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        <a href={`/plataforma/clientes?c=${encodeURIComponent(name)}`} style={{ fontSize: "14px", color: "var(--muted)" }}>‹ {name}</a>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: "800px", background: "var(--slate-bg)", color: "var(--slate-fg)", fontSize: "12px" }}>Privacidad · RGPD</span>
          <h1 style={{ margin: "4px 0 0", fontSize: "28px", lineHeight: "32px", fontWeight: 400, letterSpacing: "-0.56px" }}>{`Datos de ${name}`}</h1>
          <span style={{ fontSize: "15px", lineHeight: "23px", ...muted }}>{`Si ${first} pide acceder a sus datos o que los borréis, aquí lo gestionas. Ambas acciones quedan registradas con tu nombre y la fecha.`}</span>
        </div>

        {del === "scheduled" && (
          <div role="status" style={{ display: "flex", gap: "12px", alignItems: "flex-start", borderRadius: "12px", background: "var(--rose-bg)", color: "var(--rose-fg)", padding: "16px 20px", fontSize: "14px", lineHeight: "21px", flexWrap: "wrap" }}>
            <span>⏳</span>
            <span style={{ flex: "1 1 240px", minWidth: 0 }}><strong style={{ fontWeight: 500 }}>Borrado programado para el 13 de noviembre de 2026.</strong>{` Hasta esa fecha puedes cancelarlo. Después, los datos de ${first} se eliminan o anonimizan sin vuelta atrás.`}</span>
            <button type="button" onClick={() => { setDel("idle"); setTyped(""); }} style={{ ...btnLight, padding: "8px 14px", flex: "none" }}>Cancelar borrado</button>
          </div>
        )}

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <section style={{ ...box, flex: "1 1 320px", minWidth: 0, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "17px", fontWeight: 500 }}>Exportar datos</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{`Un archivo con todo lo que tenéis de ${first}, para dárselo o guardarlo.`}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "7px" }}>
              {INCLUDES.map((x) => <li key={x} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)" }}><span style={{ color: "var(--green-fg)", flex: "none" }}>✓</span>{x}</li>)}
            </ul>
            <div style={{ marginTop: "auto", paddingTop: "4px" }}>
              {exp === "ready" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 14px", borderRadius: "10px", background: "var(--green-bg)", color: "var(--green-fg)", fontSize: "13px", lineHeight: "19px" }}><span>✓</span><span>Listo: <strong style={{ fontWeight: 500 }}>{`${slug}-datos.zip`}</strong> (1,2 MB). El enlace caduca en 24 h.</span></div>
                  <button type="button" onClick={() => setExp("idle")} style={{ ...btnDark, alignSelf: "flex-start" }}>Descargar ZIP</button>
                </div>
              ) : (
                <button type="button" disabled={exp === "working"} onClick={runExport} style={{ ...btnDark, opacity: exp === "working" ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>{exp === "working" ? <><span className="mo-spin" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid var(--on-ink-55)", borderTopColor: "var(--on-ink)", animation: "mo-spin .7s linear infinite" }} />Preparando…</> : "Generar exportación"}</button>
              )}
            </div>
          </section>

          <section style={{ ...box, flex: "1 1 320px", minWidth: 0, padding: "22px", display: "flex", flexDirection: "column", gap: "14px", borderColor: "var(--rose-line)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "17px", fontWeight: 500, color: "var(--rose-fg)" }}>Borrar datos</span>
              <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{`Elimina o anonimiza todo lo de ${first}. No se puede deshacer una vez pasada la fecha.`}</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: "var(--rose-bg-2)", fontSize: "13px", lineHeight: "19px", fontFamily: "var(--font-body)", color: "var(--rose-fg)" }}><span aria-hidden="true">⚠︎</span><span>Las facturas se conservan anonimizadas el tiempo que exige Hacienda; el resto se elimina.</span></div>
            <div style={{ marginTop: "auto", paddingTop: "4px" }}>
              <button type="button" disabled={del === "scheduled"} onClick={() => setDel("confirming")} style={{ ...btnLight, color: "var(--rose-fg)", borderColor: "var(--rose-line)", opacity: del === "scheduled" ? 0.5 : 1 }}>{del === "scheduled" ? "Borrado programado" : "Solicitar borrado"}</button>
            </div>
          </section>
        </div>
      </main>

      {del === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar borrado" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => { setDel("idle"); setTyped(""); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "440px", background: "var(--paper)", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>{`Borrar los datos de ${name}`}</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Se programará para dentro de 30 días (podrás cancelarlo hasta entonces). Para confirmar, escribe <strong translate="no" style={{ fontWeight: 500, color: "var(--ink)" }}>{word}</strong>.</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={word} aria-label="Escribe BORRAR para confirmar" style={{ padding: "11px 14px", borderRadius: "10px", border: "1px solid var(--line)", font: "500 15px/20px var(--font-body)", letterSpacing: "1px", color: "var(--ink)" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => { setDel("idle"); setTyped(""); }} style={btnLight}>Cancelar</button>
              <button type="button" disabled={typed.trim().toUpperCase() !== word} onClick={() => setDel("scheduled")} style={{ ...btnDark, background: "#a30042", borderColor: "#a30042", color: "#ffffff", opacity: typed.trim().toUpperCase() === word ? 1 : 0.5 }}>Programar borrado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
