import { planSummary, summarizeConversation } from "@repo/agent-core";
import type { HistoryMessage, ModelPolicy, ModelRouter, Spend, SummarizeResult, SummaryMessage } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";

// Resumen continuo de cada conversación en el worker (PL-T3, punto 2;
// migración 20261112050000_conversation_summaries).
//
// - Al preparar el turno: el resumen guardado y solo los mensajes posteriores a
//   lo que cubre (como mucho HISTORY_LIMIT, los más nuevos).
// - Al acabar el turno: si hay más mensajes sin cubrir que los recientes que
//   van siempre enteros, el modelo barato los mete en el resumen y se guarda.
// - Todo con el organization_id de ctx.db (tenantDb), nunca de lo que diga el
//   modelo. Si algo falla, el turno no se entera: el siguiente lleva más
//   mensajes enteros, como antes del resumen.

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

export async function loadSummary(db: TenantDb, conversationId: string): Promise<StoredSummary | null> {
  const row = check(
    await db.from("conversation_summaries").select("summary, covered_until").eq("conversation_id", conversationId).maybeSingle(),
    "el resumen de la conversación",
  );
  return row ? { summary: row.summary, coveredUntil: row.covered_until } : null;
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
  | { kind: "skipped"; reason: string; error?: string }
  | { kind: "updated"; summary: string; coveredUntil: string; usage: { tokensIn: number; tokensOut: number; costEur: number; model: string } };

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

/** Decide si hace falta resumir y, si hace falta, pide el resumen al modelo. No escribe nada. */
export async function summarizeStep(params: RefreshParams): Promise<SummaryStep> {
  const uncovered = await uncoveredMessages(params.db, params.conversationId, params.previous?.coveredUntil ?? null);
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
  if (result.status === "skipped") return { kind: "skipped", reason: result.reason, ...(result.error ? { error: result.error } : {}) };
  return { kind: "updated", summary: result.summary, coveredUntil: plan.coveredUntil, usage: result.usage };
}

/** Guarda el resumen nuevo: una fila por conversación, de la organización de ctx.db. */
export async function saveSummary(db: TenantDb, conversationId: string, step: Extract<SummaryStep, { kind: "updated" }>): Promise<void> {
  const values = { summary: step.summary, covered_until: step.coveredUntil, model: step.usage.model };
  const updated = await db.from("conversation_summaries").update(values).eq("conversation_id", conversationId).select("conversation_id");
  if (updated.error) throw new Error(`no se pudo guardar el resumen (${updated.error.code})`);
  if ((updated.data ?? []).length > 0) return;
  const inserted = await db.from("conversation_summaries").insert({ conversation_id: conversationId, ...values });
  // 23505: otro turno lo creó entre medias; se queda el suyo, el siguiente lo pone al día.
  if (inserted.error && inserted.error.code !== "23505") throw new Error(`no se pudo guardar el resumen (${inserted.error.code})`);
}
