// Estado de cada unidad del registro de alcance (docs/scope.yaml) para la web pública
// (auditoría 2026-11-10, N-01). Lo lee next.config.ts al compilar y lo pasa a las
// páginas como NEXT_PUBLIC_SCOPE_STATUS: la web enseña lo que dice el registro, nunca
// una etiqueta puesta a mano.
//
// El registro escribe cada unidad en una línea, como mapa YAML en flujo:
//   - {id: "int-gmail", name: "Gmail", ..., milestone: "M2", ..., status: "planned", ...}
// Se leen solo id, milestone, status y, en las integraciones, connect (auditoría §18.8),
// sin dependencias nuevas.
import { readFileSync } from "node:fs";

const field = (line, key) => line.match(new RegExp(`[{,]\\s*${key}:\\s*"([^"]*)"`))?.[1];

/** @returns {Record<string, {m: string, s: string, c?: string}>} id → hito, estado y cómo se conecta */
export function parseScopeStatus(text) {
  const out = {};
  for (const line of text.split("\n")) {
    if (!/^\s*-\s*\{/.test(line)) continue;
    const id = field(line, "id");
    const m = field(line, "milestone");
    const s = field(line, "status");
    const c = field(line, "connect");
    if (id && m && s) out[id] = c ? { m, s, c } : { m, s };
  }
  return out;
}

export function readScopeStatus(path) {
  const map = parseScopeStatus(readFileSync(path, "utf8"));
  // Sin registro, la web no puede decir el estado de nada: mejor que falle la compilación.
  if (Object.keys(map).length < 100) throw new Error(`scope-status: ${path} solo tiene ${Object.keys(map).length} unidades legibles`);
  return map;
}
