import type { RouteOrigin } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import { spentBefore } from "@repo/knowledge";
import type { Embedder, EmbeddingUsage } from "@repo/knowledge";
import type { Logger } from "pino";

// Las llamadas de embeddings en el libro de consumo (usage_records, source
// «embedding», PL-ledger): las de la ingesta (#253) y las de las consultas de
// search_knowledge en un turno. Una fila por llamada pagada, en cuanto vuelve
// (también si falla después de un lote ya pagado: spentBefore). La organización
// es la de tenantDb; el precio, el que da el gateway o el de @repo/config
// (embedWithUsage). Anotar es contabilidad: un fallo se devuelve, no se lanza.

/** El orden de las llamadas de la ingesta (sin run): lejos de los pasos de un turno, del resumen (1000) y de la clasificación (2000). */
export const EMBEDDING_CALL_INDEX = 3000;
/** El de las consultas de search_knowledge dentro de un turno: 4000, 4001… */
export const SEARCH_EMBEDDING_CALL_INDEX = 4000;

export interface EmbeddingUsageRow {
  locationId: string | null;
  runId?: string | null;
  agentId?: string | null;
  callIndex: number;
}

/** Una llamada de embeddings en el libro de consumo. Devuelve el error (el código), sin lanzar. */
export async function recordEmbeddingUsage(
  db: TenantDb,
  embedder: Pick<Embedder, "model">,
  route: RouteOrigin,
  row: EmbeddingUsageRow,
  usage: EmbeddingUsage,
): Promise<string | null> {
  try {
    const { error } = await db.from("usage_records").insert({
      location_id: row.locationId,
      run_id: row.runId ?? null,
      agent_id: row.agentId ?? null,
      source: "embedding",
      metric: "embedding_tokens",
      quantity: usage.tokens,
      tokens_in: usage.tokens,
      tokens_out: 0,
      cost_eur: usage.costEur,
      provider: route.provider,
      via: "gateway",
      region: route.region,
      model: embedder.model,
      call_index: row.callIndex,
    });
    return error ? `usage_records(${error.code})` : null;
  } catch (error) {
    return (error as Error).name;
  }
}

export interface SearchUsageContext {
  route: RouteOrigin;
  runId: string;
  agentId: string | null;
  locationId: string | null;
  logger: Pick<Logger, "error">;
}

/**
 * El embedder de las consultas de un turno, que anota cada llamada en el libro
 * (con el run, el agente y el local del turno). Sin embedWithUsage (no cuenta
 * lo que cuesta), el mismo embedder. Un fallo al anotar va al log y la búsqueda
 * sigue.
 */
export function meteredSearchEmbedder(db: TenantDb, embedder: Embedder, context: SearchUsageContext): Embedder {
  const measured = embedder.embedWithUsage?.bind(embedder);
  if (!measured) return embedder;
  let calls = 0;
  const record = async (usage: EmbeddingUsage) => {
    const callIndex = SEARCH_EMBEDDING_CALL_INDEX + calls;
    calls += 1;
    const error = await recordEmbeddingUsage(
      db,
      embedder,
      context.route,
      { locationId: context.locationId, runId: context.runId, agentId: context.agentId, callIndex },
      usage,
    );
    if (error) context.logger.error({ runId: context.runId, callIndex, error }, "no se pudo anotar el coste de la consulta al conocimiento en el libro de consumo");
  };
  return {
    model: embedder.model,
    dim: embedder.dim,
    async embed(texts) {
      try {
        const { vectors, usage } = await measured(texts);
        await record(usage);
        return vectors;
      } catch (error) {
        // Falló después de lotes ya pagados: lo gastado va igual al libro.
        const spent = spentBefore(error);
        if (spent) await record(spent);
        throw error;
      }
    },
    // Sin embedWithUsage: quien busque solo tiene embed, que siempre anota.
  };
}
