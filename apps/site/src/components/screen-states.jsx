"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SCREENS, STATES, STATE_LABELS } from "./screen-states-data";

// Estados de pantalla del prototipo (cargando, vacío, error, sin permiso) para las 67
// pantallas, sin tocar cada página: se pinta un panel dentro del <main> de la pantalla
// y se oculta su contenido. Se activan con ?estado=… o con «Ver estados de pantalla»
// del menú de usuario; la barra inferior cambia de estado.
// En apps/web los dan los componentes Skeleton, EmptyState y ErrorState de packages/ui.
const EVT = "moodly-estado-change";

function readState() {
  const e = new URLSearchParams(window.location.search).get("estado");
  return STATES.includes(e) ? e : null;
}

export function setScreenState(next) {
  const url = new URL(window.location.href);
  if (next) url.searchParams.set("estado", next); else url.searchParams.delete("estado");
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(EVT));
}

const path = () => window.location.pathname.replace(/\/$/, "") || "/";

export default function ScreenStates() {
  const [state, setState] = useState(null);
  const [route, setRoute] = useState(null);
  const [host, setHost] = useState(null);

  useEffect(() => {
    const sync = () => { setState(readState()); setRoute(path()); };
    sync();
    window.addEventListener(EVT, sync); window.addEventListener("popstate", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("popstate", sync); };
  }, []);

  const screen = route ? SCREENS[route] : null;
  const active = state && state !== "normal" && screen && !(state === "vacio" && !screen.empty);

  // En escritorio el panel ocupa el sitio de todo lo que hay junto al menú (lista,
  // detalle, ficha…); en móvil, el contenido de dentro del teléfono. La navegación
  // (menú lateral, menú de Configuración) sigue visible.
  useEffect(() => {
    if (!active) return;
    const main = document.querySelector("main");
    if (!main) return;
    const mobile = screen.kind === "movil";
    const container = mobile || !main.parentElement || main.parentElement === document.body ? main : main.parentElement;
    const hidden = [...container.children].filter((el) => mobile || !(el.matches("nav") || el.querySelector("nav")));
    hidden.forEach((el) => el.setAttribute("data-estado-oculto", ""));
    const box = document.createElement("div");
    box.setAttribute("data-estado-panel", mobile ? "movil" : "");
    container.appendChild(box);
    main.setAttribute("aria-busy", state === "cargando" ? "true" : "false");
    setHost(box);
    return () => { box.remove(); hidden.forEach((el) => el.removeAttribute("data-estado-oculto")); main.removeAttribute("aria-busy"); setHost(null); };
  }, [active, state, route, screen]);

  if (!state || !screen) return null;
  return (
    <>
      {active && host && createPortal(<Panel state={state} screen={screen} />, host)}
      <StateBar state={state} screen={screen} />
    </>
  );
}

function StateBar({ state, screen }) {
  return (
    <div role="toolbar" aria-label="Estados de pantalla" style={{ position: "fixed", left: "50%", bottom: "16px", transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: "4px", padding: "5px", borderRadius: "800px", background: "var(--paper)", boxShadow: "0 8px 24px #1b1a1f33, 0 0 0 1px var(--line)", font: "400 13px/18px var(--font-display)", maxWidth: "calc(100vw - 32px)", overflowX: "auto" }}>
      <span style={{ padding: "0 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>Estado</span>
      {STATES.map((s) => {
        const off = s === "vacio" && !screen.empty;
        return (
          <button key={s} type="button" aria-pressed={state === s} disabled={off} title={off ? "Esta pantalla es un paso de un flujo: no tiene estado vacío." : undefined} onClick={() => setScreenState(s)} style={{ padding: "6px 12px", borderRadius: "800px", border: 0, background: state === s ? "var(--ink)" : "transparent", color: state === s ? "var(--on-ink)" : "var(--ink)", font: "inherit", cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.4 : 1, whiteSpace: "nowrap" }}>{STATE_LABELS[s]}</button>
        );
      })}
      <button type="button" aria-label="Cerrar estados de pantalla" onClick={() => setScreenState(null)} style={{ width: "30px", height: "30px", borderRadius: "800px", border: 0, background: "transparent", color: "var(--muted)", font: "inherit", cursor: "pointer", flex: "none" }}>×</button>
    </div>
  );
}

const btnDark = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "40px", padding: "0 18px", borderRadius: "800px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--on-ink)", font: "400 14px/20px var(--font-display)", textDecoration: "none", cursor: "pointer" };
const btnLight = { ...btnDark, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" };
const muted = { color: "var(--muted)" };

function Icon({ d, tone = "var(--sunken)", stroke = "var(--ink)" }) {
  return (
    <span aria-hidden="true" style={{ width: "48px", height: "48px", borderRadius: "800px", background: tone, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
    </span>
  );
}

function Panel({ state, screen }) {
  const mobile = screen.kind === "movil";
  const wrap = { display: "flex", flexDirection: "column", gap: mobile ? "12px" : "20px", width: "100%" };
  const card = { background: "var(--paper)", borderRadius: "12px", padding: mobile ? "24px 18px" : "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "12px" };
  const title = !mobile && <h1 style={{ margin: 0, fontSize: "32px", lineHeight: "35.2px", fontWeight: 400, letterSpacing: "-0.64px" }}>{screen.name}</h1>;

  if (state === "cargando") {
    return (
      <div role="status" style={wrap}>
        <span className="sr-only">Cargando…</span>
        {!mobile && <Bone w="220px" h="34px" />}
        <Skeleton kind={screen.kind} />
      </div>
    );
  }
  if (state === "vacio") {
    const [t, d, [cta, href]] = screen.empty;
    return (
      <div style={wrap}>
        {title}
        <section aria-labelledby="estado-titulo" style={card}>
          <Icon d={<><path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 7l2-3h12l2 3" /><path d="M9 12h6" /></>} />
          <h2 id="estado-titulo" style={{ margin: 0, fontSize: "18px", lineHeight: "24px", fontWeight: 500 }}>{t}</h2>
          <p style={{ margin: 0, maxWidth: "440px", fontSize: "14px", lineHeight: "21px", ...muted }}>{d}</p>
          <a href={href} style={{ ...btnDark, marginTop: "6px" }}>{cta}</a>
        </section>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div style={wrap}>
        {title}
        <section role="alert" aria-labelledby="estado-titulo" style={card}>
          <Icon tone="var(--rose-bg)" stroke="var(--rose-fg)" d={<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></>} />
          <h2 id="estado-titulo" style={{ margin: 0, fontSize: "18px", lineHeight: "24px", fontWeight: 500 }}>No hemos podido cargar esta pantalla</h2>
          <p style={{ margin: 0, maxWidth: "440px", fontSize: "14px", lineHeight: "21px", ...muted }}>Puede ser un problema de conexión o de un servicio externo. No se ha perdido nada de lo que hiciste.</p>
          <span style={{ fontSize: "12px", lineHeight: "18px", ...muted }}>Código de referencia: <span translate="no" style={{ fontFamily: "ui-monospace, monospace" }}>ERR-7F3A-21</span></span>
          <span style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "6px" }}>
            <button type="button" onClick={() => { setScreenState("cargando"); setTimeout(() => setScreenState("normal"), 900); }} style={btnDark}>Reintentar</button>
            <a href="/plataforma/configuracion/integraciones" style={btnLight}>Ver estado de las conexiones</a>
          </span>
        </section>
      </div>
    );
  }
  return <NoAccess screen={screen} wrap={wrap} card={card} title={title} />;
}

function NoAccess({ screen, wrap, card, title }) {
  const [asked, setAsked] = useState(false);
  return (
    <div style={wrap}>
      {title}
      <section aria-labelledby="estado-titulo" style={card}>
        <Icon d={<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>} />
        <h2 id="estado-titulo" style={{ margin: 0, fontSize: "18px", lineHeight: "24px", fontWeight: 500 }}>No tienes acceso a esta pantalla</h2>
        <p style={{ margin: 0, maxWidth: "440px", fontSize: "14px", lineHeight: "21px", ...muted }}>{`Para ver «${screen.name}» hace falta: ${screen.role}.`}</p>
        <p style={{ margin: 0, maxWidth: "440px", fontSize: "14px", lineHeight: "21px", ...muted }}>Tu rol es Recepción. Si lo necesitas, pide acceso a la persona que gestiona el equipo.</p>
        <span style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "6px" }}>
          <button type="button" disabled={asked} onClick={() => setAsked(true)} style={{ ...btnDark, opacity: asked ? 0.6 : 1 }}>{asked ? "Solicitud enviada" : "Pedir acceso"}</button>
          <a href={screen.kind === "movil" ? "/plataforma/movil" : "/plataforma"} style={btnLight}>Volver al inicio</a>
        </span>
        <span role="status" style={{ fontSize: "13px", lineHeight: "19px", color: "var(--green-fg)", minHeight: "19px" }}>{asked ? "Hemos avisado a Marta Ruiz (Dueña). Te llegará un aviso cuando responda." : ""}</span>
      </section>
    </div>
  );
}

function Bone({ w = "100%", h = "14px", r = "8px", style }) {
  return <span aria-hidden="true" className="estado-bone" style={{ display: "block", width: w, height: h, borderRadius: r, background: "var(--sunken)", ...style }} />;
}

// Esqueleto con la forma de cada tipo de pantalla, para que al cargar no salte el diseño.
function Skeleton({ kind }) {
  const box = { background: "var(--paper)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" };
  const rows = (n, avatar) => Array.from({ length: n }, (_, i) => (
    <span key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {avatar && <Bone w="36px" h="36px" r="800px" style={{ flex: "none" }} />}
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}><Bone w={`${55 + ((i * 17) % 35)}%`} /><Bone w={`${30 + ((i * 23) % 30)}%`} h="10px" /></span>
    </span>
  ));
  if (kind === "panel") return (
    <>
      <span style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ ...box, minHeight: "110px" }}><Bone w="50%" /><Bone w="35%" h="32px" /></span>)}</span>
      <span style={box}>{rows(4)}</span>
    </>
  );
  if (kind === "lista") return (
    <span style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(0, 2fr)", gap: "12px" }}>
      <span style={box}>{rows(7, true)}</span>
      <span style={{ ...box, minHeight: "420px" }}><Bone w="40%" h="20px" />{rows(3)}</span>
    </span>
  );
  if (kind === "tabla") return (
    <span style={box}>
      <span style={{ display: "flex", gap: "8px" }}><Bone w="220px" h="36px" r="800px" /><Bone w="120px" h="36px" r="800px" /></span>
      {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "16px", padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}><Bone w="80%" /><Bone w="60%" /><Bone w="50%" /><Bone w="40%" /></span>)}
    </span>
  );
  if (kind === "tarjetas") return <span style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ ...box, minHeight: "150px" }}><Bone w="36px" h="36px" r="800px" /><Bone w="60%" /><Bone w="85%" h="10px" /><Bone w="70%" h="10px" /></span>)}</span>;
  if (kind === "calendario") return <span style={{ ...box, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>{Array.from({ length: 20 }, (_, i) => <Bone key={i} h={`${40 + ((i * 13) % 50)}px`} r="10px" />)}</span>;
  if (kind === "tablero") return <span style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>{[0, 1, 2, 3].map((i) => <span key={i} style={box}><Bone w="50%" />{[0, 1, 2].map((j) => <Bone key={j} h="64px" r="10px" />)}</span>)}</span>;
  if (kind === "chat") return <span style={{ ...box, minHeight: "420px" }}>{[0, 1, 2, 3, 4].map((i) => <Bone key={i} w={`${45 + ((i * 19) % 30)}%`} h="44px" r="14px" style={{ alignSelf: i % 2 ? "flex-end" : "flex-start" }} />)}</span>;
  if (kind === "movil") return <span style={{ display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><Bone h="76px" r="12px" /><Bone h="76px" r="12px" /></span><span style={box}>{rows(5, true)}</span></span>;
  return <span style={box}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}><Bone w="25%" h="10px" /><Bone h="40px" r="10px" /></span>)}<Bone w="140px" h="40px" r="800px" style={{ alignSelf: "flex-end" }} /></span>;
}
