import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer } from "node:net";
import { join } from "node:path";
import { hmacSha256Hex } from "@repo/channels";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";

// Gate M1 de punta a punta (O-01): un mensaje de WhatsApp recibe UNA respuesta,
// aunque llegue otro a mitad del turno. El worker de verdad (ingress +
// agent.converse con el modelo falso + channels.send) contra una Graph API
// falsa. Los datos viven en una organización de demo con cuentas temporales.
const fixture = join(import.meta.dirname, "..", "testing", "one-reply-worker.ts");
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const secret = `secreto-${randomUUID()}`;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const waPhoneNumberId = `9${digits(14)}`;
const waFrom = `34${digits(9)}`;
const ids: Record<string, string> = {};
let child: ChildProcess | null = null;
let output = "";
let base = "";
let effectsFile = "";
const graphRequests: { body: Record<string, unknown> }[] = [];
let graph: Server | null = null;

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

function metaText(wamid: string, body: string) {
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
              metadata: { display_phone_number: "34910000000", phone_number_id: waPhoneNumberId },
              contacts: [{ profile: { name: "Ana" }, wa_id: waFrom }],
              messages: [{ from: waFrom, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

async function postMeta(body: unknown): Promise<{ status: number }> {
  const rawBody = JSON.stringify(body);
  const response = await fetch(`${base}/channels/whatsapp/webhook`, {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${hmacSha256Hex(secret, rawBody)}` },
  });
  return { status: response.status };
}

/** Manda un texto del cliente por WhatsApp y devuelve el id del mensaje ya guardado. */
async function customerSays(body: string): Promise<string> {
  const wamid = `wamid.${randomUUID()}`;
  await postMeta(metaText(wamid, body));
  await waitFor(async () => (await messageByWamid(wamid)) !== null, `se guarda «${body}»`);
  const id = await messageByWamid(wamid);
  if (!id) throw new Error("sin mensaje");
  return id;
}

async function messageByWamid(wamid: string): Promise<string | null> {
  const { rows } = await admin.query<{ id: string }>("select id from public.messages where external_message_id = $1", [wamid]);
  return rows[0]?.id ?? null;
}

async function conversationId(): Promise<string> {
  if (ids.conversation) return ids.conversation;
  const { rows } = await admin.query<{ id: string }>("select id from public.conversations where channel_account_id = $1", [ids.whatsapp]);
  if (rows[0]) ids.conversation = rows[0].id;
  return ids.conversation ?? "";
}

async function agentReplies(): Promise<{ id: string; status: string; external_message_id: string | null }[]> {
  const { rows } = await admin.query<{ id: string; status: string; external_message_id: string | null }>(
    "select id, status, external_message_id from public.messages where conversation_id = $1 and author = 'agent' order by created_at",
    [await conversationId()],
  );
  return rows;
}

async function sentReplies(): Promise<number> {
  return (await agentReplies()).filter((reply) => reply.status === "sent").length;
}

async function pendingApprovals(): Promise<number> {
  const { rows } = await admin.query<{ n: string }>(
    `select count(*)::int as n from public.approvals a
     join public.executions e on e.id = a.execution_id
     where e.run_id in (select id from public.agent_runs where agent_id = $1) and a.status = 'pending'`,
    [ids.agent],
  );
  return Number(rows[0]?.n ?? 0);
}

function gateCount(): number {
  if (!existsSync(effectsFile)) return 0;
  return readFileSync(effectsFile, "utf8").split("\n").filter((line) => line.includes('"step":"gate"')).length;
}

beforeAll(async () => {
  await admin.connect();
  ids.org = await one("select id from public.organizations where name = 'Demo A'", []);
  ids.location = await one("select id from public.locations where organization_id = $1 order by created_at limit 1", [ids.org]);
  // Un agente de la organización que tiene la skill de responder (sin escribir
  // la clave de su tipo en el código, ADR 0030 §1): su tipo sale de la fila.
  ids.agent = await one(
    `select a.id from public.agents a
     where a.organization_id = $1
       and exists (select 1 from public.agent_skills g join public.skills s on s.id = g.skill_id
                   where g.agent_id = a.id and s.key = 'reply' and g.enabled)
     order by a.created_at limit 1`,
    [ids.org],
  );
  ids.agentType = await one(
    "select t.key as id from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.id = $1",
    [ids.agent],
  );
  // El agente contesta (live) y su respuesta sale sola (autonomous), para que llegue a la Graph API.
  await admin.query("update public.agents set status = 'live' where id = $1", [ids.agent]);
  await admin.query(
    `update public.agent_skills g set autonomy_level = 'autonomous'
     from public.skills s where g.skill_id = s.id and g.agent_id = $1 and s.key = 'reply'`,
    [ids.agent],
  );
  ids.whatsapp = await one(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'whatsapp', $3, $4, 'active') returning id`,
    [ids.org, ids.location, waPhoneNumberId, ids.agentType],
  );

  graph = createHttpServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    request.on("end", () => {
      graphRequests.push({ body: JSON.parse(raw) as Record<string, unknown> });
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.out-${randomUUID()}` }] }));
    });
  });
  await new Promise<void>((resolve) => graph?.listen(0, "127.0.0.1", resolve));
  const graphAddress = graph.address();
  const graphUrl = `http://127.0.0.1:${typeof graphAddress === "object" && graphAddress ? graphAddress.port : 0}`;

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  effectsFile = join(process.env["TMPDIR"] ?? "/tmp", `one-reply-${randomUUID()}.jsonl`);
  const api = localSupabaseApi();
  child = spawn(process.execPath, [fixture, effectsFile], {
    env: {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-one-reply",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
      PORT: String(port),
      INGRESS_TEST_SECRET: secret,
      WHATSAPP_TEST_GRAPH_URL: graphUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  await waitFor(async () => output.includes("entrada de canales abierta") && output.includes("worker arrancado"), "el worker arranca", 60_000);
}, 90_000);

afterAll(async () => {
  child?.kill("SIGKILL");
  await new Promise<void>((resolve) => (graph ? graph.close(() => resolve()) : resolve()));
  // Los turnos de estas conversaciones (con sus ejecuciones y aprobaciones, en
  // cascada): una aprobación pendiente del caso en borrador se vería en la
  // bandeja de aprobaciones del e2e, que comparte la base de datos.
  const runs = `select r.id from public.agent_runs r
                where r.trigger_ref in (select m.id::text from public.messages m
                                        join public.conversations c on c.id = m.conversation_id
                                        where c.channel_account_id = $1)`;
  await admin.query(`delete from public.domain_events where payload->>'run_id' in (select id::text from (${runs}) x)`, [ids.whatsapp]);
  await admin.query(`delete from public.agent_runs where id in (${runs})`, [ids.whatsapp]);
  await admin.query(
    "delete from public.domain_events where payload->>'conversation_id' in (select id::text from public.conversations where channel_account_id = $1)",
    [ids.whatsapp],
  );
  await admin.query("delete from public.conversations where channel_account_id = $1", [ids.whatsapp]);
  await admin.query("delete from public.contacts where id in (select contact_id from public.contact_identities where kind = 'phone' and external_id = $1)", [`+${waFrom}`]);
  await admin.query("delete from public.channel_accounts where id = $1", [ids.whatsapp]);
  await admin.query("update public.agents set status = 'draft' where id = $1", [ids.agent]);
  await admin.end();
});

describe("gate M1: una sola respuesta por mensaje de WhatsApp", () => {
  it("un mensaje, una respuesta: un POST a la Graph API, el mensaje del agente sent con su wamid", async () => {
    const m1 = await customerSays("Hola, ¿qué tal?");
    await waitFor(async () => (await agentReplies()).some((reply) => reply.status === "sent"), "la respuesta sale");
    const replies = await agentReplies();
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ status: "sent" });
    expect(replies[0]?.external_message_id).toMatch(/^wamid\.out-/);
    expect(graphRequests).toHaveLength(1);
    expect(graphRequests[0]?.body).toMatchObject({ to: waFrom, type: "text" });
    // El run del mensaje queda completado.
    const { rows } = await admin.query<{ status: string }>("select status from public.agent_runs where trigger_ref = $1", [m1]);
    expect(rows[0]?.status).toBe("completed");
  });

  it("si llega un segundo mensaje a mitad del turno, sale UNA respuesta (la del segundo) y el primer turno queda superseded", async () => {
    graphRequests.length = 0;
    const repliesBefore = (await agentReplies()).length;
    const gatesBefore = gateCount();
    // m1 deja al modelo pensando; mientras, llega m2.
    const m1 = await customerSays("Un momento, que te cuento");
    await waitFor(async () => gateCount() > gatesBefore, "el turno de m1 está pensando");
    const sentBefore = await sentReplies();
    const m2 = await customerSays("¿Tenéis hueco el sábado?");
    // m2 no está gated: su turno contesta y la envía.
    await waitFor(async () => (await sentReplies()) > sentBefore, "el turno de m2 envía su respuesta");
    // Soltar m1: su respuesta ya no toca (m2 es el último), no se envía.
    writeFileSync(`${effectsFile}.gate`, "");
    await waitFor(async () => {
      const r1 = await admin.query<{ status: string }>("select status from public.agent_runs where trigger_ref = $1", [m1]);
      return r1.rows[0]?.status !== undefined && r1.rows[0]?.status !== "running";
    }, "el turno de m1 termina");
    // Un momento para que, si m1 fuera a enviar algo (no debería), llegara a la Graph API.
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const newReplies = (await agentReplies()).slice(repliesBefore);
    expect(newReplies).toHaveLength(1);
    expect(newReplies[0]).toMatchObject({ status: "sent" });
    expect(graphRequests).toHaveLength(1);
    const r1 = await admin.query<{ status: string }>("select status from public.agent_runs where trigger_ref = $1", [m1]);
    const r2 = await admin.query<{ status: string }>("select status from public.agent_runs where trigger_ref = $1", [m2]);
    // m1 acabó su parte sin responder (no pasó la conversación a nadie); m2 completó.
    expect(r1.rows[0]?.status).toBe("completed");
    expect(r2.rows[0]?.status).toBe("completed");
    // La conversación sigue con el agente.
    const conv = await admin.query<{ mode: string }>("select mode from public.conversations where id = $1", [await conversationId()]);
    expect(conv.rows[0]?.mode).toBe("agent");
  });

  it("un segundo mensaje que llega DESPUÉS de enviada la respuesta sí tiene la suya (dos POST en total)", async () => {
    graphRequests.length = 0;
    const sentBefore = await sentReplies();
    await customerSays("Primera pregunta");
    await waitFor(async () => (await sentReplies()) === sentBefore + 1, "la primera respuesta sale");
    await customerSays("Segunda pregunta");
    await waitFor(async () => (await sentReplies()) === sentBefore + 2, "la segunda respuesta sale");
    expect(graphRequests).toHaveLength(2);
  });

  it("en borrador, un turno superseded no deja una respuesta pendiente en la bandeja: queda una sola aprobación", async () => {
    await admin.query(
      `update public.agent_skills g set autonomy_level = 'draft'
       from public.skills s where g.skill_id = s.id and g.agent_id = $1 and s.key = 'reply'`,
      [ids.agent],
    );
    try {
      const pendingBefore = await pendingApprovals();
      const sentBefore = await sentReplies();
      const gatesBefore = gateCount();
      await customerSays("Un momento, lo miro");
      await waitFor(async () => gateCount() > gatesBefore, "el turno de m1 está pensando");
      const m2 = await customerSays("¿Me lo confirmas?");
      await waitFor(async () => (await pendingApprovals()) === pendingBefore + 1, "la aprobación de m2 está pendiente");
      writeFileSync(`${effectsFile}.gate`, "");
      await waitFor(async () => {
        const r2 = await admin.query<{ status: string }>("select status from public.agent_runs where trigger_ref = $1", [m2]);
        return r2.rows[0]?.status === "awaiting_approval";
      }, "el turno de m2 queda esperando aprobación");
      // Exactamente una respuesta pendiente: la de m2. El borrador de m1, si existió, caducó.
      expect(await pendingApprovals()).toBe(pendingBefore + 1);
      // Nada salió a la Graph API: en borrador no se envía.
      expect(await sentReplies()).toBe(sentBefore);
    } finally {
      await admin.query(
        `update public.agent_skills g set autonomy_level = 'autonomous'
         from public.skills s where g.skill_id = s.id and g.agent_id = $1 and s.key = 'reply'`,
        [ids.agent],
      );
    }
  });
});
