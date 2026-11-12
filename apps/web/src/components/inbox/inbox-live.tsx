"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COALESCE_MS, FALLBACK_REFRESH_MS, LIVE_EVENTS } from "@/lib/inbox-live";

const EVENTS_URL = "/app/inbox/events";

/**
 * La bandeja en vivo (auditoría M-10, ADR 0054). Escucha /app/inbox/events (el
 * relé del mismo origen: solo identificadores) y, con cada aviso, vuelve a
 * pedir la página, que se lee con la sesión (RLS). Los avisos de un mismo
 * cambio se juntan en una sola relectura.
 * - Solo con la pestaña a la vista: al ocultarla se cierra la conexión (no
 *   cuesta nada en el servidor) y al volver se abre y se relee.
 * - Al (re)conectar, una relectura: lo que cambió mientras no escuchaba.
 * - Cada FALLBACK_REFRESH_MS, una relectura aunque no llegue nada: un aviso de
 *   Realtime se puede perder (realtime.send no corta la transacción).
 * - Se monta con `key` = organización activa: al cambiar de organización (o al
 *   salir de la bandeja, o cerrar sesión) se desmonta y la conexión se cierra.
 */
export function InboxLive() {
  const router = useRouter();
  const [status, setStatus] = useState<"open" | "closed">("closed");
  const [received, setReceived] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let source: EventSource | null = null;
    const refreshSoon = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), COALESCE_MS);
    };
    const open = () => {
      if (source) return;
      source = new EventSource(EVENTS_URL);
      source.addEventListener("ready", () => {
        setStatus("open");
        refreshSoon();
      });
      for (const event of LIVE_EVENTS) {
        source.addEventListener(event, () => {
          setReceived((count) => count + 1);
          refreshSoon();
        });
      }
      // Cierre del servidor (tiempo máximo, un canal caído) o sin red: EventSource
      // vuelve a conectar solo; con un 401 o un 204 se queda cerrado y sigue la
      // relectura periódica.
      source.addEventListener("error", () => setStatus("closed"));
    };
    const close = () => {
      source?.close();
      source = null;
      setStatus("closed");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        open();
        refreshSoon();
      } else {
        close();
      }
    };

    if (document.visibilityState === "visible") open();
    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, FALLBACK_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      close();
      clearInterval(fallback);
      clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  // Para los e2e: si la conexión está abierta y cuántos avisos han llegado. No se ve ni se anuncia.
  return <span hidden data-testid="inbox-live" data-status={status} data-received={received} />;
}
