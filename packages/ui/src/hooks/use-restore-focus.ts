"use client";

import { useEffect, useRef } from "react";

/**
 * Devuelve el foco al elemento que lo tenía cuando se abrió un diálogo
 * controlado desde fuera (sin su Trigger: p. ej. ⌘K o una fila de tabla).
 * Radix solo lo hace con su propio Trigger; sin esto el foco cae en <body>
 * al cerrar (WCAG 2.4.3). Úsese en `onCloseAutoFocus` del contenido.
 */
export function useRestoreFocus(open: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      previous.current = document.activeElement;
    }
  }, [open]);

  return (event: Event) => {
    const target = previous.current;
    previous.current = null;
    if (target && target.isConnected) {
      event.preventDefault();
      target.focus();
    }
  };
}
