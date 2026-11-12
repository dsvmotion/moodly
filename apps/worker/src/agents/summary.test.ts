import { PLATFORM_MODEL_POLICY, SUMMARY_INSTRUCTIONS, createFakeTransport, createModelRouter } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import { describe, expect, it } from "vitest";
import { bookSummaryUsage, loadSummary, saveSummary, summarizeStep } from "./summary.ts";

// El resumen continuo en el worker (PL-T3): ningún fallo de la base de datos
// deja un turno sin contestar, ni lanza dentro de los pasos del turno.

type Result = { data: unknown; error: { code: string } | null };

/** Un tenantDb de mentira: cada consulta a una tabla termina con lo que diga `answer`. */
function fakeDb(answer: (table: string, ops: string[]) => Result): TenantDb & { calls: { table: string; ops: string[] }[] } {
  const calls: { table: string; ops: string[] }[] = [];
  const chain = (table: string, ops: string[]): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const result = answer(table, ops);
            calls.push({ table, ops });
            return (resolve: (value: Result) => void) => resolve(result);
          }
          return () => chain(table, [...ops, String(prop)]);
        },
      },
    );
  return { from: (table: string) => chain(table, []), calls } as unknown as TenantDb & { calls: { table: string; ops: string[] }[] };
}

const broken = fakeDb(() => ({ data: null, error: { code: "57P01" } }));
const usage = { tokensIn: 10, tokensOut: 2, costEur: 0.001, model: "fake/fast" };
const updated = { kind: "updated" as const, summary: "Customer said: quiere láser.", coveredUntil: "2030-06-03T09:00:00Z", usage };

describe("resumen continuo en el worker: fallos de la base de datos", () => {
  it("si no se puede leer el resumen, ninguno: el turno va con la historia entera, y se sabe por qué", async () => {
    expect(await loadSummary(broken, "conv-1")).toEqual({ summary: null, error: "Error(57P01)" });
    const ok = fakeDb(() => ({ data: { summary: "s", covered_until: "2030-06-03T09:00:00Z" }, error: null }));
    expect(await loadSummary(ok, "conv-1")).toEqual({ summary: { summary: "s", coveredUntil: "2030-06-03T09:00:00Z" }, error: null });
  });

  it("si no se pueden leer los mensajes sin resumir, no se llama al modelo y no lanza", async () => {
    const transport = createFakeTransport({ provider: "fake" });
    const result = await summarizeStep({
      db: broken,
      organizationId: "org-1",
      runId: "run-1",
      conversationId: "conv-1",
      previous: null,
      router: createModelRouter([transport]),
      policy: PLATFORM_MODEL_POLICY,
      spend: { runEur: 0, dayEur: 0 },
    });
    expect(result).toEqual({ kind: "skipped", reason: "db_error", error: "Error(57P01)" });
    expect(transport.calls).toHaveLength(0);
  });

  it("guardar el resumen o apuntar su coste: el error vuelve como valor, no se lanza", async () => {
    expect(await saveSummary(broken, "conv-1", updated)).toBe("Error(57P01)");
    expect(await bookSummaryUsage(broken, "run-1", { tokensIn: 110, tokensOut: 22, costEur: 0.011 })).toBe("Error(57P01)");
  });

  it("con la base de datos bien: resume lo que no cabe, guarda (insert si no había) y apunta el total en el run", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ author: i % 2 === 0 ? "contact" : "agent", content: `m${i}`, created_at: `2030-06-03T09:0${i}:00Z` }));
    const db = fakeDb((table, ops) => {
      if (table === "messages") return { data: rows, error: null };
      if (table === "conversation_summaries" && ops.includes("update")) return { data: [], error: null };
      return { data: null, error: null };
    });
    const transport = createFakeTransport({
      provider: "fake",
      respond: (request) => ({ text: request.messages[0]?.content === SUMMARY_INSTRUCTIONS ? "Customer said: m0." : "?", ...usage }),
    });
    const step = await summarizeStep({
      db,
      organizationId: "org-1",
      runId: "run-1",
      conversationId: "conv-1",
      previous: null,
      router: createModelRouter([transport]),
      policy: PLATFORM_MODEL_POLICY,
      spend: { runEur: 0, dayEur: 0 },
    });
    expect(step).toEqual({ kind: "updated", summary: "Customer said: m0.", coveredUntil: "2030-06-03T09:01:00Z", usage });
    expect(transport.calls[0]?.modelKey).toBe("fast");
    if (step.kind !== "updated") return;
    expect(await saveSummary(db, "conv-1", step)).toBeNull();
    expect(db.calls.filter((call) => call.table === "conversation_summaries").map((call) => call.ops[0])).toEqual(["update", "insert"]);
    expect(await bookSummaryUsage(db, "run-1", { tokensIn: 110, tokensOut: 22, costEur: 0.011 })).toBeNull();
  });
});
