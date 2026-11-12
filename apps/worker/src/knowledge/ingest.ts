import { createHash } from "node:crypto";
import { policyAllows, policyFromSettings } from "@repo/agent-core";
import type { RouteOrigin } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import { assertEmbedding, chunkText } from "@repo/knowledge";
import type { EmbedResult, Embedder, EmbeddingUsage } from "@repo/knowledge";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";

// La ingesta de las fuentes de conocimiento de texto (paso B20-1, MANUAL §6.1,
// ADR 0037 y ADR 0048).
//
// - knowledge_source.pending llega al crear una fuente o al cambiar su texto.
// - Se lee el texto que tenga la fuente al procesar (el último): una entrega
//   antigua indexa igual el texto nuevo, y la del cambio nuevo lo repite.
// - El texto solo sale hacia el proveedor si la política de modelos de la
//   organización lo deja (policyAllows, la regla del enrutador): con «Solo UE»
//   o sin ese proveedor entre los permitidos, queda en error sin enviarse.
// - Se trocea (chunkText), se sacan los embeddings y se reemplazan todos los
//   fragmentos de la fuente; después queda ready. Si los embeddings fallan,
//   queda en error y no se busca en ella.
// - Antes de escribir se comprueba que el texto no ha cambiado mientras tanto:
//   si cambió, no se escribe nada (lo hará la entrega de ese cambio). Y ready o
//   error solo se ponen si la fuente sigue en processing: un cambio del texto a
//   mitad la devuelve a pending (guard_knowledge_source) y ahí se queda.
// - Embeddings y escritura van en el mismo paso: los vectores no se guardan en
//   la base de datos de DBOS, y si el paso se repite, se reemplaza todo otra vez.
// - Lo que costó cada llamada de embeddings va al libro de consumo
//   (usage_records, source «embedding», PL-ledger) en cuanto vuelve, también si
//   luego no se escribe nada: se pagó igual. Si el paso se repite, la llamada se
//   repite y se paga otra vez, así que es otra fila. Un fallo al anotarla no
//   para la indexación: se registra en el log.

export const INGEST_HANDLER_KEY = "knowledge.ingest";

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

function hashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type IngestResult =
  | { kind: "skip"; reason: "source_missing" | "no_text" | "changed"; ledgerError?: string }
  | { kind: "ready"; chunks: number; ledgerError?: string }
  | { kind: "blocked" }
  | { kind: "error"; error: string; ledgerError?: string };

/** Quién saca los embeddings y por dónde van (lo que mira la política de la organización). */
export interface IngestOptions {
  embedder: Embedder;
  route: RouteOrigin;
}

async function readSource(db: TenantDb, sourceId: string) {
  return check(await db.from("knowledge_sources").select("id, title, body, location_id").eq("id", sourceId).maybeSingle(), "la fuente");
}

/** La política de modelos de la organización (org_model_settings), o la de plataforma si no tiene. */
async function loadPolicy(db: TenantDb) {
  const row = check(
    await db
      .from("org_model_settings")
      .select("residency, allowed_providers, model_by_task, connection, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur")
      .maybeSingle(),
    "la política de modelos",
  );
  return policyFromSettings(row);
}

async function startProcessing(db: TenantDb, sourceId: string): Promise<void> {
  const { error } = await db.from("knowledge_sources").update({ status: "processing" }).eq("id", sourceId);
  if (error) throw new Error(`no se pudo marcar la fuente (${error.code})`);
}

/** De processing a ready o error; si ya no está en processing (el texto cambió), no la toca. */
async function finishProcessing(db: TenantDb, sourceId: string, status: "ready" | "error"): Promise<void> {
  const { error } = await db.from("knowledge_sources").update({ status }).eq("id", sourceId).eq("status", "processing");
  if (error) throw new Error(`no se pudo marcar la fuente (${error.code})`);
}

/** Una llamada de embeddings en el libro de consumo. Devuelve el error (el código), sin lanzar. */
async function recordEmbeddingUsage(
  db: TenantDb,
  locationId: string | null,
  embedder: Embedder,
  route: RouteOrigin,
  usage: EmbeddingUsage,
): Promise<string | null> {
  try {
    const { error } = await db.from("usage_records").insert({
      location_id: locationId,
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
    });
    return error ? `usage_records(${error.code})` : null;
  } catch (error) {
    return (error as Error).name;
  }
}

/** Los vectores y, si el embedder los cuenta, los tokens y el coste. */
async function embedAll(embedder: Embedder, texts: readonly string[]): Promise<EmbedResult | { vectors: number[][]; usage: null }> {
  if (embedder.embedWithUsage) return embedder.embedWithUsage(texts);
  return { vectors: await embedder.embed(texts), usage: null };
}

/** Indexa el texto actual de una fuente: trozos, embeddings y fragmentos nuevos en lugar de los viejos. */
export async function ingestSource(db: TenantDb, sourceId: string, { embedder, route }: IngestOptions): Promise<IngestResult> {
  const source = await readSource(db, sourceId);
  if (!source) return { kind: "skip", reason: "source_missing" };
  if (!source.body) return { kind: "skip", reason: "no_text" };
  const hash = hashOf(source.body);
  await startProcessing(db, sourceId);
  if (!policyAllows(await loadPolicy(db), route)) {
    await finishProcessing(db, sourceId, "error");
    return { kind: "blocked" };
  }

  const chunks = chunkText(source.title, source.body);
  let vectors: number[][];
  let ledgerError: string | null = null;
  try {
    const embedded = await embedAll(embedder, chunks);
    if (embedded.usage) ledgerError = await recordEmbeddingUsage(db, source.location_id, embedder, route, embedded.usage);
    vectors = embedded.vectors;
    if (vectors.length !== chunks.length) throw new Error("no hay un embedding por trozo");
    for (const vector of vectors) assertEmbedding(vector, embedder.dim);
  } catch (error) {
    await finishProcessing(db, sourceId, "error");
    return { kind: "error", error: (error as Error).name, ...(ledgerError ? { ledgerError } : {}) };
  }

  const current = await readSource(db, sourceId);
  if (!current?.body || hashOf(current.body) !== hash) return { kind: "skip", reason: "changed", ...(ledgerError ? { ledgerError } : {}) };

  const removed = await db.from("knowledge_chunks").delete().eq("source_id", sourceId);
  if (removed.error) throw new Error(`no se pudieron quitar los fragmentos viejos (${removed.error.code})`);
  if (chunks.length > 0) {
    const { error } = await db.from("knowledge_chunks").insert(
      chunks.map((content, ordinal) => ({
        source_id: sourceId,
        ordinal,
        content,
        embedding: `[${(vectors[ordinal] ?? []).join(",")}]`,
        embedding_model: embedder.model,
        embedding_dim: embedder.dim,
      })),
    );
    if (error) throw new Error(`no se pudieron guardar los fragmentos (${error.code})`);
  }
  await finishProcessing(db, sourceId, "ready");
  return { kind: "ready", chunks: chunks.length, ...(ledgerError ? { ledgerError } : {}) };
}

export function createIngestHandler(options: IngestOptions): EventHandler {
  return {
    key: INGEST_HANDLER_KEY,
    eventTypes: ["knowledge_source.pending"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const sourceId = String(event.payload["source_id"]);
      const result = await ctx.step("index", () => ingestSource(ctx.db, sourceId, options));
      if ("ledgerError" in result && result.ledgerError) {
        ctx.logger.error({ sourceId, error: result.ledgerError }, "no se pudo anotar el coste de los embeddings en el libro de consumo");
      }
      if (result.kind === "ready") ctx.logger.info({ sourceId, chunks: result.chunks, model: options.embedder.model }, "fuente de conocimiento indexada");
      else if (result.kind === "blocked") ctx.logger.warn({ sourceId, provider: options.route.provider }, "la política de modelos de la organización no deja indexar la fuente");
      else if (result.kind === "error") ctx.logger.warn({ sourceId, error: result.error }, "la fuente de conocimiento no se pudo indexar");
      else ctx.logger.info({ sourceId, reason: result.reason }, "fuente de conocimiento sin indexar");
    },
  };
}
