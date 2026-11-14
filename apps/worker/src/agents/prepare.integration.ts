import { randomUUID } from "node:crypto";
import pg from "pg";
import { createServiceDb } from "@repo/db/service";
import type { TenantDb } from "@repo/db/service";
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

describe("prepare con la organización explícita, también sin RLS (revisión de V10 sobre #309)", () => {
  // Con el cliente de administración (postgres, sin RLS) lo único que separa
  // las organizaciones es el filtro explícito de cada consulta. La organización
  // de la transacción se fija igual que el worker, para la función del contexto.
  function adminTenant(organizationId: string): TenantDb {
    return {
      organizationId,
      transaction: async <T,>(fn: (sql: { query: <R>(text: string, params?: readonly unknown[]) => Promise<R[]> }) => Promise<T>): Promise<T> => {
        await admin.query("begin");
        try {
          await admin.query("select set_config('moodly.organization_id', $1, true)", [organizationId]);
          const result = await fn({ query: async <R,>(text: string, params?: readonly unknown[]) => (await admin.query(text, params as unknown[])).rows as R[] });
          await admin.query("commit");
          return result;
        } catch (error) {
          await admin.query("rollback");
          throw error;
        }
      },
    } as unknown as TenantDb;
  }

  it("un servicio de otra organización (sin local, que valdría para cualquiera) no llega al prompt", async () => {
    // La del chat de pruebas de A (el agente del seed está en borrador: solo
    // contesta ahí), en modo agente y con local, y su último mensaje del cliente.
    const { rows } = await admin.query<{ id: string; message_id: string; agent_id: string }>(
      `select c.id, c.agent_id,
              (select m.id from public.messages m where m.conversation_id = c.id and m.author = 'contact' order by m.created_at desc limit 1) as message_id
       from public.conversations c
       where c.organization_id = $1 and c.channel = 'test' and c.mode = 'agent' and c.location_id is not null
         and exists (select 1 from public.messages m where m.conversation_id = c.id and m.author = 'contact')
       order by c.created_at limit 1`,
      [orgA],
    );
    const conversation = rows[0];
    if (!conversation) throw new Error("el seed no tiene la conversación del chat de pruebas de Demo A");
    // Que el agente reserve: así lee los servicios. Se deja como estaba al acabar.
    const { rows: skills } = await admin.query<{ skill_id: string; enabled: boolean }>(
      `select s.skill_id, s.enabled from public.agent_skills s join public.skills k on k.id = s.skill_id
       where s.agent_id = $1 and k.key = 'find_slots'`,
      [conversation.agent_id],
    );
    const findSlots = skills[0];
    if (!findSlots) throw new Error("el agente de la conversación no tiene find_slots");
    const marker = `Servicio de B ${randomUUID().slice(0, 8)}`;
    const mine = `Servicio de A ${randomUUID().slice(0, 8)}`;
    const { rows: inserted } = await admin.query<{ id: string }>(
      `insert into public.services (organization_id, location_id, name, duration_minutes) values ($1, null, $2, 30), ($3, null, $4, 30) returning id`,
      [orgB, marker, orgA, mine],
    );
    await admin.query("update public.agent_skills set enabled = true where agent_id = $1 and skill_id = $2", [conversation.agent_id, findSlots.skill_id]);
    try {
      const result = await prepare(adminTenant(orgA), conversation.id, conversation.message_id);
      if (result.kind !== "turn") throw new Error(`prepare no llegó al turno: ${JSON.stringify(result)}`);
      const names = (result.services ?? []).map((row) => row.name);
      // El de A sí está (el test no pasa por no leer servicios), el de B no.
      expect(names).toContain(mine);
      expect(names).not.toContain(marker);
    } finally {
      await admin.query("update public.agent_skills set enabled = $3 where agent_id = $1 and skill_id = $2", [
        conversation.agent_id,
        findSlots.skill_id,
        findSlots.enabled,
      ]);
      await admin.query("delete from public.services where id = any($1)", [inserted.map((row) => row.id)]);
    }
  });
});
