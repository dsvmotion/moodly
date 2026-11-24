import { randomUUID } from "node:crypto";
import pg from "pg";
import type { TurnResult } from "@repo/agent-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminTenant } from "../testing/admin-tenant.ts";
import { localAdminDatabaseUrl } from "../testing/local-system-db.ts";
import { load, settleExecution, settleRun } from "./approvals.ts";
import { createConversationSender } from "./conversation-sender.ts";
import { finishRun } from "./converse.ts";
import { bookSummaryUsage, saveSummary } from "./summary.ts";

// Control 3.2 (CLAUDE.md): el SQL del worker lleva la organización explícita,
// además de RLS. Aquí, sin RLS (cliente de administración, adminTenant), cada
// camino que escribe o lee por SQL a mano se llama con la organización B
// sobre filas de A: no ve ni toca nada. Y con A, sí (el test no pasa por no
// encontrar nada). El test estructural (tenant-sql-org.test.ts) mira que cada
// consulta tenga el filtro; este, que el filtro hace lo que dice.

const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
let orgA = "";
let orgB = "";
const ids: Record<string, string> = {};
const hash = "c".repeat(64);

async function one(text: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(text, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`sin id: ${text}`);
  return id;
}

beforeAll(async () => {
  await admin.connect();
  orgA = await one("select id from public.organizations where name = 'Demo A'", []);
  // La otra organización: Demo C, que tiene una conversación (la del envío).
  orgB = await one("select id from public.organizations where name = 'Demo C'", []);
  // Lo de A: una conversación en modo agente, su último mensaje del cliente, un run esperando una aprobación y su ejecución en borrador.
  const conversation = (
    await admin.query<{ id: string; location_id: string; agent_id: string }>(
      `select id, location_id, agent_id from public.conversations
       where organization_id = $1 and mode = 'agent' and location_id is not null order by created_at limit 1`,
      [orgA],
    )
  ).rows[0];
  if (!conversation) throw new Error("el seed no tiene una conversación de Demo A en modo agente con local");
  ids.conversation = conversation.id;
  // Un mensaje del cliente que ya existe (del seed): uno nuevo emitiría message.received y
  // el worker del test siguiente le contestaría con su modelo de guion.
  ids.message = await one(
    "select id from public.messages where conversation_id = $1 and author = 'contact' order by created_at desc limit 1",
    [conversation.id],
  );
  ids.run = await one(
    `insert into public.agent_runs (organization_id, location_id, agent_id, trigger, trigger_ref, status, tokens_in, tokens_out, cost_eur)
     values ($1, $2, $3, 'inbound_message', $4, 'awaiting_approval', 10, 10, 0.01) returning id`,
    [orgA, conversation.location_id, conversation.agent_id, ids.message],
  );
  ids.execution = await one(
    `insert into public.executions (organization_id, location_id, run_id, skill_key, skill_version, effect_class, autonomy_applied,
                                    input, target, input_hash, preview, status, idempotency_key)
     values ($1, $2, $3, 'reply', 1, 'external_message', 'draft', '{"text": "Hola"}', $4, $5, '{"summary": "Responder"}', 'drafted', $6)
     returning id`,
    [orgA, conversation.location_id, ids.run, JSON.stringify({ kind: "conversation", conversationId: conversation.id }), hash, `3.2:${randomUUID()}`],
  );
  ids.approval = await one(
    `insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
     values ($1, $2, $3, 'external_message', $4, 'staff', now() + interval '1 day') returning id`,
    [ids.execution, orgA, conversation.location_id, hash],
  );
});

afterAll(async () => {
  if (ids.run) await admin.query("delete from public.agent_runs where id = $1", [ids.run]);
  await admin.query("delete from public.messages where id = any($1)", [[ids.sentB, ids.sentA].filter(Boolean)]);
  await admin.query("update public.conversations set mode = 'agent' where id = $1", [ids.conversation]);
  await admin.end();
});

const state = async () =>
  (
    await admin.query<{ execution: string; run: string; tokens_in: number; mode: string }>(
      `select e.status as execution, r.status as run, r.tokens_in::int as tokens_in, c.mode
       from public.executions e join public.agent_runs r on r.id = e.run_id join public.conversations c on c.id = $2
       where e.id = $1`,
      [ids.execution, ids.conversation],
    )
  ).rows[0];

describe("el SQL del worker con la organización explícita, sin RLS (control 3.2)", () => {
  it("approvals.load: con B no encuentra la aprobación de A; con A, sí", async () => {
    expect(await load(adminTenant(admin, orgB), ids.approval ?? "", ids.execution ?? "")).toEqual({ kind: "skip", reason: "approval_missing" });
    const mine = await load(adminTenant(admin, orgA), ids.approval ?? "", ids.execution ?? "");
    expect(mine).toMatchObject({ kind: "decided", conversationId: ids.conversation });
  });

  it("finishRun: con B no pasa a una persona la conversación de A ni toca su run", async () => {
    const before = await state();
    const result = { status: "handed_off", reason: "customer_asked", executions: [], usage: { model: "x", tokensIn: 999, tokensOut: 999, costEur: 9, calls: [] } };
    await finishRun(adminTenant(admin, orgB), ids.run ?? "", ids.conversation ?? "", result as unknown as TurnResult, false);
    expect(await state()).toEqual(before);
  });

  it("bookSummaryUsage: con B no sube el gasto del run de A; con A, sí", async () => {
    await bookSummaryUsage(adminTenant(admin, orgB), ids.run ?? "", { tokensIn: 500, tokensOut: 500, costEur: 1 });
    expect((await state())?.tokens_in).toBe(10);
    await bookSummaryUsage(adminTenant(admin, orgA), ids.run ?? "", { tokensIn: 500, tokensOut: 500, costEur: 1 });
    expect((await state())?.tokens_in).toBe(500);
  });

  it("saveSummary: con B no pisa el resumen de la conversación de A", async () => {
    await admin.query("delete from public.conversation_summaries where conversation_id = $1", [ids.conversation]);
    await admin.query(
      `insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until, model)
       values ($1, $2, 'El de A', now() - interval '1 hour', 'x')`,
      [ids.conversation, orgA],
    );
    const step = { kind: "updated" as const, summary: "El de B", coveredUntil: new Date().toISOString(), usage: { tokensIn: 1, tokensOut: 1, costEur: 0, model: "x" }, call: {} };
    await saveSummary(adminTenant(admin, orgB), ids.conversation ?? "", step as Parameters<typeof saveSummary>[2]);
    const { rows } = await admin.query<{ summary: string }>("select summary from public.conversation_summaries where conversation_id = $1", [ids.conversation]);
    expect(rows.map((row) => row.summary)).toEqual(["El de A"]);
    await admin.query("delete from public.conversation_summaries where conversation_id = $1", [ids.conversation]);
  });

  it("el envío: con la misma clave de idempotencia en B, A no devuelve el mensaje de B", async () => {
    const key = `3.2-envio:${randomUUID()}`;
    const conversationB = await one("select id from public.conversations where organization_id = $1 order by created_at limit 1", [orgB]);
    ids.sentB = await one(
      "insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key) values ($1, $2, 'out', 'agent', 'De B', 'sent', $3) returning id",
      [orgB, conversationB, key],
    );
    const sent = await createConversationSender(adminTenant(admin, orgA)).send({ conversationId: ids.conversation ?? "", text: "De A", idempotencyKey: key });
    ids.sentA = sent.messageId;
    expect(sent.messageId).not.toBe(ids.sentB);
    const { rows } = await admin.query<{ organization_id: string; content: string }>("select organization_id, content from public.messages where id = $1", [sent.messageId]);
    expect(rows[0]).toEqual({ organization_id: orgA, content: "De A" });
  });

  it("settleExecution y settleRun: con B no cierran la ejecución ni el run de A; con A, sí", async () => {
    await settleExecution(adminTenant(admin, orgB), ids.execution ?? "", "failed");
    await settleRun(adminTenant(admin, orgB), ids.run ?? "");
    expect(await state()).toMatchObject({ execution: "drafted", run: "awaiting_approval" });
    await settleExecution(adminTenant(admin, orgA), ids.execution ?? "", "failed");
    await settleRun(adminTenant(admin, orgA), ids.run ?? "");
    expect(await state()).toMatchObject({ execution: "failed", run: "completed" });
  });
});
