import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Control 3.2 (CLAUDE.md: «consultas del worker sin organization_id explícito»
// están prohibidas). Las lecturas y escrituras por tenantDb (.from) ya llevan
// la organización; este test mira el SQL a mano (TenantSql, como moodly_worker
// bajo RLS): cada consulta contra una tabla de public lleva la organización
// explícita además de RLS, para que una política mal escrita no abra nada.
//
// La regla, por consulta (el primer argumento de .query, un texto literal):
// - un insert nombra organization_id entre sus columnas;
// - cualquier otra (select, update, delete) tiene al menos tantos filtros
//   «organization_id =» como tablas de public nombra (una por tabla, también
//   en los join, las subconsultas y detrás de cada coma del from o del
//   delete … using).
// Una consulta cuyo SQL no es un texto literal no se puede leer: o es una
// excepción de la lista, con su porqué, o no vale.

const SRC = join(import.meta.dirname);

/** Lo que no cumple la regla a propósito, con su porqué. Una entrada que ya no aparece hace fallar el test: se quita. */
const ALLOWED: readonly { file: string; contains: string; why: string }[] = [
  {
    file: "lease.ts",
    contains: "client.query<{ locked: boolean }>(TRY_LOCK",
    why: "lock consultivo en la base de datos de sistema de DBOS: no toca datos de ninguna organización",
  },
  { file: "lease.ts", contains: "client.query(UNLOCK", why: "suelta el mismo lock consultivo" },
  {
    file: "system-db-pool.ts",
    contains: "client.query(`SET idle_in_transaction_session_timeout",
    why: "ajuste de la sesión de la base de datos de sistema de DBOS: no toca datos de ninguna organización",
  },
  {
    file: "integrations/koibox.ts",
    contains: "sql.query<{ timezone: string }>( zoneLocation ?",
    why: "dos textos literales en un ternario; revisado: los dos llevan organization_id = $1",
  },
];

export interface QueryCall {
  file: string;
  line: number;
  /** El texto de la llamada, desde «.query» (para la lista de excepciones). */
  call: string;
  /** El SQL, si el primer argumento es un texto literal sin ${}. */
  sql: string | null;
}

/** El código sin comentarios de TypeScript (las líneas con // y los comentarios de bloque), con las mismas líneas. */
function withoutComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
}

/** Las llamadas a .query de un archivo, con su SQL si es literal. */
export function queryCalls(file: string, raw: string): QueryCall[] {
  const source = withoutComments(raw);
  const calls: QueryCall[] = [];
  const pattern = /([\w$.]*)\.query(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*/g;
  for (const match of source.matchAll(pattern)) {
    const start = (match.index ?? 0) + match[0].length;
    const line = source.slice(0, match.index).split("\n").length;
    const call = source.slice(match.index, start + 80).replace(/\s+/g, " ");
    const quote = source[start];
    let sql: string | null = null;
    if (quote === "`" || quote === '"' || quote === "'") {
      const end = source.indexOf(quote, start + 1);
      const text = source.slice(start + 1, end);
      sql = quote === "`" && text.includes("${") ? null : text;
    }
    calls.push({ file, line, call, sql });
  }
  return calls;
}

/** Palabras que pueden ir detrás de una tabla y no son su alias. */
const NOT_ALIAS = new Set([
  "where", "join", "inner", "left", "right", "full", "cross", "on", "set", "order", "group", "limit", "offset",
  "returning", "using", "values", "select", "union", "and", "or", "for", "having", "window", "natural", "lateral",
]);

/** Esquemas que no son de tenants: la base de datos de sistema, el catálogo y las funciones de private. */
const OTHER_SCHEMAS = new Set(["private", "pg_catalog", "information_schema", "dbos", "auth", "extensions"]);

interface TableRef {
  table: string;
  /** Con lo que se la nombra en los filtros: su alias o, sin alias, su nombre. */
  name: string;
  aliased: boolean;
}

/** El SQL sin comentarios (-- y bloques) y en una sola línea: un filtro en un comentario no cuenta. */
function cleanSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El índice justo después del paréntesis que cierra el que abre en «open». */
function afterParens(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")" && --depth === 0) return i + 1;
  }
  return text.length;
}

const ITEM = /^\s*(?:only\s+)?("?[a-z_][a-z0-9_]*"?)(?:\.("?[a-z_][a-z0-9_]*"?))?/i;
const ALIAS = /^\s+(?:as\s+)?([a-z_][a-z0-9_]*)/i;

/**
 * Un elemento de un from, un join, un update o un insert, desde «at»: la tabla
 * (o null si es una función, una subconsulta u otro esquema) y dónde acaba,
 * con su alias y la lista de columnas del alias («as d(key, value)»).
 */
function readItem(text: string, at: number): { ref: TableRef | null; end: number } {
  let end: number;
  let ref: TableRef | null = null;
  const lead = /^\s*/.exec(text.slice(at))?.[0].length ?? 0;
  if (text[at + lead] === "(") {
    end = afterParens(text, at + lead); // una subconsulta
  } else {
    const item = ITEM.exec(text.slice(at));
    if (!item) return { ref: null, end: at };
    end = at + item[0].length;
    const call = /^\s*\(/.exec(text.slice(end));
    if (call) {
      end = afterParens(text, end + call[0].length - 1); // una función de tabla o una llamada
    } else {
      const first = (item[1] ?? "").replace(/"/g, "").toLowerCase();
      const second = item[2]?.replace(/"/g, "").toLowerCase();
      const schema = second ? first : null;
      const table = second ?? first;
      const counts = schema ? schema === "public" : !OTHER_SCHEMAS.has(table) && !NOT_ALIAS.has(table);
      if (!counts) return { ref: null, end };
      ref = { table, name: table, aliased: false };
    }
  }
  const alias = ALIAS.exec(text.slice(end));
  const name = alias?.[1]?.toLowerCase();
  if (name !== undefined && !NOT_ALIAS.has(name)) {
    end += alias?.[0].length ?? 0;
    if (ref) ref = { ...ref, name, aliased: true };
    const columns = /^\s*\(/.exec(text.slice(end));
    if (columns) end = afterParens(text, end + columns[0].length - 1);
  }
  return { ref, end };
}

/**
 * Las tablas que nombra una consulta, con su alias: detrás de from (y de cada
 * coma de su lista), join, update, into, delete from y delete … using (y sus
 * comas). Con esquema public o sin esquema (el search_path del worker resuelve
 * una tabla sin esquema en public). No cuentan las funciones («from
 * jsonb_each(…)»), las subconsultas ni otros esquemas; sí las tablas que van
 * detrás de ellas en la misma lista.
 */
function tableRefs(text: string): TableRef[] {
  const refs: TableRef[] = [];
  for (const match of text.matchAll(/\b(from|using|join|update|into)\b/gi)) {
    const keyword = (match[1] ?? "").toLowerCase();
    // «join … using (columna)»: la lista de columnas del join, no una tabla.
    if (keyword === "using" && /^\s*\(/.test(text.slice((match.index ?? 0) + match[0].length))) continue;
    const list = keyword === "from" || keyword === "using";
    let at = (match.index ?? 0) + match[0].length;
    for (;;) {
      const { ref, end } = readItem(text, at);
      if (ref) refs.push(ref);
      const comma = list && end > at ? /^\s*,/.exec(text.slice(end)) : null;
      if (!comma) break;
      at = end + comma[0].length;
    }
  }
  return refs;
}

/**
 * Por qué una consulta no cumple la regla, o null si la cumple (o no toca
 * tablas de tenants). Cada tabla que lee, cambia o borra tiene su filtro
 * «<tabla o alias>.organization_id = $n», o igual al organization_id de otra
 * tabla ya ligada a un parámetro (transitivo); sin alias, también vale
 * «organization_id = $n» sin calificar, una vez por tabla sin alias. Y al
 * menos un filtro va a un parámetro: «organization_id = organization_id» no
 * liga nada. Un insert nombra organization_id entre sus columnas y, si sus
 * filas salen de un select, ese select cumple la misma regla.
 */
export function violation(sql: string): string | null {
  const text = cleanSql(sql);
  const insert = /^insert\s+into\s+(?:public\.)?[a-z_]+\s*\(([^)]*)\)\s*(.*)$/i.exec(text);
  if (insert) {
    if (!/\borganization_id\b/.test(insert[1] ?? "")) return "un insert sin organization_id entre sus columnas";
    const rest = insert[2] ?? "";
    return /^select\b/i.test(rest) ? filtersViolation(rest) : null;
  }
  return filtersViolation(text);
}

function filtersViolation(text: string): string | null {
  const refs = tableRefs(text);
  if (refs.length === 0) return null;
  const column = "([a-z_][a-z0-9_]*\\.)?organization_id";
  const value = "(\\$\\d+|[a-z_][a-z0-9_]*\\.organization_id)";
  // Cada comparación, en los dos sentidos: «x.organization_id = $1» o «$1 = x.organization_id».
  const pairs: { left: string | null; right: string }[] = [];
  for (const match of text.matchAll(new RegExp(`${column}\\s*=\\s*${value}`, "gi"))) {
    pairs.push({ left: match[1] ? match[1].slice(0, -1).toLowerCase() : null, right: (match[2] ?? "").toLowerCase() });
  }
  for (const match of text.matchAll(new RegExp(`(\\$\\d+)\\s*=\\s*${column}`, "gi"))) {
    pairs.push({ left: match[2] ? match[2].slice(0, -1).toLowerCase() : null, right: (match[1] ?? "").toLowerCase() });
  }
  if (!pairs.some((pair) => pair.right.startsWith("$"))) return "ningún filtro organization_id va a un parámetro";

  // Las tablas con nombre (alias o tabla) ligadas: a un parámetro, o a otra ya ligada (que no sea ella misma).
  const bound = new Set<string>();
  let unqualified = 0;
  for (let changed = true; changed; ) {
    changed = false;
    unqualified = 0;
    for (const pair of pairs) {
      const target = pair.right.startsWith("$") ? "param" : pair.right.split(".")[0] ?? "";
      const ok = target === "param" || (bound.has(target) && target !== pair.left);
      if (!ok) continue;
      if (pair.left === null) unqualified += 1;
      else if (!bound.has(pair.left)) {
        bound.add(pair.left);
        changed = true;
      }
      // Lo transitivo en el otro sentido: «c.organization_id = m.organization_id» con m ligada liga c.
    }
    for (const pair of pairs) {
      if (pair.left && !pair.right.startsWith("$")) {
        const other = pair.right.split(".")[0] ?? "";
        if (bound.has(pair.left) && other !== pair.left && !bound.has(other)) {
          bound.add(other);
          changed = true;
        }
      }
    }
  }
  const unaliasedUnbound = refs.filter((ref) => !ref.aliased && !bound.has(ref.name));
  const missing = [
    ...refs.filter((ref) => ref.aliased && !bound.has(ref.name)),
    ...unaliasedUnbound.slice(Math.min(unqualified, unaliasedUnbound.length)),
  ];
  if (missing.length === 0) return null;
  return `sin organization_id ligado a un parámetro en: ${missing.map((ref) => (ref.aliased ? `${ref.table} ${ref.name}` : ref.table)).join(", ")}`;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "testing" ? [] : sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".integration.ts") ? [path] : [];
  });
}

describe("la regla (para que el test mida algo)", () => {
  it("detecta una consulta sin la organización, y da por buena la que la lleva en cada tabla", () => {
    expect(violation("select id from public.messages where id = $1")).not.toBeNull();
    expect(violation("select id from public.messages where organization_id = $2 and id = $1")).toBeNull();
    expect(
      violation("select c.id from public.messages m join public.conversations c on c.id = m.conversation_id where m.organization_id = $2 and m.id = $1"),
    ).not.toBeNull();
    expect(
      violation(
        "select c.id from public.messages m join public.conversations c on c.id = m.conversation_id where m.organization_id = $2 and c.organization_id = $2",
      ),
    ).toBeNull();
    expect(violation("update public.agent_runs set status = 'completed' where id = $1")).not.toBeNull();
    expect(violation("insert into public.messages (conversation_id, content) values ($1, $2)")).not.toBeNull();
    expect(violation("insert into public.messages (organization_id, conversation_id) values ($1, $2)")).toBeNull();
    // Solo seleccionar la columna no es filtrar por ella.
    expect(violation("select organization_id, id from public.approvals where id = $1")).not.toBeNull();
    // Sin tablas de public (funciones de private, la base de datos de sistema): no aplica.
    expect(violation("select private.worker_agent_turn_context($1) as context")).toBeNull();
  });

  it("los huecos de la revisión de V10 (#331): sin esquema, tautologías, una tabla filtrada dos veces y filtros en comentarios", () => {
    // Una tabla sin esquema la resuelve el search_path en public: cuenta.
    expect(violation("select id from messages where id = $1")).not.toBeNull();
    expect(violation("select id from messages where organization_id = $1 and id = $2")).toBeNull();
    // organization_id = organization_id no liga nada.
    expect(violation("select id from public.messages where organization_id = organization_id and id = $1")).not.toBeNull();
    expect(violation("select id from public.messages m where m.organization_id = m.organization_id and m.id = $1")).not.toBeNull();
    // Dos filtros sobre la misma tabla no cubren la otra del join.
    expect(
      violation(
        "select c.id from public.messages m join public.conversations c on c.id = m.conversation_id where m.organization_id = $1 and m.organization_id = $1",
      ),
    ).not.toBeNull();
    // Un filtro que solo está en un comentario no filtra.
    expect(violation("select id from public.messages where id = $1 -- organization_id = $2")).not.toBeNull();
    expect(violation("select id from public.messages where id = $1 /* organization_id = $2 */")).not.toBeNull();
  });

  it("insert … select: el select cumple la regla; y lo transitivo, el orden al revés, las funciones y otros esquemas", () => {
    expect(violation("insert into public.x (organization_id, a) select organization_id, a from public.y where id = $1")).not.toBeNull();
    expect(violation("insert into public.x (organization_id, a) select organization_id, a from public.y where organization_id = $2 and id = $1")).toBeNull();
    // Una tabla ligada a otra ya ligada a un parámetro.
    expect(
      violation(
        "select c.id from public.messages m join public.conversations c on c.id = m.conversation_id and c.organization_id = m.organization_id where m.organization_id = $1",
      ),
    ).toBeNull();
    expect(violation("select id from public.messages where $1 = organization_id")).toBeNull();
    expect(violation("select key from jsonb_each($1) as d(key, value)")).toBeNull();
    expect(violation("select * from private.thing where id = $1")).toBeNull();
  });

  it("la nota de V10: una tabla detrás de una coma en el from y la del delete … using también cuentan", () => {
    // Detrás de una coma en el from, con o sin alias y con o sin esquema.
    expect(
      violation("select m.id from public.messages m, public.conversations c where m.organization_id = $1 and c.id = m.conversation_id"),
    ).not.toBeNull();
    expect(
      violation("select m.id from public.messages m, public.conversations c where m.organization_id = $1 and c.organization_id = $1"),
    ).toBeNull();
    expect(violation("select 1 from public.messages m, conversations where m.organization_id = $1")).not.toBeNull();
    expect(
      violation(
        "select 1 from public.messages as m, public.conversations as c, public.contacts k where m.organization_id = $1 and c.organization_id = $1",
      ),
    ).not.toBeNull();
    // Una función con alias de columnas («d(key, value)») delante de la coma: la tabla de detrás cuenta igual.
    expect(violation("select d.key from jsonb_each($1) as d(key, value), public.messages m where m.id = $2")).not.toBeNull();
    expect(violation("select d.key from jsonb_each($1) as d(key, value), public.messages m where m.organization_id = $2")).toBeNull();
    // Y una subconsulta delante de la coma.
    expect(violation("select 1 from (select 1) s, public.messages m where m.id = $1")).not.toBeNull();
    // delete … using: la tabla del using cuenta.
    expect(
      violation("delete from public.executions e using public.agent_runs r where e.organization_id = $1 and e.run_id = r.id"),
    ).not.toBeNull();
    expect(
      violation(
        "delete from public.executions e using public.agent_runs r where e.organization_id = $1 and r.organization_id = $1 and e.run_id = r.id",
      ),
    ).toBeNull();
    expect(
      violation(
        "delete from public.executions e using public.agent_runs r, public.messages m where e.organization_id = $1 and r.organization_id = $1",
      ),
    ).not.toBeNull();
    // «join … using (columna)» no es una tabla.
    expect(
      violation(
        "select 1 from public.messages m join public.conversations c using (id) where m.organization_id = $1 and c.organization_id = $1",
      ),
    ).toBeNull();
    // Las comas de la lista del select no son tablas.
    expect(violation("select a, b, c from public.messages where organization_id = $1")).toBeNull();
  });

  it("lee el SQL literal de cada llamada, y marca como ilegible el que lleva ${}", () => {
    const source = [
      'const [a] = await sql.query<{ id: string }>("select id from public.messages where id = $1", [id]);',
      "await (await db.sql)",
      "  .query<{ x: number }>(`select 1 from public.agents where organization_id = $1`, [org]);",
      "await client.query(`SET x = ${value}`);",
      "await client.query(LOCK, [key]);",
      "// Un comentario que habla de client.query() no es una llamada.",
      "await sql.query(",
      "  // La organización explícita.",
      '  "select 1 from public.messages where organization_id = $1",',
      ");",
    ].join("\n");
    expect(queryCalls("x.ts", source).map((call) => [call.line, call.sql])).toEqual([
      [1, "select id from public.messages where id = $1"],
      [3, "select 1 from public.agents where organization_id = $1"],
      [4, null],
      [5, null],
      [7, "select 1 from public.messages where organization_id = $1"],
    ]);
  });
});

describe("el SQL del worker lleva la organización explícita (control 3.2)", () => {
  const calls = sourceFiles(SRC).flatMap((path) => queryCalls(relative(SRC, path), readFileSync(path, "utf8")));
  /** La excepción que cubre una llamada: mismo archivo y el texto de la llamada o de su SQL la contiene. */
  const allowed = (call: QueryCall) =>
    ALLOWED.find(
      (entry) => entry.file === call.file && (call.call.includes(entry.contains) || (call.sql ?? "").replace(/\s+/g, " ").includes(entry.contains)),
    );

  it("hay consultas que mirar (el test no pasa por no encontrar ninguna)", () => {
    expect(calls.filter((call) => call.sql !== null && /public\./.test(call.sql)).length).toBeGreaterThan(40);
  });

  it("cada consulta contra una tabla de public lleva organization_id (o es una excepción de la lista)", () => {
    const wrong = calls
      .filter((call) => !allowed(call))
      .map((call) => {
        if (call.sql === null) return `${call.file}:${call.line}: el SQL no es un texto literal (${call.call})`;
        const why = violation(call.sql);
        return why ? `${call.file}:${call.line}: ${why}` : null;
      })
      .filter((line): line is string => line !== null);
    expect(wrong).toEqual([]);
  });

  it("cada excepción de la lista sigue existiendo (si no, se quita)", () => {
    const unused = ALLOWED.filter((entry) => !calls.some((call) => allowed(call) === entry));
    expect(unused.map((entry) => `${entry.file}: ${entry.contains}`)).toEqual([]);
  });
});
