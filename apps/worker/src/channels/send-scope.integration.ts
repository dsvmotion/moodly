import { randomUUID } from "node:crypto";
import type { TenantDb, TenantSql } from "@repo/db/service";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl } from "../testing/local-system-db.ts";
import { loadOutgoing } from "./send.ts";

// 3.2: a quién se envía un mensaje sale de las subconsultas de loadOutgoing
// (el número del último mensaje que entró, si sigue siendo una identidad del
// contacto, o su teléfono). Cada una filtra por la organización explícita.
// Aquí corren con el cliente de administración, sin RLS: las filas de otra
// organización que apuntan a esta conversación o a este contacto (las claves
// ajenas compuestas no las dejarían existir; se meten saltándoselas, como lo
// que solo pararía el filtro) no cambian el destinatario.
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const marker = `send-scope-${randomUUID().slice(0, 8)}`;
const asAdmin: TenantSql = {
  query: async <R extends pg.QueryResultRow>(text: string, params?: readonly unknown[]) => (await admin.query<R>(text, params as unknown[])).rows,
};

type ScopedDb = Pick<TenantDb, "organizationId" | "transaction">;
function adminDb(organizationId: string): ScopedDb {
  return {
    organizationId,
    transaction: (async <T,>(fn: (sql: TenantSql) => Promise<T>): Promise<T> => {
      await admin.query("begin");
      try {
        await admin.query("select set_config('moodly.organization_id', $1, true)", [organizationId]);
        const result = await fn(asAdmin);
        await admin.query("commit");
        return result;
      } catch (error) {
        await admin.query("rollback");
        throw error;
      }
    }) as ScopedDb["transaction"],
  };
}

let orgA = "";
let accountA = "";
let agentA = "";
let orgC = "";
let accountC = "";
const contacts: string[] = [];

async function one<T extends Record<string, unknown>>(text: string, params: unknown[]): Promise<T> {
  const { rows } = await admin.query<T>(text, params);
  if (!rows[0]) throw new Error(`sin fila: ${text}`);
  return rows[0];
}

const phone = () => `+3460${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;

/** Una conversación de WhatsApp de Demo A con su mensaje pendiente de salir, y las identidades de teléfono del contacto. */
async function outgoing(phones: string[]) {
  const { id: contact } = await one<{ id: string }>("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [
    orgA,
    marker,
  ]);
  contacts.push(contact);
  for (const value of phones) {
    await admin.query("insert into public.contact_identities (organization_id, contact_id, kind, external_id) values ($1, $2, 'phone', $3)", [
      orgA,
      contact,
      value,
    ]);
  }
  const { id: conversation } = await one<{ id: string }>(
    `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, channel, agent_id)
     select $1, ca.location_id, $2, ca.id, ca.channel, $4 from public.channel_accounts ca where ca.id = $3 returning id`,
    [orgA, contact, accountA, agentA],
  );
  const { id: message } = await one<{ id: string }>(
    `insert into public.messages (organization_id, conversation_id, direction, author, content, status)
     values ($1, $2, 'out', 'agent', 'Hola', 'pending') returning id`,
    [orgA, conversation],
  );
  return { contact, conversation, message };
}

/** Un mensaje que entró en esa conversación desde ese número, procesado, en la organización dada. */
async function inbound(organizationId: string, account: string, conversation: string, from: string): Promise<void> {
  const payload = { from: { kind: "phone", value: from }, providerEventId: `${marker}-${randomUUID()}` };
  await admin.query(
    `insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload, status, processed_at, conversation_id)
     values ($1, $2, $3, $4, 'processed', now(), $5)`,
    [organizationId, account, payload.providerEventId, JSON.stringify(payload), conversation],
  );
}

/** Lo que solo pararía el filtro: filas de otra organización saltándose sus claves ajenas. */
async function foreign(fn: () => Promise<void>): Promise<void> {
  await admin.query("begin");
  try {
    await admin.query("set local session_replication_role = replica");
    await fn();
    await admin.query("commit");
  } catch (error) {
    await admin.query("rollback");
    throw error;
  }
}

beforeAll(async () => {
  await admin.connect();
  ({ org: orgA, account: accountA, agent: agentA } = await one<{ org: string; account: string; agent: string }>(
    `select o.id as org, ca.id as account, (select id from public.agents where organization_id = o.id order by created_at limit 1) as agent
     from public.organizations o join public.channel_accounts ca on ca.organization_id = o.id and ca.channel = 'whatsapp'
     where o.name = 'Demo A' order by ca.created_at limit 1`,
    [],
  ));
  ({ org: orgC, account: accountC } = await one<{ org: string; account: string }>(
    `select o.id as org, ca.id as account from public.organizations o join public.channel_accounts ca on ca.organization_id = o.id
     where o.name = 'Demo C' order by ca.created_at limit 1`,
    [],
  ));
});

afterAll(async () => {
  await admin.query("delete from public.inbound_events where provider_event_id like $1", [`${marker}%`]);
  await admin.query("delete from public.contact_identities where contact_id = any($1)", [contacts]);
  await admin.query("delete from public.conversations where contact_id = any($1)", [contacts]);
  await admin.query("delete from public.contacts where id = any($1)", [contacts]);
  await admin.end();
});

describe("channels.send: a quién se envía, con la organización explícita también en las subconsultas (3.2)", () => {
  it("un teléfono de otra organización atado a este contacto no es su teléfono", async () => {
    const mine = await outgoing([]);
    const theirs = phone();
    await foreign(() =>
      admin.query("insert into public.contact_identities (organization_id, contact_id, kind, external_id) values ($1, $2, 'phone', $3)", [
        orgC,
        mine.contact,
        theirs,
      ]).then(() => undefined),
    );
    const row = await loadOutgoing(adminDb(orgA), mine.message, mine.conversation);
    expect(row?.phone).toBeNull();
  });

  it("un mensaje que entró en otra organización no elige el número de esta conversación", async () => {
    const [first, second] = [phone(), phone()].sort();
    const mine = await outgoing([first as string, second as string]);
    // El de otra organización, desde el segundo número: sin el filtro, ganaría al de siempre (el primero).
    await foreign(() => inbound(orgC, accountC, mine.conversation, second as string));
    expect((await loadOutgoing(adminDb(orgA), mine.message, mine.conversation))?.phone).toBe(first);
    // Control: el mismo mensaje en esta organización sí elige el segundo.
    await inbound(orgA, accountA, mine.conversation, second as string);
    expect((await loadOutgoing(adminDb(orgA), mine.message, mine.conversation))?.phone).toBe(second);
  });

  it("el número del último mensaje solo vale si es identidad del contacto en esta organización", async () => {
    const usual = phone();
    const mine = await outgoing([usual]);
    const other = phone();
    // Entró desde otro número, que solo es «identidad» del contacto en otra organización.
    await inbound(orgA, accountA, mine.conversation, other);
    await foreign(() =>
      admin.query("insert into public.contact_identities (organization_id, contact_id, kind, external_id) values ($1, $2, 'phone', $3)", [
        orgC,
        mine.contact,
        other,
      ]).then(() => undefined),
    );
    expect((await loadOutgoing(adminDb(orgA), mine.message, mine.conversation))?.phone).toBe(usual);
  });
});
