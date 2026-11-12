import { planSummary, summarizeConversation } from "@repo/agent-core";
import type { HistoryMessage, ModelPolicy, ModelRouter, Spend, SummarizeResult, SummaryMessage, TurnModelCall } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";

// Resumen continuo de cada conversación en el worker (PL-T3, punto 2;
// migración 20261112050000_conversation_summaries).
//
// - Al preparar el turno: el resumen guardado y solo los mensajes posteriores a
//   lo que cubre (como mucho HISTORY_LIMIT, los más nuevos).
// - Al acabar el turno: si hay más mensajes sin cubrir que los recientes que
//   van siempre enteros, el modelo barato los mete en el resumen y se guarda.
// - Todo con el organization_id de ctx.db (tenantDb), nunca de lo que diga el
//   modelo.
// - Nada de esto puede dejar un turno sin contestar ni un run sin cerrar: si
//   leer el resumen falla, el turno va con la historia entera (como antes del
//   resumen); el run se cierra antes de resumir, y si resumir, guardar o
//   apuntar su coste falla, se apunta en el log y el siguiente turno lleva más
//   mensajes enteros. Ninguna de estas funciones lanza.

export interface StoredSummary {
  summary: string;
  coveredUntil: string;
}

/** Cuántos mensajes sin cubrir se leen para resumir, como mucho: si hay más, el siguiente turno sigue. */
const SUMMARY_READ_LIMIT = 60;

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

/** El resumen guardado; si no se puede leer, ninguno (el turno va con la historia entera) y el porqué. */
export async function loadSummary(db: TenantDb, conversationId: string): Promise<{ summary: StoredSummary | null; error: string | null }> {
  try {
    // Por SQL bajo RLS como moodly_worker (ADR 0049, PL-T1). covered_until como
    // texto ISO con sus microsegundos (to_json): un Date de JS los perdería y el
    // corte de la historia se movería.
    const [row] = await db.transaction((sql) =>
      sql.query<{ summary: string; covered_until: string }>(
        "select summary, to_json(covered_until) #>> '{}' as covered_until from public.conversation_summaries where conversation_id = $1",
        [conversationId],
      ),
    );
    return { summary: row ? { summary: row.summary, coveredUntil: row.covered_until } : null, error: null };
  } catch (error) {
    return { summary: null, error: errorName(error) };
  }
}

/** El nombre del error y, si viene de la base de datos, su código: nunca el mensaje (puede llevar datos). */
function errorName(error: unknown): string {
  // El de pg va en .code; el de PostgREST, al final del mensaje (check).
  const pgCode = (error as { code?: unknown } | null)?.code;
  const code =
    typeof pgCode === "string" && /^[A-Z0-9]{5}$/.test(pgCode)
      ? pgCode
      : error instanceof Error
        ? /\(([A-Z0-9]{5})\)$/.exec(error.message)?.[1]
        : undefined;
  return `${error instanceof Error ? error.name : "Error"}${code ? `(${code})` : ""}`;
}

/** Los mensajes que el resumen no cubre todavía, del más antiguo al más nuevo. */
async function uncoveredMessages(db: TenantDb, conversationId: string, coveredUntil: string | null): Promise<SummaryMessage[]> {
  let query = db.from("messages").select("author, content, created_at").eq("conversation_id", conversationId);
  if (coveredUntil) query = query.gt("created_at", coveredUntil);
  const rows = check(await query.order("created_at", { ascending: true }).limit(SUMMARY_READ_LIMIT), "los mensajes sin resumir");
  return (rows ?? []).map((row) => ({ author: row.author as HistoryMessage["author"], content: row.content, createdAt: row.created_at }));
}

/** Lo que decidió el paso del resumen. Serializable: es el resultado de un paso de DBOS. */
export type SummaryStep =
  | { kind: "none" }
  /** `call` si se llegó a llamar al modelo: va al libro de consumo aunque no haya resumen. */
  | { kind: "skipped"; reason: string; error?: string; call?: TurnModelCall }
  | { kind: "updated"; summary: string; coveredUntil: string; usage: { tokensIn: number; tokensOut: number; costEur: number; model: string }; call: TurnModelCall };

export interface RefreshParams {
  db: TenantDb;
  organizationId: string;
  runId: string;
  conversationId: string;
  previous: StoredSummary | null;
  router: ModelRouter;
  policy: ModelPolicy;
  spend: Spend;
}

/** Decide si hace falta resumir y, si hace falta, pide el resumen al modelo. No escribe nada ni lanza. */
export async function summarizeStep(params: RefreshParams): Promise<SummaryStep> {
  let uncovered: SummaryMessage[];
  try {
    uncovered = await uncoveredMessages(params.db, params.conversationId, params.previous?.coveredUntil ?? null);
  } catch (error) {
    return { kind: "skipped", reason: "db_error", error: errorName(error) };
  }
  const plan = planSummary(uncovered);
  if (!plan) return { kind: "none" };
  const result: SummarizeResult = await summarizeConversation({
    organizationId: params.organizationId,
    runId: params.runId,
    previous: params.previous?.summary ?? null,
    messages: plan.fold,
    router: params.router,
    policy: params.policy,
    spend: params.spend,
  });
  if (result.status === "skipped") {
    return { kind: "skipped", reason: result.reason, ...(result.error ? { error: result.error } : {}), ...(result.call ? { call: result.call } : {}) };
  }
  return { kind: "updated", summary: result.summary, coveredUntil: plan.coveredUntil, usage: result.usage, call: result.call };
}

/** Guarda el resumen nuevo: una fila por conversación, de la organización de ctx.db. Devuelve el error, sin lanzar. */
export async function saveSummary(db: TenantDb, conversationId: string, step: Extract<SummaryStep, { kind: "updated" }>): Promise<string | null> {
  try {
    // Como moodly_worker, bajo RLS (PL-T1 3c-3, 20261112150000): poner al día la
    // fila de la conversación o, si no hay, crearla, en una transacción.
    await db.transaction(async (sql) => {
      const updated = await sql.query(
        `update public.conversation_summaries set summary = $2, covered_until = $3, model = $4
         where conversation_id = $1 returning conversation_id`,
        [conversationId, step.summary, step.coveredUntil, step.usage.model],
      );
      if (updated.length > 0) return;
      // on conflict: otro turno la creó entre medias; se queda la suya, el siguiente la pone al día.
      await sql.query(
        `insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until, model)
         values ($1, $5, $2, $3, $4) on conflict do nothing`,
        [conversationId, step.summary, step.coveredUntil, step.usage.model, db.organizationId],
      );
    });
    return null;
  } catch (error) {
    return errorName(error);
  }
}

/**
 * Apunta en el run, ya cerrado, lo que costó el resumen: el total del turno más
 * el del resumen (valores absolutos: si el paso se repite, no suma dos veces).
 * Así el gasto del día y los topes lo ven. Devuelve el error, sin lanzar.
 */
export async function bookSummaryUsage(
  db: TenantDb,
  runId: string,
  total: { tokensIn: number; tokensOut: number; costEur: number },
): Promise<string | null> {
  try {
    // Como moodly_worker, bajo RLS (PL-T1 3c-1): solo los tokens y el coste, y
    // con el run ya cerrado solo pueden subir (guard_worker_agent_run).
    await db.transaction((sql) =>
      sql.query(
        `update public.agent_runs
         set tokens_in = greatest(tokens_in, $2), tokens_out = greatest(tokens_out, $3), cost_eur = greatest(cost_eur, $4)
         where id = $1`,
        [runId, total.tokensIn, total.tokensOut, total.costEur],
      ),
    );
    return null;
  } catch (error) {
    return errorName(error);
  }
}
