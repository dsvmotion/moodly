"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 5000;

/**
 * La bandeja se pone al día sola: mientras la pestaña está a la vista, vuelve a
 * pedir la página cada 5 s (los mensajes los escriben el worker y los canales).
 * Con la pestaña oculta no pide nada, y al volver se pone al día enseguida.
 * Tiempo real de verdad (Realtime) llegará cuando haga falta: ver el PR.
 */
export function InboxRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
