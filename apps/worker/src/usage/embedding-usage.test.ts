import type { TenantDb } from "@repo/db/service";
import { EmbeddingError, createFakeEmbedder } from "@repo/knowledge";
import type { Embedder } from "@repo/knowledge";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.ts";
import { SEARCH_EMBEDDING_CALL_INDEX, meteredSearchEmbedder, recordEmbeddingUsage } from "./embedding-usage.ts";

// Las consultas de search_knowledge en el libro de consumo (PL-ledger): cada
// llamada pagada, una fila con el run, el agente y el local del turno. La
// organización es la de tenantDb (aquí, falso: se mira lo que se inserta).

const ROUTE = { provider: "vercel-ai-gateway", region: "other", connection: "managed" } as const;

/**
 * Un tenantDb falso con la transacción bajo RLS (PL-T1): cada insert se lee
 * como la fila que escribiría (columnas con sus parámetros o literales), o
 * falla con el código de Postgres que se le diga.
 */
function fakeDb(fail: { code: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  const query = async (text: string, values: readonly unknown[] = []) => {
    const match = /insert into public\.(\w+)\s*\(([^)]*)\)\s*values\s*\(([^)]*)\)/s.exec(text);
    if (!match) throw new Error(`consulta inesperada: ${text}`);
    if (fail) throw Object.assign(new Error("pg"), { code: fail.code });
    const columns = (match[2] ?? "").split(",").map((column) => column.trim());
    const cells = (match[3] ?? "").split(",").map((cell) => cell.trim());
    const row: Record<string, unknown> = { table: match[1] };
    columns.forEach((column, i) => {
      const cell = cells[i] ?? "";
      const param = /^\$(\d+)$/.exec(cell);
      row[column] = param ? values[Number(param[1]) - 1] : /^'.*'$/.test(cell) ? cell.slice(1, -1) : Number(cell);
    });
    inserted.push(row);
    return [];
  };
  const db = {
    organizationId: "a0000000-0000-4000-8000-000000000000",
    transaction: async <T>(fn: (sql: { query: typeof query }) => Promise<T>) => fn({ query }),
  } as unknown as TenantDb;
  return { db, inserted };
}

function logs() {
  const lines: string[] = [];
  return { lines, logger: createLogger("debug", { write: (line: string) => void lines.push(line) }) };
}

const context = (logger: ReturnType<typeof logs>["logger"]) => ({
  route: ROUTE,
  runId: "f0000000-0000-4000-8000-000000000001",
  agentId: "f1000000-0000-4000-8000-000000000001",
  locationId: "f2000000-0000-4000-8000-000000000001",
  logger,
});

describe("meteredSearchEmbedder", () => {
  it("cada consulta, una fila en el libro con el run, el agente y el local del turno, y su orden (4000, 4001…)", async () => {
    const { db, inserted } = fakeDb();
    const { logger } = logs();
    const embedder = meteredSearchEmbedder(db, createFakeEmbedder(8), context(logger));
    const first = await embedder.embed(["precio del láser de axilas"]);
    await embedder.embed(["horario del sábado"]);
    expect(first).toEqual(await createFakeEmbedder(8).embed(["precio del láser de axilas"]));
    expect(inserted).toEqual([
      expect.objectContaining({
        table: "usage_records",
        run_id: context(logger).runId,
        agent_id: context(logger).agentId,
        location_id: context(logger).locationId,
        source: "embedding",
        metric: "embedding_tokens",
        quantity: 5,
        tokens_in: 5,
        tokens_out: 0,
        cost_eur: 0,
        provider: "vercel-ai-gateway",
        via: "gateway",
        region: "other",
        model: "fake-hash-8",
        call_index: SEARCH_EMBEDDING_CALL_INDEX,
      }),
      expect.objectContaining({ quantity: 3, call_index: SEARCH_EMBEDDING_CALL_INDEX + 1 }),
    ]);
    // La organización no la pone quien anota: es la de tenantDb (y RLS la exige).
    expect(inserted[0]?.organization_id).toBe(db.organizationId);
  });

  it("si falla después de un lote ya pagado, lo gastado va al libro y el error sigue", async () => {
    const { db, inserted } = fakeDb();
    const { logger } = logs();
    const failing: Embedder = {
      model: "fake-x",
      dim: 8,
      embed: () => Promise.reject(new Error("no se usa")),
      embedWithUsage: () => Promise.reject(Object.assign(new EmbeddingError("lote 2"), { usage: { tokens: 7, costEur: 0.00000014 } })),
    };
    await expect(meteredSearchEmbedder(db, failing, context(logger)).embed(["x"])).rejects.toThrow("lote 2");
    expect(inserted).toEqual([expect.objectContaining({ tokens_in: 7, cost_eur: 0.00000014, call_index: SEARCH_EMBEDDING_CALL_INDEX })]);
  });

  it("si falla sin nada pagado, no anota nada", async () => {
    const { db, inserted } = fakeDb();
    const { logger } = logs();
    const failing: Embedder = { model: "fake-x", dim: 8, embed: () => Promise.reject(new Error("x")), embedWithUsage: () => Promise.reject(new EmbeddingError("caído")) };
    await expect(meteredSearchEmbedder(db, failing, context(logger)).embed(["x"])).rejects.toThrow("caído");
    expect(inserted).toEqual([]);
  });

  it("un embedder que no cuenta lo que cuesta se usa tal cual", () => {
    const { db } = fakeDb();
    const { logger } = logs();
    const plain: Embedder = { model: "plain", dim: 8, embed: async () => [[0]] };
    expect(meteredSearchEmbedder(db, plain, context(logger))).toBe(plain);
  });

  it("si anotar falla, la búsqueda sigue con sus vectores y queda en el log", async () => {
    const { db } = fakeDb({ code: "42501" });
    const { lines, logger } = logs();
    const vectors = await meteredSearchEmbedder(db, createFakeEmbedder(8), context(logger)).embed(["hola"]);
    expect(vectors).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ level: "error", callIndex: SEARCH_EMBEDDING_CALL_INDEX, error: "usage_records(42501)" });
  });

  it("solo ofrece embed: no deja una vía sin anotar", () => {
    const { db } = fakeDb();
    const { logger } = logs();
    expect(meteredSearchEmbedder(db, createFakeEmbedder(8), context(logger)).embedWithUsage).toBeUndefined();
  });
});

describe("recordEmbeddingUsage", () => {
  it("sin run (la ingesta), run_id y agent_id van vacíos", async () => {
    const { db, inserted } = fakeDb();
    expect(await recordEmbeddingUsage(db, { model: "m" }, ROUTE, { locationId: null, callIndex: 3000 }, { tokens: 1, costEur: 0 })).toBeNull();
    expect(inserted[0]).toMatchObject({ run_id: null, agent_id: null, location_id: null, call_index: 3000 });
  });
});
