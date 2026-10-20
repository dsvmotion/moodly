"use client";
import { useEffect } from "react";

// Accesibilidad común a todos los diálogos del prototipo (role="dialog" aria-modal="true"):
// - al abrirse, el foco entra en el diálogo (primer campo o, si no hay, primer botón);
// - Tab y Mayús+Tab no salen del diálogo;
// - Escape lo cierra (equivale a pulsar el fondo, que ya cierra cada diálogo);
// - al cerrarse, el foco vuelve al control que lo abrió.
// Además, las cajas que se desplazan sin tener nada enfocable dentro se pueden alcanzar
// con el teclado (en móvil, sobre todo las tablas anchas).
// En apps/web esto lo dará el componente Dialog de packages/ui (Radix).
const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const topDialog = () => { const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]'); return all[all.length - 1] || null; };

export default function DialogA11y() {
  useEffect(() => {
    // El botón que abre el diálogo puede desmontarse en el mismo render: recordamos el último foco.
    let open = null; let opener = null; let lastFocus = null;
    const onFocus = (e) => { if (!topDialog()?.contains(e.target)) lastFocus = e.target; };
    const sync = () => {
      const d = topDialog();
      if (d === open) return;
      if (d && !open) opener = lastFocus || document.activeElement;
      open = d;
      if (d) {
        const field = d.querySelector('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])');
        (field || d.querySelector(FOCUSABLE))?.focus();
      } else if (opener) {
        // Si React ha sustituido el botón que lo abrió, el foco vuelve al título de la página.
        const gone = !opener.isConnected || opener === document.body;
        const target = gone ? document.querySelector("main h1, h1, main") : opener;
        if (target && gone) target.tabIndex = -1;
        target?.focus(); opener = null;
      }
    };
    const onKey = (e) => {
      const d = topDialog(); if (!d) return;
      if (e.key === "Escape") { e.preventDefault(); d.click(); return; }
      if (e.key !== "Tab") return;
      const items = [...d.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (!d.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // Cajas con desplazamiento (tablas anchas en móvil, listas con altura máxima) que no
    // tienen nada enfocable dentro: se les da tabindex para poder desplazarlas con el teclado.
    const scrollables = () => document.querySelectorAll("main *").forEach((el) => {
      const cs = getComputedStyle(el);
      const scrolls = (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) || (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1);
      if (scrolls && !el.hasAttribute("tabindex") && !el.querySelector(FOCUSABLE)) el.setAttribute("tabindex", "0");
    });
    scrollables(); window.addEventListener("resize", scrollables);
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey); document.addEventListener("focusin", onFocus);
    return () => { mo.disconnect(); document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); window.removeEventListener("resize", scrollables); };
  }, []);
  return null;
}
