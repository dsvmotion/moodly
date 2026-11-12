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
