"use client";

import { toast } from "@repo/ui/components/toast";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COALESCE_MS, createIdleTimer, FALLBACK_REFRESH_MS, IDLE_CLOSE_MS, LIVE_EVENTS } from "@/lib/inbox-live";

const EVENTS_URL = "/app/inbox/events";
/** Lo que cuenta como actividad en la pestaña para no cerrar la conexión por inactividad. */
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "focus"] as const;

/**
 * La bandeja en vivo (auditoría M-10, ADR 0054). Escucha /app/inbox/events (el
 * relé del mismo origen: solo identificadores) y, con cada aviso, vuelve a
 * pedir la página, que se lee con la sesión (RLS). Los avisos de un mismo
 * cambio se juntan en una sola relectura.
 * - Solo con la pestaña a la vista: al ocultarla se cierra la conexión (no
 *   cuesta nada en el servidor) y al volver se abre y se relee.
 * - Tras IDLE_CLOSE_MS sin actividad en la pestaña (ratón, teclado, toque o
 *   foco), también se cierra y se para la relectura periódica; con la
 *   siguiente actividad se abre y se relee.
 * - Al (re)conectar, una relectura: lo que cambió mientras no escuchaba.
 * - Cada FALLBACK_REFRESH_MS, una relectura aunque no llegue nada: un aviso de
 *   Realtime se puede perder (realtime.send no corta la transacción).
 * - Se monta con `key` = organización activa: al cambiar de organización (o al
 *   salir de la bandeja, o cerrar sesión) se desmonta y la conexión se cierra.
 */
export function InboxLive() {
  const router = useRouter();
  const t = useTranslations("inboxPage.handoffNotice");
  // Los textos del aviso, como cadenas: no cambian de un render a otro (solo con
  // el idioma), así que no vuelven a abrir la conexión. `t` sí cambia en cada
  // render: como dependencia del efecto, la cerraría y abriría cada vez.
  const handoffTitle = t("title");
  const handoffDescription = t("description");
  const handoffOpen = t("open");
  const [status, setStatus] = useState<"open" | "closed">("closed");
  const [received, setReceived] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let source: EventSource | null = null;
    const idle = createIdleTimer({
      timeoutMs: IDLE_CLOSE_MS,
      onIdle: () => close(),
      onActive: () => {
        if (document.visibilityState !== "visible") return;
        open();
        refreshSoon();
      },
    });
    const onActivity = () => idle.activity();
    const refreshSoon = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), COALESCE_MS);
    };
    const open = () => {
      if (source || idle.isIdle()) return;
      source = new EventSource(EVENTS_URL);
      source.addEventListener("ready", () => {
        setStatus("open");
        refreshSoon();
      });
      for (const event of LIVE_EVENTS) {
        source.addEventListener(event, (message) => {
          setReceived((count) => count + 1);
          refreshSoon();
          if (event === "handoff") notifyHandoff((message as MessageEvent<string>).data);
        });
      }
      // Cierre del servidor (tiempo máximo, un canal caído) o sin red: EventSource
      // vuelve a conectar solo; con un 401 o un 204 se queda cerrado y sigue la
      // relectura periódica.
      source.addEventListener("error", () => setStatus("closed"));
    };
    // El agente ha pasado una conversación al equipo (CU3): un aviso con el
    // enlace a la conversación. Del relé solo llega el id, validado como uuid.
    const notifyHandoff = (data: string) => {
      const conversationId = parseConversationId(data);
      if (!conversationId) return;
      toast({ title: handoffTitle, description: handoffDescription, action: { label: handoffOpen, href: `/app/inbox/${conversationId}` } });
    };
    const close = () => {
      source?.close();
      source = null;
      setStatus("closed");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        idle.activity();
        open();
        refreshSoon();
      } else {
        close();
      }
    };

    if (document.visibilityState === "visible") open();
    const fallback = setInterval(() => {
      // Inactiva, tampoco: con la siguiente actividad ya se relee.
      if (document.visibilityState === "visible" && !idle.isIdle()) router.refresh();
    }, FALLBACK_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });
    return () => {
      idle.stop();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
      close();
      clearInterval(fallback);
      clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, handoffTitle, handoffDescription, handoffOpen]);

  // Para los e2e: si la conexión está abierta y cuántos avisos han llegado. No se ve ni se anuncia.
  return <span hidden data-testid="inbox-live" data-status={status} data-received={received} />;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseConversationId(data: string): string | null {
  try {
    const value = (JSON.parse(data) as { conversationId?: unknown }).conversationId;
    return typeof value === "string" && UUID.test(value) ? value : null;
  } catch {
    return null;
  }
}
