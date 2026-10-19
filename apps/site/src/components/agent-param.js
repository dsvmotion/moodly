"use client";
import { useEffect, useState } from "react";

// Agente activo en los flujos de agente (Probar, Publicar, Voz, Techo de autonomía).
// Lee ?a= para que el flujo abra el agente desde el que llegas, no uno fijo.
// Acepta la clave canónica (@repo/config AGENT_TYPES) o la de sede-data.
export const AGENT_NAMES = { reception: "Recepción", customer: "Atención al cliente", sales: "Comercial", admin: "Administración" };
const ALIAS = { recepcion: "reception", atencion: "customer", comercial: "sales", admin: "admin" };

export function toAgentKey(k) {
  if (!k) return null;
  if (AGENT_NAMES[k]) return k;
  return ALIAS[k] ?? null;
}

export function useAgentParam(fallback = "reception") {
  const [key, setKey] = useState(fallback);
  useEffect(() => {
    const k = toAgentKey(new URLSearchParams(window.location.search).get("a"));
    if (k) setKey(k);
  }, []);
  return { key, name: AGENT_NAMES[key], setKey };
}
