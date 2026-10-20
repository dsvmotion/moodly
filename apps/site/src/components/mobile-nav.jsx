"use client";
import { useEffect, useState } from "react";
import { Menu, Stamp } from "lucide-react";
import { useSede } from "./use-sede";
import { approvalsCount } from "./sede-data";

// Plataforma en móvil y tableta vertical (< 900 px): el menú lateral de cada pantalla (el principal o el
// de Configuración, marcados con data-sidenav) pasa a un cajón que se abre desde una
// barra superior. Abierto, el cajón es un diálogo modal: el foco entra, Tab no sale y
// Escape o el fondo lo cierran (lo gestiona dialog-a11y.jsx). En escritorio no cambia nada.
// En apps/web esto lo da el Sheet de packages/ui.
const MQ = "(max-width: 899px)";

export default function MobileNav() {
  const [drawer, setDrawer] = useState(null);
  const [open, setOpen] = useState(false);
  const { sede } = useSede();

  useEffect(() => {
    const nav = document.querySelector("[data-sidenav]");
    const box = nav?.parentElement;
    if (!box) return;
    box.setAttribute("data-sidenav-box", "");
    box.id ||= "menu-lateral";
    document.documentElement.setAttribute("data-has-sidenav", "");
    setDrawer(box);
    const mq = window.matchMedia(MQ);
    const onMq = () => { if (!mq.matches) setOpen(false); };
    mq.addEventListener("change", onMq);
    return () => { mq.removeEventListener("change", onMq); document.documentElement.removeAttribute("data-has-sidenav"); };
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const html = document.documentElement;
    if (open) {
      html.setAttribute("data-nav-open", "");
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-modal", "true");
      drawer.setAttribute("aria-label", "Menú");
    } else {
      html.removeAttribute("data-nav-open");
      ["role", "aria-modal", "aria-label"].forEach((a) => drawer.removeAttribute(a));
    }
    // Escape (dialog-a11y pulsa el propio cajón) y los enlaces del menú cierran el cajón.
    const onClick = (e) => { if (e.target === drawer || e.target.closest("a")) setOpen(false); };
    drawer.addEventListener("click", onClick);
    return () => drawer.removeEventListener("click", onClick);
  }, [open, drawer]);

  if (!drawer) return null;
  const count = approvalsCount(sede);
  return (
    <>
      <div className="mnav-bar" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "56px", zIndex: 70, alignItems: "center", gap: "8px", padding: "0 8px 0 4px", background: "var(--canvas)", borderBottom: "1px solid var(--line-soft)", boxSizing: "border-box" }}>
        <button type="button" aria-label="Abrir menú" aria-expanded={open} aria-controls={drawer.id} onClick={() => setOpen(true)} style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color: "var(--ink)", borderRadius: "10px", cursor: "pointer" }}>
          <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <a href="/plataforma" style={{ display: "flex", alignItems: "center" }}><img src="/brand/moodly-logo-black.svg" alt="Moodly" width="78" height="20" style={{ display: "block" }} /></a>
        <a href="/plataforma/aprobaciones" aria-label={`Aprobaciones · ${count}`} style={{ marginLeft: "auto", position: "relative", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
          <Stamp size={20} strokeWidth={1.75} aria-hidden="true" />
          {count > 0 && <span aria-hidden="true" style={{ position: "absolute", top: "6px", right: "4px", minWidth: "18px", height: "18px", padding: "0 5px", boxSizing: "border-box", borderRadius: "800px", background: "#ff6301", color: "#000000", fontSize: "11px", lineHeight: "18px", textAlign: "center" }}>{count}</span>}
        </a>
      </div>
      {open && <div aria-hidden="true" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 75, background: "var(--backdrop)", opacity: 0.55 }} />}
    </>
  );
}
