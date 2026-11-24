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
//   en los join y las subconsultas).
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

/** Por qué una consulta no cumple la regla, o null si la cumple (o no toca tablas de public). */
export function violation(sql: string): string | null {
  const text = sql.replace(/\s+/g, " ");
  const tables = [...text.matchAll(/\bpublic\.([a-z_]+)/gi)].map((match) => match[1]);
  if (tables.length === 0) return null;
  const insert = /^\s*insert\s+into\s+public\.[a-z_]+\s*\(([^)]*)\)/i.exec(text);
  if (insert) {
    return /\borganization_id\b/.test(insert[1] ?? "") ? null : "un insert sin organization_id entre sus columnas";
  }
  const filters = (text.match(/\borganization_id\s*=/gi) ?? []).length;
  return filters >= tables.length ? null : `${tables.length} tabla(s) de public (${tables.join(", ")}) y ${filters} filtro(s) organization_id =`;
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
