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
    // Como moodly_worker, bajo RLS (PL-T1 3c-1, 20261112130000), como el resto
    // del libro: la organización es la de tenantDb, nunca la de quien anota.
    await db.transaction((sql) =>
      sql.query(
        `insert into public.usage_records (organization_id, location_id, run_id, agent_id, source, metric, quantity,
                                           tokens_in, tokens_out, cost_eur, provider, via, region, model, call_index)
         values ($1, $2, $3, $4, 'embedding', 'embedding_tokens', $5, $5, 0, $6, $7, 'gateway', $8, $9, $10)`,
        [
          db.organizationId,
          row.locationId,
          row.runId ?? null,
          row.agentId ?? null,
          usage.tokens,
          usage.costEur,
          route.provider,
          route.region,
          embedder.model,
          row.callIndex,
        ],
      ),
    );
    return null;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? `usage_records(${code})` : (error as Error).name;
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
