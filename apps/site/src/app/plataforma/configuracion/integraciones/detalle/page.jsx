"use client";
import { useEffect, useRef, useState } from "react";
import SettingsShell from "@/components/settings-shell";
import { ALL, INITIAL, detailFor } from "@/components/integrations-data";

// Ficha de una integración (?i=id): salud, reconexión, permisos, actividad y
// desconexión con su impacto. Es el recorrido que faltaba tras «Reconectar».
// TODO(backend): integrations.health + OAuth real del proveedor; los permisos
// mínimos se piden en la autorización; desconectar degrada las skills a «suggest».
const card = { background: "#ffffff", borderRadius: "12px", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px", lineHeight: "21px" };
const h2 = { margin: 0, fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.36px" };
const muted = { color: "#5f5f63" };
const btn = (dark) => ({ padding: "10px 16px", borderRadius: "800px", border: dark ? "1px solid #000000" : "1px solid #0000001a", background: dark ? "#000000" : "#ffffff", color: dark ? "#ffffff" : "#000000", font: "500 14px/14px var(--font-display)", cursor: "pointer", textDecoration: "none" });

export default function Detalle() {
  const [id, setId] = useState("gcal");
  const [phase, setPhase] = useState(null); // null | connecting | done
  const [disc, setDisc] = useState(null);    // null | confirming | done
  const [scopes, setScopes] = useState(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const q = new URLSearchParams(window.location.search).get("i");
    if (q && ALL.some((x) => x.id === q)) setId(q);
  }, []);

  const it = ALL.find((x) => x.id === id);
  const d = detailFor(id);
  const sc = scopes ?? d.scopes;
  const broken = INITIAL[id] === "error" && phase !== "done";
  const connected = !!INITIAL[id] && disc !== "done";
  const reconnect = () => { setPhase("connecting"); setTimeout(() => setPhase("done"), reduced.current ? 0 : 1400); };

  return (
    <SettingsShell active="integraciones" title={it.name} intro={`· ${it.cat}`}>
      <a href="/plataforma/configuracion/integraciones" style={{ fontSize: "14px", color: "#5f5f63", textDecoration: "none" }}>‹ Integraciones</a>
      <style>{`@keyframes mo-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.mo-spin{animation:none!important}}`}</style>

      <section style={{ ...card, flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><img src={`/logos/${it.logo}`} alt="" width="28" height="28" /></span>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "16px", fontWeight: 500 }}>{it.use}</span>
          <span style={muted}>Lo usan: {it.agents} · {connected ? `Conectada el ${d.since} por ${d.by} · última sincronización ${phase === "done" ? "ahora mismo" : d.lastSync}` : "No conectada"}</span>
        </div>
        <span style={{ padding: "5px 12px", borderRadius: "800px", fontSize: "13px", ...(broken ? { background: "#fbe1ea", color: "#a30042" } : connected ? { background: "#dcebdd", color: "#004c39" } : { background: "#ebebed", color: "#5f5f63" }) }}>{broken ? "× Necesita reconexión" : connected ? "● Funcionando" : "○ Desconectada"}</span>
      </section>

      {broken && (
        <section role="alert" style={{ ...card, background: "#fbe1ea", color: "#a30042" }}>
          <strong style={{ fontWeight: 500 }}>Qué ha pasado</strong>
          <span>{d.error}</span>
          {d.affected && <span>Mientras tanto, estas skills han pasado a <strong style={{ fontWeight: 500 }}>proponer en vez de hacer</strong>: {d.affected.join(" · ")}.</span>}
          <span style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" disabled={phase === "connecting"} onClick={reconnect} style={{ ...btn(true), display: "inline-flex", alignItems: "center", gap: "8px", opacity: phase === "connecting" ? 0.6 : 1 }}>
              {phase === "connecting" ? <><span className="mo-spin" aria-hidden="true" style={{ width: "14px", height: "14px", borderRadius: "800px", border: "2px solid #ffffff55", borderTopColor: "#ffffff", animation: "mo-spin .7s linear infinite" }} />Esperando a {it.name.split(" ")[0]}…</> : `Reconectar con ${it.name.split(" ")[0]}`}
            </button>
            <span style={{ fontSize: "13px" }}>Se abrirá una ventana de {it.name.split(" ")[0]} para volver a autorizar. Pedimos solo los permisos marcados abajo.</span>
          </span>
        </section>
      )}
      {phase === "done" && <div role="status" style={{ ...card, background: "#dcebdd", color: "#004c39" }}><span><strong style={{ fontWeight: 500 }}>Reconectada.</strong> {d.affected ? `Las skills ${d.affected.join(", ")} vuelven a funcionar solas.` : "Todo vuelve a funcionar."} Lo hemos anotado en el registro de auditoría.</span></div>}

      {connected && (
        <section style={card}>
          <h2 style={h2}>Permisos</h2>
          <span style={muted}>Lo que {it.name} deja hacer a tus agentes. Desmarca lo que no quieras; nunca pedimos más de lo necesario.</span>
          {sc.map(([label, on], i) => (
            <label key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #0000000f", paddingTop: "12px", cursor: "pointer" }}>
              <span>{label}</span>
              <input type="checkbox" checked={on} onChange={() => setScopes(sc.map((x, j) => (j === i ? [x[0], !x[1]] : x)))} style={{ width: "18px", height: "18px" }} />
            </label>
          ))}
        </section>
      )}

      {connected && (
        <section style={card}>
          <h2 style={h2}>Actividad reciente</h2>
          {[...(phase === "done" ? [["ok", "Ahora", "Reconectada por Marta Ruiz"]] : []), ...d.events].map(([k, when, text], i) => (
            <div key={i} style={{ display: "flex", gap: "12px", alignItems: "baseline", borderTop: "1px solid #0000000f", paddingTop: "10px" }}>
              <span aria-hidden="true" style={{ width: "8px", height: "8px", borderRadius: "800px", background: k === "err" ? "#a30042" : "#004c39", flex: "none" }} />
              <span style={{ width: "86px", flex: "none", ...muted }}>{when}</span>
              <span>{k === "err" ? <span style={{ color: "#a30042" }}>{text}</span> : text}</span>
            </div>
          ))}
        </section>
      )}

      {connected ? (
        <section style={{ ...card, border: "1px solid #a3004233" }}>
          <h2 style={h2}>Desconectar</h2>
          <span style={muted}>Los agentes dejarán de usar {it.name}. Lo que ya está hecho (citas, facturas, mensajes) no se borra.</span>
          <button type="button" onClick={() => setDisc("confirming")} style={{ ...btn(false), alignSelf: "flex-start", color: "#a30042", borderColor: "#a3004233" }}>Desconectar {it.name.split(" ")[0]}</button>
        </section>
      ) : (
        <section style={card}>
          <h2 style={h2}>{disc === "done" ? "Desconectada" : "No conectada"}</h2>
          <span style={muted}>{disc === "done" ? "Puedes volver a conectarla cuando quieras." : `Conecta ${it.name} para que tus agentes puedan: ${it.actions.toLowerCase()}.`}</span>
          <a href={it.cat === "Mensajería" ? "/plataforma/conectar" : "#"} data-demo={it.cat === "Mensajería" ? undefined : ""} style={{ ...btn(true), alignSelf: "flex-start" }}>Conectar {it.name.split(" ")[0]}</a>
        </section>
      )}

      {disc === "confirming" && (
        <div role="dialog" aria-modal="true" aria-label={`Desconectar ${it.name}`} onClick={() => setDisc(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "440px", background: "#ffffff", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 24px 64px #00000033" }}>
            <span style={{ fontSize: "17px", fontWeight: 500 }}>¿Desconectar {it.name}?</span>
            <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>Afecta a: <strong style={{ fontWeight: 500, color: "#000000" }}>{it.agents}</strong>. Sus acciones con {it.name} ({it.actions.toLowerCase()}) dejarán de estar disponibles. Queda registrado.</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setDisc(null)} style={btn(false)}>Cancelar</button>
              <button type="button" onClick={() => setDisc("done")} style={{ ...btn(true), background: "#a30042", borderColor: "#a30042" }}>Desconectar</button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
