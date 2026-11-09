import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "./database.types.js";
import { seedLocations, seedOrganizations } from "./seed/data.ts";
import { readLocalSupabase } from "./seed/local-supabase.ts";
import { TenantScopeError, createServiceDb } from "./service.ts";

// tenantDb contra Supabase local con el seed aplicado: lo que no se ve en el
// test unitario (que PostgREST aplica de verdad el filtro con la clave
// secreta, sin RLS). Las filas de prueba son regiones temporales que se borran
// al terminar; no se toca ningún dato del seed.
const local = readLocalSupabase();
const service = createServiceDb({ url: local.apiUrl, secretKey: local.secretKey });
// Cliente sin acotar, solo para preparar y comprobar desde fuera.
const admin = createClient<Database>(local.apiUrl, local.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function orgId(name: string): string {
  const org = seedOrganizations.find((candidate) => candidate.name === name);
  if (!org) throw new Error(`No hay organización ${name} en el seed`);
  return org.id;
}
const ORG_A = orgId("Demo A");
const ORG_B = orgId("Demo B");
const tenantA = service.forOrganization(ORG_A);
const marker = `tenantdb-${randomUUID()}`;
// Por id y no por nombre: si el filtro fallara, la región de B quedaría renombrada.
const created: string[] = [];

async function regionOfB(): Promise<string> {
  const { data, error } = await admin.from("regions").insert({ organization_id: ORG_B, name: `${marker}-b` }).select("id").single();
  if (error) throw new Error(error.message);
  created.push(data.id);
  return data.id;
}

async function regionName(id: string): Promise<string | null> {
  const { data, error } = await admin.from("regions").select("name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.name ?? null;
}

const createdSources: string[] = [];
const createdContacts: string[] = [];
const createdAccounts: string[] = [];

afterAll(async () => {
  // Las conversaciones y los mensajes caen con su contacto (on delete cascade).
  await admin.from("contacts").delete().in("id", createdContacts);
  await admin.from("channel_accounts").delete().in("id", createdAccounts);
  await admin.from("regions").delete().in("id", created);
  await admin.from("regions").delete().like("name", `${marker}%`);
  // Los fragmentos caen con su fuente (on delete cascade).
  await admin.from("knowledge_sources").delete().in("id", createdSources);
});

/** Una fuente lista con un fragmento, como la dejaría la ingesta del worker. */
async function knowledgeOf(organizationId: string, content: string): Promise<string> {
  const source = await admin
    .from("knowledge_sources")
    .insert({ organization_id: organizationId, type: "faq", title: `${marker}-faq`, status: "ready" })
    .select("id")
    .single();
  if (source.error) throw new Error(source.error.message);
  createdSources.push(source.data.id);
  const chunk = await admin
    .from("knowledge_chunks")
    .insert({
      organization_id: organizationId,
      source_id: source.data.id,
      ordinal: 0,
      content,
      embedding: "[1,0,0]",
      embedding_model: `${marker}-embed`,
      embedding_dim: 3,
    })
    .select("id")
    .single();
  if (chunk.error) throw new Error(chunk.error.message);
  return chunk.data.id;
}

describe("tenantDb con la clave secreta (sin RLS)", () => {
  it("lee solo los datos de su organización", async () => {
    const { data, error } = await tenantA.from("locations").select("id, organization_id");
    expect(error).toBeNull();
    const expected = seedLocations.filter((location) => location.organizationId === ORG_A).map((location) => location.id);
    expect(data?.map((row) => row.id).sort()).toEqual([...expected].sort());
    expect(data?.every((row) => row.organization_id === ORG_A)).toBe(true);
  });

  it("no actualiza ni borra una fila de otra organización aunque se pida por su id", async () => {
    const id = await regionOfB();

    const updated = await tenantA.from("regions").update({ name: "cambiada" }).eq("id", id).select("id");
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([]);

    const deleted = await tenantA.from("regions").delete().eq("id", id).select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([]);

    expect(await regionName(id)).toBe(`${marker}-b`);
  });

  it("inserta con su organización y rechaza filas de otra antes de llegar a la base de datos", async () => {
    const { data, error } = await tenantA.from("regions").insert({ name: `${marker}-a` }).select("id, organization_id").single();
    expect(error).toBeNull();
    if (data) created.push(data.id);
    expect(data?.organization_id).toBe(ORG_A);

    expect(() => tenantA.from("regions").insert({ name: `${marker}-x`, organization_id: ORG_B })).toThrow(TenantScopeError);
    const { count } = await admin.from("regions").select("id", { count: "exact", head: true }).eq("name", `${marker}-x`);
    expect(count).toBe(0);
  });
});

describe("tenantDb.searchKnowledge contra search_knowledge (ADR 0037)", () => {
  it("solo devuelve el conocimiento de su organización, aunque el de otra encaje mejor", async () => {
    const mine = await knowledgeOf(ORG_A, "Opening hours of A: 9 to 20");
    await knowledgeOf(ORG_B, "Opening hours opening hours of B");

    const rows = await tenantA.searchKnowledge({
      locationId: null,
      embeddingModel: `${marker}-embed`,
      queryEmbedding: [1, 0, 0],
      query: "opening hours",
      k: 10,
    });
    expect(rows.map((row) => row.chunk_id)).toEqual([mine]);
    expect(rows[0]).toMatchObject({ source_type: "faq", source_title: `${marker}-faq` });
  });
});

describe("tenantDb con conversaciones y mensajes (paso 4a)", () => {
  it("el worker escribe un mensaje en la tabla particionada y solo lo ve su organización", async () => {
    const agent = await tenantA.from("agents").select("id, agent_type_id").limit(1).single();
    expect(agent.error).toBeNull();
    // El tipo de agente sale de los datos, nunca escrito en el código (ADR 0030 §1).
    const type = await admin.from("agent_types").select("key").eq("id", agent.data?.agent_type_id ?? "").single();
    expect(type.error).toBeNull();
    const account = await tenantA
      .from("channel_accounts")
      .insert({ channel: "webchat", external_id: `${marker}-web`, default_agent_type: type.data?.key ?? "", status: "active" })
      .select("id")
      .single();
    expect(account.error).toBeNull();
    if (account.data) createdAccounts.push(account.data.id);
    const contact = await tenantA.from("contacts").insert({ display_name: `${marker}-ana` }).select("id").single();
    expect(contact.error).toBeNull();
    if (contact.data) createdContacts.push(contact.data.id);

    const conversation = await tenantA
      .from("conversations")
      // El canal lo copia la base de datos de la cuenta (20261109230000); el tipo lo pide igual.
      .insert({ contact_id: contact.data?.id ?? "", channel_account_id: account.data?.id ?? "", agent_id: agent.data?.id ?? "", channel: "webchat" })
      .select("id")
      .single();
    expect(conversation.error).toBeNull();
    const message = await tenantA
      .from("messages")
      .insert({ conversation_id: conversation.data?.id ?? "", direction: "in", author: "contact", content: "Hola" })
      .select("id, organization_id")
      .single();
    expect(message.error).toBeNull();
    expect(message.data?.organization_id).toBe(ORG_A);

    const fromB = await service.forOrganization(ORG_B).from("messages").select("id").eq("id", message.data?.id ?? "");
    expect(fromB.error).toBeNull();
    expect(fromB.data).toEqual([]);
    const touched = await tenantA.from("conversations").select("last_message_at").eq("id", conversation.data?.id ?? "").single();
    expect(touched.data?.last_message_at).not.toBeNull();
  });
});
