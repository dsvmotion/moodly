"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 2000;
const MAX_TRIES = 60;

/**
 * Mientras el agente trabaja, vuelve a pedir la página cada 2 s (como mucho 2
 * minutos): el turno lo hace el worker y la respuesta llega a la base de datos.
 */
export function TestChatRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > MAX_TRIES) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
