import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { join } from "node:path";
import { hmacSha256Hex } from "@repo/channels";
import { fakeSignature } from "@repo/channels/testing";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliveryWorkflowId } from "../events/outbox.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { ingestWorkflowId } from "./ingest.ts";
import { MAX_INBOUND_PAYLOAD_BYTES } from "./receive.ts";

// La entrada de canales de punta a punta (ADR 0052 §2, O-01): un webhook firmado
// llega al worker de verdad (HTTP, DBOS y Supabase local) y se convierte en un
// mensaje de su conversación, una sola vez aunque el proveedor lo repita. Los
// datos viven en cuentas de canal temporales de Demo A que se borran al terminar.
const fixture = join(import.meta.dirname, "..", "testing", "ingress-worker.ts");
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const marker = `ingress-${randomUUID().slice(0, 8)}`;
const secret = `secreto-${randomUUID()}`;
// WhatsApp: el phone_number_id de la cuenta y el número del cliente, al azar para no chocar entre corridas.
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const waPhoneNumberId = `9${digits(14)}`;
const waFrom = `34${digits(9)}`;
const ids: Record<string, string> = {};
let child: ChildProcess | null = null;
let output = "";
let base = "";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function waitFor(condition: () => Promise<boolean>, what: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function one(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`sin id: ${sql}`);
  return id;
}

function inbound(overrides: Record<string, unknown> = {}) {
  return {
    channel: "webchat",
    accountExternalId: `${marker}-active`,
    providerEventId: `evt-${randomUUID()}`,
    providerMessageId: `msg-${randomUUID()}`,
    from: { kind: "webchat", value: `${marker}-visitor` },
    displayName: "Visitante",
    receivedAt: new Date().toISOString(),
    text: "Hola, ¿abrís el sábado?",
    ...overrides,
  };
}

/** Firmado como el token del chat web: para la cuenta del primer mensaje, salvo que se diga otra. */
async function post(body: { messages: { accountExternalId: string }[] }, signWith = secret, signedAccount?: string) {
  const rawBody = JSON.stringify(body);
  const account = signedAccount ?? body.messages[0]?.accountExternalId ?? "";
  const response = await fetch(`${base}/channels/webchat/webhook`, { method: "POST", body: rawBody, headers: fakeSignature(signWith, rawBody, account) });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, number> | null };
}

async function eventsOf(providerEventId: string) {
  const { rows } = await admin.query<{
    id: string;
    status: string;
    organization_id: string;
    conversation_id: string | null;
    message_id: string | null;
    attempts: number;
    error_code: string | null;
  }>(
    "select id, status, organization_id, conversation_id, message_id, attempts, error_code from public.inbound_events where provider_event_id = $1",
    [providerEventId],
  );
  return rows;
}

async function messagesFrom(providerMessageId: string) {
  const { rows } = await admin.query<{ id: string; conversation_id: string; organization_id: string; content: string; direction: string; author: string }>(
    "select id, conversation_id, organization_id, content, direction, author from public.messages where external_message_id = $1",
    [providerMessageId],
  );
  return rows;
}

async function workflowStatus(workflowId: string): Promise<string | undefined> {
  const { rows } = await admin.query<{ status: string }>("select status from dbos.workflow_status where workflow_uuid = $1", [workflowId]);
  return rows[0]?.status;
}

beforeAll(async () => {
  await admin.connect();
  ids.org = await one("select id from public.organizations where name = 'Demo A'", []);
  ids.location = await one("select id from public.locations where organization_id = $1 order by created_at limit 1", [ids.org]);
  ids.agentType = await one(
    `select t.key as id from public.agents a join public.agent_types t on t.id = a.agent_type_id
     where a.organization_id = $1 order by t.key limit 1`,
    [ids.org],
  );
  ids.agent = await one(
    "select a.id from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.organization_id = $1 and t.key = $2",
    [ids.org, ids.agentType],
  );
  ids.active = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'webchat', $3, $4, 'active') returning id`,
    [ids.org, ids.location, `${marker}-active`, ids.agentType],
  );
  ids.disabled = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'webchat', $3, $4, 'disabled') returning id`,
    [ids.org, ids.location, `${marker}-disabled`, ids.agentType],
  );

  ids.whatsapp = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'whatsapp', $3, $4, 'active') returning id`,
    [ids.org, ids.location, waPhoneNumberId, ids.agentType],
  );

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const api = localSupabaseApi();
  child = spawn(process.execPath, [fixture], {
    env: {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-ingress",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
      PORT: String(port),
      INGRESS_TEST_SECRET: secret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  await waitFor(async () => output.includes("entrada de canales abierta") && output.includes("worker arrancado"), "la entrada de canales se abre", 60_000);
}, 90_000);

afterAll(async () => {
  child?.kill("SIGKILL");
  // Las conversaciones (y sus mensajes) y los contactos que creó la entrada, y las cuentas.
  await admin.query(
    "delete from public.domain_events where payload->>'conversation_id' in (select id::text from public.conversations where channel_account_id = any($1))",
    [[ids.active, ids.disabled, ids.whatsapp]],
  );
  await admin.query("delete from public.conversations where channel_account_id = any($1)", [[ids.active, ids.disabled, ids.whatsapp]]);
  await admin.query("delete from public.contacts where id in (select contact_id from public.contact_identities where external_id like $1)", [`${marker}-%`]);
  await admin.query("delete from public.contacts where id in (select contact_id from public.contact_identities where kind = 'phone' and external_id = $1)", [`+${waFrom}`]);
  await admin.query("delete from public.channel_accounts where id = any($1)", [[ids.active, ids.disabled, ids.whatsapp]]);
  await admin.end();
});

describe("la entrada de canales de punta a punta (ADR 0052 §2)", () => {
  it("comparte el puerto con /health, que sigue respondiendo solo {status}", async () => {
    const response = await fetch(`${base}/health`);
    expect(Object.keys((await response.json()) as object)).toEqual(["status"]);
    // Un canal sin adaptador montado (WhatsApp ya lo tiene: ver más abajo).
    expect((await fetch(`${base}/channels/telegram/webhook`, { method: "POST", body: "{}" })).status).toBe(404);
  });

  it("un webhook firmado se convierte en un mensaje del cliente en una conversación nueva, de la organización de la cuenta", async () => {
    const message = inbound();
    await expect(post({ messages: [message] })).resolves.toEqual({ status: 200, body: { accepted: 1, duplicates: 0, ignored: 0 } });
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.status === "processed", "el evento queda procesado");
    const [event] = await eventsOf(message.providerEventId);
    const messages = await messagesFrom(message.providerMessageId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ organization_id: ids.org, content: message.text, direction: "in", author: "contact" });
    expect(event).toMatchObject({ organization_id: ids.org, conversation_id: messages[0]?.conversation_id, message_id: messages[0]?.id });
    // La conversación: de esa cuenta, su local y el agente por defecto de la cuenta, con el contacto de esa identidad.
    const { rows } = await admin.query<{ channel_account_id: string; location_id: string; agent_id: string; mode: string; display_name: string; kind: string }>(
      `select c.channel_account_id, c.location_id, c.agent_id, c.mode, k.display_name, i.kind
       from public.conversations c join public.contacts k on k.id = c.contact_id
       join public.contact_identities i on i.contact_id = k.id
       where c.id = $1`,
      [messages[0]?.conversation_id],
    );
    expect(rows).toEqual([{ channel_account_id: ids.active, location_id: ids.location, agent_id: ids.agent, mode: "agent", display_name: "Visitante", kind: "webchat" }]);
    ids.conversation = messages[0]?.conversation_id ?? "";
    ids.firstEvent = message.providerEventId;
    ids.firstMessage = message.providerMessageId;
  });

  it("el turno arranca sin esperar al publicador: la entrega de message.received ya la encoló la entrada", async () => {
    const { rows } = await admin.query<{ id: string }>(
      "select id from public.domain_events where type = 'message.received' and payload->>'message_id' = (select id::text from public.messages where external_message_id = $1)",
      [ids.firstMessage],
    );
    const eventId = rows[0]?.id ?? "";
    await waitFor(async () => (await workflowStatus(deliveryWorkflowId(eventId, "log"))) === "SUCCESS", "la entrega llega al consumidor");
    // La encoló el workflow de la entrada (su hijo), no el publicador.
    const { rows: parents } = await admin.query<{ parent: string | null }>(
      `select o.child_workflow_id as parent from dbos.operation_outputs o
       where o.workflow_uuid = $1 and o.child_workflow_id = $2`,
      [ingestWorkflowId((await eventsOf(ids.firstEvent ?? ""))[0]?.id ?? ""), deliveryWorkflowId(eventId, "log")],
    );
    expect(parents).toHaveLength(1);
  });

  it("el mismo webhook repetido no crea nada nuevo: un evento, un mensaje", async () => {
    const message = inbound({ providerEventId: ids.firstEvent, providerMessageId: ids.firstMessage });
    await expect(post({ messages: [message] })).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 1, ignored: 0 } });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await eventsOf(ids.firstEvent ?? "")).toHaveLength(1);
    expect(await messagesFrom(ids.firstMessage ?? "")).toHaveLength(1);
  });

  it("el siguiente mensaje del mismo cliente va a la misma conversación", async () => {
    const message = inbound({ text: "¿Y el domingo?" });
    await expect(post({ messages: [message] })).resolves.toMatchObject({ status: 200 });
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.status === "processed", "el segundo queda procesado");
    expect((await messagesFrom(message.providerMessageId))[0]?.conversation_id).toBe(ids.conversation);
  });

  it("con la firma mal, 401 y no se guarda nada", async () => {
    const message = inbound();
    await expect(post({ messages: [message] }, "otro-secreto")).resolves.toMatchObject({ status: 401 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await eventsOf(message.providerEventId)).toEqual([]);
    expect(await messagesFrom(message.providerMessageId)).toEqual([]);
  });

  it("una firma para una cuenta no vale para un mensaje que nombra otra: no se guarda nada", async () => {
    // Firmado para la cuenta desactivada; el mensaje nombra la activa.
    const message = inbound();
    await expect(post({ messages: [message] }, secret, `${marker}-disabled`)).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 0, ignored: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await eventsOf(message.providerEventId)).toEqual([]);
    expect(await messagesFrom(message.providerMessageId)).toEqual([]);
  });

  it("para una cuenta desactivada o que no existe no se guarda nada", async () => {
    const disabled = inbound({ accountExternalId: `${marker}-disabled` });
    const unknown = inbound({ accountExternalId: `${marker}-no-existe` });
    await expect(post({ messages: [disabled] })).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 0, ignored: 1 } });
    await expect(post({ messages: [unknown] })).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 0, ignored: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await eventsOf(disabled.providerEventId)).toEqual([]);
    expect(await eventsOf(unknown.providerEventId)).toEqual([]);
  });

  it("un fallo pasajero se reintenta dentro del workflow: a la tercera, procesado, con sus intentos apuntados", async () => {
    const message = inbound({ providerEventId: `fail-twice-${randomUUID()}` });
    await expect(post({ messages: [message] })).resolves.toEqual({ status: 200, body: { accepted: 1, duplicates: 0, ignored: 0 } });
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.status === "processed", "se procesa al tercer intento");
    const [event] = await eventsOf(message.providerEventId);
    expect(event).toMatchObject({ attempts: 2, error_code: null });
    expect(await messagesFrom(message.providerMessageId)).toHaveLength(1);
    // El evento queda en processed dentro del workflow, antes de que DBOS lo
    // dé por terminado: hay que esperar a que pase de PENDING a SUCCESS.
    const workflowId = ingestWorkflowId(event?.id ?? "");
    await waitFor(async () => (await workflowStatus(workflowId)) !== "PENDING", "el workflow termina");
    expect(await workflowStatus(workflowId)).toBe("SUCCESS");
  });

  it("si falla siempre, se para en el tope: failed con dead_letter, sin mensaje, y un reintento del proveedor no lo relanza", async () => {
    const message = inbound({ providerEventId: `fail-always-${randomUUID()}` });
    await expect(post({ messages: [message] })).resolves.toMatchObject({ status: 200 });
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.error_code === "dead_letter", "acaba en dead_letter");
    const [event] = await eventsOf(message.providerEventId);
    expect(event).toMatchObject({ status: "failed", attempts: 5, message_id: null });
    expect(await messagesFrom(message.providerMessageId)).toEqual([]);
    await waitFor(async () => (await workflowStatus(ingestWorkflowId(event?.id ?? ""))) === "SUCCESS", "el workflow termina (con dead_letter)");
    await expect(post({ messages: [message] })).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 1, ignored: 0 } });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect((await eventsOf(message.providerEventId))[0]).toMatchObject({ status: "failed", attempts: 5, error_code: "dead_letter" });
  });

  it("sin id del mensaje en el proveedor, la clave sale del evento: un reintento no duplica el mensaje", async () => {
    const withoutId: Partial<ReturnType<typeof inbound>> & { providerEventId: string; accountExternalId: string } = inbound();
    delete withoutId.providerMessageId;
    await expect(post({ messages: [withoutId] })).resolves.toMatchObject({ status: 200 });
    await waitFor(async () => (await eventsOf(withoutId.providerEventId))[0]?.status === "processed", "se procesa sin id del mensaje");
    const key = `evt:${withoutId.providerEventId}`;
    expect(await messagesFrom(key)).toHaveLength(1);
    await expect(post({ messages: [withoutId] })).resolves.toMatchObject({ status: 200, body: { duplicates: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await messagesFrom(key)).toHaveLength(1);
  });

  it("un mensaje que no cabe en inbound_events se ignora con 200, y el resto del lote se guarda", async () => {
    const control = "\u0001".repeat(1024);
    const huge = inbound({
      text: control.repeat(9),
      attachments: Array.from({ length: 10 }, (_, index) => ({ kind: "image", providerRef: `ref-${index}`, caption: control })),
    });
    expect(Buffer.byteLength(JSON.stringify(huge), "utf8")).toBeGreaterThan(MAX_INBOUND_PAYLOAD_BYTES);
    const small = inbound();
    await expect(post({ messages: [huge, small] })).resolves.toEqual({ status: 200, body: { accepted: 1, duplicates: 0, ignored: 1 } });
    expect(await eventsOf(huge.providerEventId)).toEqual([]);
    await waitFor(async () => (await eventsOf(small.providerEventId))[0]?.status === "processed", "el pequeño se procesa");
  });

  it("el barrido vuelve a intentar un workflow que quedó en ERROR (lo rebobina desde donde falló): no duplica nada", async () => {
    const [event] = await eventsOf(ids.firstEvent ?? "");
    const workflowId = ingestWorkflowId(event?.id ?? "");
    await waitFor(async () => (await workflowStatus(workflowId)) !== "PENDING", "el workflow del primer evento termina");
    expect(await workflowStatus(workflowId)).toBe("SUCCESS");
    await admin.query("update dbos.workflow_status set status = 'ERROR' where workflow_uuid = $1", [workflowId]);
    // El barrido corre cada minuto (a los 23 s).
    await waitFor(async () => (await workflowStatus(workflowId)) === "SUCCESS", "el barrido lo reanuda", 75_000);
    expect(await messagesFrom(ids.firstMessage ?? "")).toHaveLength(1);
    expect(output).toContain("eventos de entrada parados, vueltos a intentar");
  }, 90_000);

  it("si el apunte de un intento falla con intentos ya apuntados, se rebobina desde ese apunte (no desde el intento 1): sigue la cuenta y acaba procesado", async () => {
    const message = inbound({ providerEventId: `fail-record-${randomUUID()}` });
    await expect(post({ messages: [message] })).resolves.toMatchObject({ status: 200 });
    // Intentos 1 y 2 apuntados; el apunte del 3 falla y el workflow queda en ERROR; el barrido lo rebobina.
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.status === "processed", "acaba procesado tras rebobinar", 100_000);
    const [event] = await eventsOf(message.providerEventId);
    expect(event).toMatchObject({ attempts: 3, error_code: null });
    expect(await messagesFrom(message.providerMessageId)).toHaveLength(1);
    const workflowId = ingestWorkflowId(event?.id ?? "");
    await waitFor(async () => (await workflowStatus(workflowId)) !== "PENDING", "el workflow termina tras rebobinar");
    expect(await workflowStatus(workflowId)).toBe("SUCCESS");
  }, 120_000);

  it("y si sigue fallando después de rebobinar, la cuenta sigue hasta el tope: dead_letter con 5 intentos y un solo rebobinado", async () => {
    const message = inbound({ providerEventId: `fail-recdead-${randomUUID()}` });
    await expect(post({ messages: [message] })).resolves.toMatchObject({ status: 200 });
    await waitFor(async () => (await eventsOf(message.providerEventId))[0]?.error_code === "dead_letter", "acaba en dead_letter tras rebobinar", 100_000);
    const [event] = await eventsOf(message.providerEventId);
    expect(event).toMatchObject({ status: "failed", attempts: 5, message_id: null });
    const workflowId = ingestWorkflowId(event?.id ?? "");
    await waitFor(async () => (await workflowStatus(workflowId)) === "SUCCESS", "el workflow termina (con dead_letter)");
    // Un barrido más, para ver que no lo vuelve a rebobinar.
    await new Promise((resolve) => setTimeout(resolve, 65_000));
    const rewinds = output.split("\n").filter((line) => line.includes("rebobinado") && line.includes(workflowId));
    expect(rewinds).toHaveLength(1);
    expect(await workflowStatus(workflowId)).toBe("SUCCESS");
  }, 200_000);
});

// WhatsApp por la Cloud API (O-01, ADR 0020): el adaptador de verdad, con
// webhooks como los de Meta firmados con el secreto de la app.
describe("la entrada de WhatsApp de punta a punta (O-01)", () => {
  function metaText(wamid: string, body: string, phoneNumberId = waPhoneNumberId) {
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "102290129340398",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "34910000000", phone_number_id: phoneNumberId },
                contacts: [{ profile: { name: "Ana" }, wa_id: waFrom }],
                messages: [{ from: waFrom, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
              },
            },
          ],
        },
      ],
    };
  }

  async function postMeta(body: unknown, signWith = secret) {
    const rawBody = JSON.stringify(body);
    const response = await fetch(`${base}/channels/whatsapp/webhook`, {
      method: "POST",
      body: rawBody,
      headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${hmacSha256Hex(signWith, rawBody)}` },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, number> | null };
  }

  it("el alta: con el token exacto, el challenge en texto; con otro, 403 sin cuerpo", async () => {
    const good = await fetch(`${base}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(secret)}&hub.challenge=1158201444`);
    expect(good.status).toBe(200);
    expect(await good.text()).toBe("1158201444");
    const bad = await fetch(`${base}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(`${secret}x`)}&hub.challenge=1158201444`);
    expect(bad.status).toBe(403);
    expect(await bad.text()).toBe("");
  });

  it("un texto firmado por Meta: un mensaje del cliente en la cuenta de ese phone_number_id, con el wamid como clave; repetido, no duplica", async () => {
    const wamid = `wamid.${randomUUID()}`;
    await expect(postMeta(metaText(wamid, "Hola, ¿tenéis hueco el sábado?"))).resolves.toEqual({ status: 200, body: { accepted: 1, duplicates: 0, ignored: 0 } });
    await waitFor(async () => (await eventsOf(wamid))[0]?.status === "processed", "el mensaje de WhatsApp queda procesado");
    const messages = await messagesFrom(wamid);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ organization_id: ids.org, content: "Hola, ¿tenéis hueco el sábado?", direction: "in", author: "contact" });
    const { rows } = await admin.query<{ channel_account_id: string; channel: string; display_name: string; kind: string; external_id: string }>(
      `select c.channel_account_id, c.channel, k.display_name, i.kind, i.external_id
       from public.conversations c join public.contacts k on k.id = c.contact_id
       join public.contact_identities i on i.contact_id = k.id
       where c.id = $1`,
      [messages[0]?.conversation_id],
    );
    expect(rows).toEqual([{ channel_account_id: ids.whatsapp, channel: "whatsapp", display_name: "Ana", kind: "phone", external_id: `+${waFrom}` }]);
    // Meta repite el webhook: el mismo wamid no crea nada nuevo.
    await expect(postMeta(metaText(wamid, "Hola, ¿tenéis hueco el sábado?"))).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 1, ignored: 0 } });
    expect(await eventsOf(wamid)).toHaveLength(1);
    expect(await messagesFrom(wamid)).toHaveLength(1);
  });

  function metaStatuses(statuses: Record<string, unknown>[], phoneNumberId = waPhoneNumberId) {
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "102290129340398",
          changes: [
            {
              field: "messages",
              value: { messaging_product: "whatsapp", metadata: { display_phone_number: "34910000000", phone_number_id: phoneNumberId }, statuses },
            },
          ],
        },
      ],
    };
  }

  async function deliveryOf(wamid: string) {
    const { rows } = await admin.query<{ status: string; delivery_error: string | null }>(
      "select status, delivery_error from public.messages where external_message_id = $1",
      [wamid],
    );
    return rows;
  }

  it("los avisos de estado de Meta se aplican a lo que salió: solo avanzan, un fallo lleva su código y no se aplican a lo que entra", async () => {
    // Una conversación de WhatsApp de verdad (la abre un mensaje del cliente) y dos respuestas que ya salieron.
    const inboundWamid = `wamid.${randomUUID()}`;
    await postMeta(metaText(inboundWamid, "¿Abrís el lunes?"));
    await waitFor(async () => (await eventsOf(inboundWamid))[0]?.status === "processed", "el mensaje del cliente queda procesado");
    const [incoming] = await messagesFrom(inboundWamid);
    const read = `wamid.${randomUUID()}`;
    const failed = `wamid.${randomUUID()}`;
    for (const wamid of [read, failed]) {
      await admin.query(
        `insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
         values ($1, $2, 'out', 'agent', 'Sí, de 10 a 20 h.', 'sent', $3)`,
        [ids.org, incoming?.conversation_id, wamid],
      );
    }
    const at = String(Math.floor(Date.now() / 1000));
    const status = (id: string, value: string, extra: Record<string, unknown> = {}) => ({ id, status: value, timestamp: at, recipient_id: waFrom, ...extra });

    await expect(postMeta(metaStatuses([status(read, "delivered"), status(read, "read")]))).resolves.toMatchObject({ status: 200 });
    expect(await deliveryOf(read)).toEqual([{ status: "read", delivery_error: null }]);
    // Tarde y desordenado: un «entregado» o un «fallido» después de leído no cambian nada.
    await postMeta(metaStatuses([status(read, "delivered"), status(read, "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] })]));
    expect(await deliveryOf(read)).toEqual([{ status: "read", delivery_error: null }]);

    await postMeta(metaStatuses([status(failed, "failed", { errors: [{ code: 131047, title: "Re-engagement message" }] })]));
    // Solo el código, nunca el título de Meta.
    expect(await deliveryOf(failed)).toEqual([{ status: "failed", delivery_error: "whatsapp:131047" }]);

    // Un aviso con el wamid de lo que entró no lo toca; uno de un wamid que no existe, o de otro número, se confirma sin más.
    await expect(postMeta(metaStatuses([status(inboundWamid, "read"), status(`wamid.${randomUUID()}`, "read")]))).resolves.toMatchObject({ status: 200 });
    await expect(postMeta(metaStatuses([status(read, "read")], `8${digits(14)}`))).resolves.toMatchObject({ status: 200 });
    expect(await deliveryOf(inboundWamid)).toEqual([{ status: "received", delivery_error: null }]);
  });

  it("un aviso de estado con la firma de otro secreto: 401 y no cambia nada", async () => {
    const inboundWamid = `wamid.${randomUUID()}`;
    await postMeta(metaText(inboundWamid, "Hola"));
    await waitFor(async () => (await eventsOf(inboundWamid))[0]?.status === "processed", "el mensaje del cliente queda procesado");
    const [incoming] = await messagesFrom(inboundWamid);
    const wamid = `wamid.${randomUUID()}`;
    await admin.query(
      `insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
       values ($1, $2, 'out', 'agent', 'Hola', 'sent', $3)`,
      [ids.org, incoming?.conversation_id, wamid],
    );
    const at = String(Math.floor(Date.now() / 1000));
    await expect(postMeta(metaStatuses([{ id: wamid, status: "read", timestamp: at, recipient_id: waFrom }]), "otro-secreto")).resolves.toMatchObject({ status: 401 });
    expect(await deliveryOf(wamid)).toEqual([{ status: "sent", delivery_error: null }]);
  });

  it("con la firma de otro secreto, 401 y no se guarda nada; para un número sin cuenta, 200 e ignorado", async () => {
    const forged = `wamid.${randomUUID()}`;
    await expect(postMeta(metaText(forged, "hola"), "otro-secreto")).resolves.toMatchObject({ status: 401 });
    const unknown = `wamid.${randomUUID()}`;
    await expect(postMeta(metaText(unknown, "hola", `8${digits(14)}`))).resolves.toEqual({ status: 200, body: { accepted: 0, duplicates: 0, ignored: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await eventsOf(forged)).toEqual([]);
    expect(await eventsOf(unknown)).toEqual([]);
  });
});
