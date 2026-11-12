// P-08: resumen de estado generado desde docs/scope.yaml.
//
// El registro usa una sola fila por línea en formato de mapa de flujo
// (`- {id: "X", status: "done", evidence: [...]}`). No hay analizador de YAML
// entre las dependencias del monorepo (y no se añaden), así que este módulo lee
// ese formato conocido y falla con el número de línea ante cualquier fila rara,
// en lugar de ignorarla en silencio.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Row = { [key: string]: Json };

export const STATUSES = ["planned", "in_progress", "done", "blocked"] as const;
export type Status = (typeof STATUSES)[number];
export const MILESTONES = ["M0", "M1", "M2", "M3", "M4", "M5"] as const;
/**
 * Cómo se conecta cada integración (auditoría §18.8; V1, 2026-11-12). Lista cerrada y
 * obligatoria en las filas int-*: la web (/integraciones) la lee de aquí.
 */
// «pending»: aún no se puede conectar y no hay más que decir; no confundir con el status de la fila.
export const CONNECT_VALUES = ["available", "pending", "needs_api_key", "needs_contract", "not_possible"] as const;
export type Connect = (typeof CONNECT_VALUES)[number];
export const EXTRA_BUCKETS = ["stretch", "after"] as const;

export type Item = {
  id: string;
  group: string;
  milestone: string;
  owner: string;
  status: Status;
  text: string;
  evidence: string[];
  /** Solo en las filas int-* (obligatorio allí). */
  connect?: Connect;
  line: number;
};

export type Scope = {
  asOfCommit: string;
  updated: string;
  milestoneNames: Record<string, string>;
  items: Item[];
};

export class ScopeParseError extends Error {}

/** Lee un valor de flujo: cadena entre comillas, lista, mapa, número, null o booleano. */
export function parseFlowValue(src: string): Json {
  let pos = 0;
  const fail = (msg: string): never => {
    throw new ScopeParseError(`${msg} (posición ${pos})`);
  };
  const skip = () => {
    while (pos < src.length && /\s/.test(src[pos] as string)) pos++;
  };
  const string = (): string => {
    pos++; // comilla de apertura
    let out = "";
    while (pos < src.length) {
      const c = src[pos] as string;
      if (c === "\\") {
        const next = src[pos + 1];
        if (next === undefined) return fail("escape sin terminar");
        out += next === "n" ? "\n" : next === "t" ? "\t" : next;
        pos += 2;
      } else if (c === '"') {
        pos++;
        return out;
      } else {
        out += c;
        pos++;
      }
    }
    return fail("cadena sin cerrar");
  };
  const value = (): Json => {
    skip();
    const c = src[pos];
    if (c === undefined) return fail("valor ausente");
    if (c === '"') return string();
    if (c === "[") {
      pos++;
      const list: Json[] = [];
      skip();
      if (src[pos] === "]") {
        pos++;
        return list;
      }
      for (;;) {
        list.push(value());
        skip();
        if (src[pos] === ",") {
          pos++;
          skip();
          if (src[pos] === "]") {
            pos++;
            return list;
          }
        } else if (src[pos] === "]") {
          pos++;
          return list;
        } else return fail("se esperaba , o ]");
      }
    }
    if (c === "{") {
      pos++;
      const map: Row = {};
      skip();
      if (src[pos] === "}") {
        pos++;
        return map;
      }
      for (;;) {
        skip();
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(pos));
        if (!m) return fail("clave no válida");
        pos += m[0].length;
        skip();
        if (src[pos] !== ":") return fail("se esperaba :");
        pos++;
        map[m[0]] = value();
        skip();
        if (src[pos] === ",") {
          pos++;
          skip();
          if (src[pos] === "}") {
            pos++;
            return map;
          }
        } else if (src[pos] === "}") {
          pos++;
          return map;
        } else return fail("se esperaba , o }");
      }
    }
    const m = /^[^\s,\]}]+/.exec(src.slice(pos));
    if (!m) return fail("valor no válido");
    pos += m[0].length;
    const word = m[0];
    if (word === "null" || word === "~") return null;
    if (word === "true") return true;
    if (word === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(word)) return Number(word);
    return word;
  };
  const result = value();
  skip();
  if (pos !== src.length) fail("texto sobrante tras el valor");
  return result;
}

const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");

function toItem(row: Row, group: string, line: number): Item {
  const where = `línea ${line}`;
  const id = str(row.id);
  if (id === "") throw new ScopeParseError(`${where}: la fila no tiene id`);
  const status = str(row.status);
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new ScopeParseError(`${where} (${id}): estado no válido «${status}»`);
  }
  const milestone = str(row.milestone);
  if (milestone === "") throw new ScopeParseError(`${where} (${id}): falta milestone`);
  const evidence = row.evidence;
  if (!Array.isArray(evidence) || evidence.some((e) => typeof e !== "string")) {
    throw new ScopeParseError(`${where} (${id}): evidence debe ser una lista de cadenas`);
  }
  const connect = row.connect;
  if (connect !== undefined && !(CONNECT_VALUES as readonly string[]).includes(str(connect))) {
    throw new ScopeParseError(`${where} (${id}): connect no válido «${str(connect)}»`);
  }
  if (id.startsWith("int-") && connect === undefined) {
    throw new ScopeParseError(`${where} (${id}): falta connect (${CONNECT_VALUES.join(" | ")})`);
  }
  const name = str(row.name);
  const note = str(row.note);
  return {
    id,
    group,
    milestone,
    owner: str(row.owner),
    status: status as Status,
    text: name !== "" && note !== "" ? `${name}: ${note}` : name !== "" ? name : note,
    evidence: evidence as string[],
    ...(connect !== undefined ? { connect: connect as Connect } : {}),
    line,
  };
}

function parseRow(text: string, line: number): Row {
  let v: Json;
  try {
    v = parseFlowValue(text);
  } catch (e) {
    throw new ScopeParseError(`línea ${line}: fila mal formada: ${(e as Error).message}`);
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new ScopeParseError(`línea ${line}: se esperaba un mapa {…}`);
  }
  return v;
}

/** Lee docs/scope.yaml (formato de una fila por línea) y devuelve sus unidades. */
export function parseScope(yaml: string): Scope {
  const lines = yaml.split("\n");
  const items: Item[] = [];
  const milestoneNames: Record<string, string> = {};
  const scalars: Record<string, string> = {};
  let top = "";
  let area = "";
  let inUnits = false;

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) return;
    const topKey = /^([a-z_0-9]+):\s*(.*)$/.exec(raw);
    if (topKey) {
      top = topKey[1] as string;
      area = "";
      inUnits = false;
      const rest = (topKey[2] as string).trim();
      if (rest !== "") scalars[top] = rest.replace(/^"|"$/g, "");
      return;
    }
    if (top === "milestones") {
      const m = /^ {2}([A-Za-z0-9]+): (\{.*\})\s*$/.exec(raw);
      if (!m) throw new ScopeParseError(`línea ${line}: fila de milestones mal formada`);
      milestoneNames[m[1] as string] = str(parseRow(m[2] as string, line).name);
      return;
    }
    if (top === "findings" || top === "founder_tasks") {
      const m = /^ {2}- (\{.*\})\s*$/.exec(raw);
      if (!m) throw new ScopeParseError(`línea ${line}: se esperaba una fila «- {…}» en ${top}`);
      items.push(toItem(parseRow(m[1] as string, line), top, line));
      return;
    }
    if (top === "areas") {
      const areaKey = /^ {2}([a-z_0-9]+):\s*$/.exec(raw);
      if (areaKey) {
        area = areaKey[1] as string;
        inUnits = false;
        return;
      }
      if (/^ {4}units:\s*$/.test(raw)) {
        inUnits = true;
        return;
      }
      if (/^ {4}[a-z_0-9]+:/.test(raw)) {
        inUnits = false;
        const single = /^ {4}pilot_booking_system: (\{.*\})\s*$/.exec(raw);
        if (single) {
          const row = parseRow(single[1] as string, line);
          items.push(toItem({ id: "pilot_booking_system", evidence: [], ...row }, area, line));
        }
        return;
      }
      if (inUnits) {
        const m = /^ {6}- (\{.*\})\s*$/.exec(raw);
        if (!m) throw new ScopeParseError(`línea ${line}: fila de ${area}.units mal formada (una por línea)`);
        items.push(toItem(parseRow(m[1] as string, line), area, line));
      }
    }
  });

  const seen = new Map<string, number>();
  for (const it of items) {
    const key = `${it.group}/${it.id}`;
    const prev = seen.get(key);
    if (prev !== undefined) throw new ScopeParseError(`línea ${it.line}: id repetido ${it.id} (ya en la línea ${prev})`);
    seen.set(key, it.line);
  }
  if (items.length === 0) throw new ScopeParseError("no se ha leído ninguna unidad");
  return { asOfCommit: scalars.as_of_commit ?? "", updated: scalars.updated ?? "", milestoneNames, items };
}

/** Problemas de contenido: done sin evidencia, hitos desconocidos. */
export function findProblems(scope: Scope): string[] {
  const known = new Set<string>([...MILESTONES, ...EXTRA_BUCKETS]);
  const problems: string[] = [];
  for (const it of scope.items) {
    if (it.status === "done" && it.evidence.length === 0) {
      problems.push(`${it.id} (línea ${it.line}): marcada done sin evidencia`);
    }
    if (!known.has(it.milestone)) {
      problems.push(`${it.id} (línea ${it.line}): hito desconocido «${it.milestone}»`);
    }
  }
  return problems;
}

const clip = (s: string, n: number): string => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length <= n ? one : `${one.slice(0, n - 1).trimEnd()}…`;
};

export const COMMAND = "pnpm docs:status";
const OPEN_LIMIT = 12;

/** Resumen en Markdown; determinista (sin fechas de ejecución). */
export function renderStatus(scope: Scope): string {
  const count = (m: string, s: Status) => scope.items.filter((i) => i.milestone === m && i.status === s).length;
  const out: string[] = [
    "# Estado por hito (generado desde docs/scope.yaml)",
    "",
    `Fuente: \`docs/scope.yaml\` (registro a ${scope.updated}, commit ${scope.asOfCommit}). Se imprime con \`${COMMAND}\`; no se commitea.`,
    "El historial y el detalle viven en `docs/STATUS.md`; esto es solo el resumen del registro.",
    "",
    "| Hito | Nombre | Total | done | in_progress | blocked | planned |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  const buckets = [...MILESTONES, ...EXTRA_BUCKETS];
  for (const m of buckets) {
    const total = scope.items.filter((i) => i.milestone === m).length;
    out.push(
      `| ${m} | ${scope.milestoneNames[m] ?? "-"} | ${total} | ${count(m, "done")} | ${count(m, "in_progress")} | ${count(m, "blocked")} | ${count(m, "planned")} |`,
    );
  }
  out.push("", "## En curso o bloqueado", "", "Solo `in_progress` y `blocked`; las `planned` solo se cuentan arriba.");
  for (const m of MILESTONES) {
    const open = scope.items.filter((i) => i.milestone === m && (i.status === "in_progress" || i.status === "blocked"));
    out.push("", `### ${m}${scope.milestoneNames[m] ? ` · ${scope.milestoneNames[m]}` : ""}`, "");
    if (open.length === 0) {
      out.push("Nada en curso.");
      continue;
    }
    for (const it of open.slice(0, OPEN_LIMIT)) {
      const ev = it.evidence.length === 0 ? "sin evidencia" : it.evidence.slice(0, 2).map((e) => clip(e, 40)).join("; ");
      out.push(`- \`${it.id}\` · ${it.owner || "sin responsable"} · ${it.status} · ${clip(it.text, 90)} · ${ev}`);
    }
    if (open.length > OPEN_LIMIT) out.push(`- … y ${open.length - OPEN_LIMIT} más en \`docs/scope.yaml\`.`);
  }
  const flagged = findProblems(scope);
  out.push("", "## Avisos", "");
  if (flagged.length === 0) out.push("Ninguno: toda unidad `done` tiene evidencia.");
  else for (const p of flagged) out.push(`- ${p}`);
  return `${out.join("\n")}\n`;
}
