import { randomUUID } from "node:crypto";
import pg from "pg";
import { createServiceDb } from "@repo/db/service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { prepare } from "./converse.ts";

// prepare (las lecturas del turno) va por SQL bajo RLS como moodly_worker (ADR
// 0049): con la organización de un evento, una conversación de otra no existe,
// aunque llegue su id. Contra Supabase local con el seed aplicado.
const api = localSupabaseApi();
const service = createServiceDb({ url: api.url, secretKey: api.secretKey, workerDatabaseUrl: localWorkerDatabaseUrl() });
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
let orgA = "";
let orgB = "";
let conversationA = "";

beforeAll(async () => {
  await admin.connect();
  const { rows } = await admin.query<{ name: string; id: string }>(
    "select name, id from public.organizations where name in ('Demo A', 'Demo B')",
  );
  orgA = rows.find((row) => row.name === "Demo A")?.id ?? "";
  orgB = rows.find((row) => row.name === "Demo B")?.id ?? "";
  const conversation = await admin.query<{ id: string }>(
    "select id from public.conversations where organization_id = $1 order by created_at limit 1",
    [orgA],
  );
  conversationA = conversation.rows[0]?.id ?? "";
  if (!orgA || !orgB || !conversationA) throw new Error("el seed no tiene Demo A, Demo B o una conversación de Demo A");
});

afterAll(async () => {
  await admin.end();
  await service.end();
});

describe("prepare bajo RLS (moodly_worker)", () => {
  it("con la organización de B, una conversación de A no existe (conversation_missing)", async () => {
    const result = await prepare(service.forOrganization(orgB), conversationA, randomUUID());
    expect(result).toEqual({ kind: "skip", reason: "conversation_missing" });
  });

  it("con la de A, la misma conversación sí existe (el test de arriba no pasa por no encontrarla nunca)", async () => {
    const result = await prepare(service.forOrganization(orgA), conversationA, randomUUID());
    expect(result).not.toEqual({ kind: "skip", reason: "conversation_missing" });
  });
});
