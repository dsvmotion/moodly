// Estado de una función o integración en la web pública (auditoría 2026-11-10, N-01;
// decisión de producto del 2026-11-10). Sale del registro de alcance (docs/scope.yaml),
// nunca caso a caso:
//   status done                 → «Disponible»
//   hito del piloto (M0–M4)     → «En el piloto»
//   after o stretch             → «En hoja de ruta»
// next.config.ts lee el registro al compilar y lo deja en NEXT_PUBLIC_SCOPE_STATUS.
const SCOPE = JSON.parse(process.env.NEXT_PUBLIC_SCOPE_STATUS || "{}");
const PILOT = new Set(["M0", "M1", "M2", "M3", "M4"]);

/** @returns {"available" | "pilot" | "roadmap"} */
export function availability(id) {
  const u = SCOPE[id];
  // Sin unidad en el registro no hay estado que enseñar: que falle la compilación
  // (las páginas se prerenderizan) en vez de publicar una afirmación sin respaldo.
  if (!u) throw new Error(`availability: «${id}» no está en docs/scope.yaml`);
  if (u.s === "done") return "available";
  if (PILOT.has(u.m)) return "pilot";
  return "roadmap";
}

/**
 * Cómo se conecta una integración (auditoría §18.8): el campo connect de su fila int-*
 * en docs/scope.yaml, obligatorio allí (lo valida packages/config). Sin él, la compilación falla.
 * @returns {"available" | "pending" | "needs_api_key" | "needs_contract" | "not_possible"}
 */
export function connectOf(id) {
  const u = SCOPE[id];
  if (!u) throw new Error(`connectOf: «${id}» no está en docs/scope.yaml`);
  if (!u.c) throw new Error(`connectOf: «${id}» no tiene connect en docs/scope.yaml`);
  return u.c;
}

// «pending» no lleva nota: la etiqueta de estado ya dice si está en el piloto o en hoja de ruta.
export const CONNECT_LABELS = {
  es: { available: "Se conecta hoy", needs_api_key: "Con tu clave de API", needs_contract: "Necesita un acuerdo con el proveedor", not_possible: "No se puede conectar" },
  en: { available: "Connects today", needs_api_key: "With your API key", needs_contract: "Needs an agreement with the provider", not_possible: "Can't be connected" },
  fr: { available: "Se connecte aujourd'hui", needs_api_key: "Avec votre clé d'API", needs_contract: "Nécessite un accord avec le fournisseur", not_possible: "Connexion impossible" },
  de: { available: "Heute verbindbar", needs_api_key: "Mit deinem API-Schlüssel", needs_contract: "Braucht eine Vereinbarung mit dem Anbieter", not_possible: "Nicht verbindbar" },
};

export function ConnectNote({ id, lang }) {
  const c = connectOf(id);
  if (c === "pending") return null;
  const t = CONNECT_LABELS[lang] || CONNECT_LABELS.es;
  return <span data-connect={c} style={{ fontSize: "12px", lineHeight: "18px", color: "#4a4a4f" }}>{t[c]}</span>;
}

export const AVAILABILITY_LABELS = {
  es: { available: "Disponible", pilot: "En el piloto", roadmap: "En hoja de ruta" },
  en: { available: "Available", pilot: "In the pilot", roadmap: "On the roadmap" },
  fr: { available: "Disponible", pilot: "Dans le pilote", roadmap: "Sur la feuille de route" },
  de: { available: "Verfügbar", pilot: "Im Pilotprojekt", roadmap: "Auf der Roadmap" },
};

const STYLE = {
  available: { background: "#e3f1e5", color: "#1f5a2a" },
  pilot: { background: "#e8edff", color: "#1d3a9e" },
  roadmap: { background: "#f2f2f4", color: "#4a4a4f" },
};

export function AvailabilityBadge({ id, lang }) {
  const a = availability(id);
  const t = AVAILABILITY_LABELS[lang] || AVAILABILITY_LABELS.es;
  return (
    <span data-availability={a} style={{ ...STYLE[a], alignSelf: "flex-start", padding: "2px 8px", borderRadius: "800px", fontSize: "12px", lineHeight: "18px", whiteSpace: "nowrap" }}>{t[a]}</span>
  );
}
