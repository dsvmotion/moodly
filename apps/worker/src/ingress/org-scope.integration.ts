import { randomUUID } from "node:crypto";
import type { NormalizedInbound } from "@repo/channels";
import type { TenantSql } from "@repo/db/service";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl } from "../testing/local-system-db.ts";
import {
  ensureContact,
  ensureConversation,
  insertMessage,
  load,
  markProcessed,
  messageReceivedEvent,
  recordFailure,
  settle,
  type IngressDb,
} from "./ingest.ts";
import { storeInboundEvent } from "./receive.ts";

// 3.2: las consultas de la entrada filtran por la organización explícita, no
// solo por RLS. Aquí corren con el cliente de administración (sin RLS ni
// guardas), con la organización de la sesión fijada como la fija el worker:
// lo único que separa una organización de otra es el filtro de cada consulta.
// Las filas de otra organización usan las mismas claves (ids, identidad,
// external_message_id…) que se le piden a esta, y no se ven ni se tocan.
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const marker = `scope-${randomUUID().slice(0, 8)}`;

interface Sent {
  text: string;
  params: readonly unknown[];
}
let sent: Sent[] = [];
const asAdmin: TenantSql = {
  query: async <R extends pg.QueryResultRow>(text: string, params?: readonly unknown[]) => {
    sent.push({ text, params: params ?? [] });
    return (await admin.query<R>(text, params as unknown[])).rows;
  },
};

/** Un TenantDb sobre el cliente de administración: la transacción y la organización de la sesión, sin RLS. */
function adminDb(organizationId: string): IngressDb {
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
    }) as IngressDb["transaction"],
  };
}

interface Side {
  org: string;
  account: string;
  contact: string;
  conversation: string;
}
let a: Side;
let c: Side;
const created = { contacts: [] as string[], conversations: [] as string[], events: [] as string[] };

async function one<T extends Record<string, unknown>>(text: string, params: unknown[]): Promise<T> {
  const { rows } = await admin.query<T>(text, params);
  if (!rows[0]) throw new Error(`sin fila: ${text}`);
  return rows[0];
}

async function side(orgName: string): Promise<Side> {
  const { org, account } = await one<{ org: string; account: string }>(
    `select o.id as org, ca.id as account from public.organizations o
     join public.channel_accounts ca on ca.organization_id = o.id and ca.channel = 'webchat' and ca.status = 'active'
     where o.name = $1 order by ca.created_at limit 1`,
    [orgName],
  );
  const { id: contact } = await one<{ id: string }>("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [org, marker]);
  created.contacts.push(contact);
  const { id: agent } = await one<{ id: string }>("select id from public.agents where organization_id = $1 order by created_at limit 1", [org]);
  const { id: conversation } = await one<{ id: string }>(
    `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, channel, agent_id)
     select $1, ca.location_id, $2, ca.id, ca.channel, $4 from public.channel_accounts ca where ca.id = $3 returning id`,
    [org, contact, account, agent],
  );
  created.conversations.push(conversation);
  return { org, account, contact, conversation };
}

function inbound(overrides: Partial<NormalizedInbound> = {}): NormalizedInbound {
  return {
    channel: "webchat",
    accountExternalId: marker,
    providerEventId: `${marker}-${randomUUID()}`,
    from: { kind: "webchat", value: `${marker}-${randomUUID()}` },
    receivedAt: new Date().toISOString(),
    text: "Hola",
    attachments: [],
    ...overrides,
  } as NormalizedInbound;
}

async function inboundEvent(target: Side, message = inbound()): Promise<string> {
  const { id } = await one<{ id: string }>(
    `insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload) values ($1, $2, $3, $4) returning id`,
    [target.org, target.account, message.providerEventId, JSON.stringify(message)],
  );
  created.events.push(id);
  return id;
}

async function eventRow(id: string) {
  return one<{ status: string; attempts: number; error_code: string | null; conversation_id: string | null }>(
    "select status, attempts, error_code, conversation_id from public.inbound_events where id = $1",
    [id],
  );
}

/**
 * La única consulta de la entrada sin la organización entre sus parámetros:
 * private.worker_agent_turn_context, que la toma de la sesión de la
 * transacción (worker_organization_id(), 20261112110000) y filtra por ella.
 */
const SCOPED_BY_SESSION = "select private.worker_agent_turn_context(";

/** Todas las consultas que mandó la entrada llevaban la organización explícita entre sus parámetros. */
function everyQueryScopedTo(org: string): void {
  const sql = sent.filter((s) => !s.text.startsWith("select set_config") && !s.text.startsWith(SCOPED_BY_SESSION));
  expect(sql.length).toBeGreaterThan(0);
  for (const statement of sql) expect(statement.params, statement.text).toContain(org);
}

beforeAll(async () => {
  await admin.connect();
  a = await side("Demo A");
  c = await side("Demo C");
});

afterAll(async () => {
  await admin.query("delete from public.inbound_events where id = any($1) or payload->>'accountExternalId' = $2", [created.events, marker]);
  await admin.query("delete from public.conversations where id = any($1) or contact_id = any($2)", [created.conversations, created.contacts]);
  await admin.query(
    "delete from public.contacts where id = any($1) or id in (select contact_id from public.contact_identities where external_id like $2)",
    [created.contacts, `${marker}%`],
  );
  await admin.end();
});

describe("entrada de canales: cada consulta con la organización explícita, también sin RLS (3.2)", () => {
  it("el evento de entrada de otra organización no se lee ni se toca (load, settle, recordFailure, markProcessed)", async () => {
    const mine = await inboundEvent(a);
    const theirs = await inboundEvent(c);
    const db = adminDb(a.org);
    sent = [];

    expect(await load(db, theirs)).toBeNull();
    await settle(db, theirs, "ignored", "scope_test");
    await recordFailure(db, theirs, 2, "scope_test");
    await markProcessed(db, theirs, a.conversation, randomUUID());
    expect(await eventRow(theirs)).toMatchObject({ status: "received", attempts: 0, error_code: null, conversation_id: null });

    // Control: los de esta organización sí.
    expect((await load(db, mine))?.channelAccountId).toBe(a.account);
    await recordFailure(db, mine, 2, "scope_test");
    expect(await eventRow(mine)).toMatchObject({ status: "failed", attempts: 2, error_code: "scope_test" });
    everyQueryScopedTo(a.org);
  });

  it("el evento repetido se busca en su organización (storeInboundEvent)", async () => {
    // La base de datos ya impide que una cuenta tenga eventos de otra
    // organización (clave ajena compuesta con channel_accounts).
    const message = inbound();
    await expect(
      admin.query("insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload) values ($1, $2, $3, $4)", [
        c.org,
        a.account,
        message.providerEventId,
        JSON.stringify(message),
      ]),
    ).rejects.toMatchObject({ code: "23503" });
    sent = [];
    const first = await storeInboundEvent(adminDb(a.org), a.account, message);
    expect(first?.inserted).toBe(true);
    if (first) created.events.push(first.id);
    const again = await storeInboundEvent(adminDb(a.org), a.account, message);
    expect(again).toMatchObject({ id: first?.id, inserted: false });
    everyQueryScopedTo(a.org);
    // Con la organización de la otra (la misma cuenta y el mismo evento): la
    // inserción choca y no hace nada, y el repetido no se encuentra en la suya.
    // Sin el filtro, devolvería el evento de esta organización.
    expect(await storeInboundEvent(adminDb(c.org), a.account, message)).toBeUndefined();
  });

  it("la identidad de un cliente en otra organización no da su contacto: aquí se crea uno nuevo (ensureContact)", async () => {
    const from = { kind: "webchat" as const, value: `${marker}-${randomUUID()}` };
    await admin.query("insert into public.contact_identities (organization_id, contact_id, kind, external_id) values ($1, $2, $3, $4)", [
      c.org,
      c.contact,
      from.kind,
      from.value,
    ]);
    sent = [];
    const contact = await ensureContact(adminDb(a.org), inbound({ from }));
    created.contacts.push(contact);
    expect(contact).not.toBe(c.contact);
    expect((await one<{ organization_id: string }>("select organization_id from public.contacts where id = $1", [contact])).organization_id).toBe(a.org);
    everyQueryScopedTo(a.org);
  });

  it("la conversación abierta y la cuenta de otra organización no se usan (ensureConversation)", async () => {
    sent = [];
    // Con el contacto y la cuenta de la otra: sin el filtro devolvería su conversación abierta.
    expect(await ensureConversation(adminDb(a.org), c.account, c.contact)).toEqual({ failed: "channel_account_missing" });
    // Control: con los suyos, la suya.
    expect(await ensureConversation(adminDb(a.org), a.account, a.contact)).toBe(a.conversation);
    everyQueryScopedTo(a.org);
  });

  it("los agentes se buscan en la organización: una conversación nueva nace con un agente suyo (ensureConversation)", async () => {
    const { id: contact } = await one<{ id: string }>("insert into public.contacts (organization_id, display_name) values ($1, $2) returning id", [
      a.org,
      marker,
    ]);
    created.contacts.push(contact);
    sent = [];
    const conversation = await ensureConversation(adminDb(a.org), a.account, contact);
    if (typeof conversation !== "string") throw new Error(`no se abrió: ${conversation.failed}`);
    created.conversations.push(conversation);
    const { org } = await one<{ org: string }>(
      "select ag.organization_id as org from public.conversations cv join public.agents ag on ag.id = cv.agent_id where cv.id = $1",
      [conversation],
    );
    expect(org).toBe(a.org);
    const agents = sent.find((s) => s.text.includes("from public.agents"));
    expect(agents?.params).toEqual([a.org]);
    // El contexto de cada agente se pidió con la organización de la sesión fijada a esta.
    expect(sent.some((s) => s.text.startsWith(SCOPED_BY_SESSION))).toBe(true);
    everyQueryScopedTo(a.org);
  });

  it("el mensaje de otra organización con la misma clave no se toma por el guardado (insertMessage)", async () => {
    const message = inbound({ providerMessageId: `${marker}-${randomUUID()}` });
    const { id: theirs } = await one<{ id: string }>(
      `insert into public.messages (organization_id, conversation_id, direction, author, content, external_message_id, status)
       values ($1, $2, 'in', 'contact', 'Hola', $3, 'received') returning id`,
      [c.org, c.conversation, message.providerMessageId],
    );
    sent = [];
    // Con la conversación de la otra: sin el filtro devolvería su mensaje; con él,
    // intenta guardarlo en esta organización y la base de datos lo rechaza.
    const result = await insertMessage(adminDb(a.org), c.conversation, message).catch((error: unknown) => error);
    expect(result).not.toBe(theirs);
    expect(result).toBeInstanceOf(Error);
    everyQueryScopedTo(a.org);
  });

  it("el message.received de otra organización no se toma por el del mensaje (messageReceivedEvent)", async () => {
    const { id: message } = await one<{ id: string }>(
      `insert into public.messages (organization_id, conversation_id, direction, author, content, status)
       values ($1, $2, 'in', 'contact', 'Hola', 'received') returning id`,
      [c.org, c.conversation],
    );
    // emit_message_received lo escribió en la organización del mensaje.
    expect((await admin.query("select 1 from public.domain_events where type = 'message.received' and payload->>'message_id' = $1", [message])).rowCount).toBe(1);
    sent = [];
    expect(await messageReceivedEvent(adminDb(a.org), message)).toBeNull();
    everyQueryScopedTo(a.org);
    // Control: con la suya, sí.
    expect((await messageReceivedEvent(adminDb(c.org), message))?.type).toBe("message.received");
  });
});
