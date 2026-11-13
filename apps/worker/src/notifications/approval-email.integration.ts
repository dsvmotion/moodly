import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliveryWorkflowId } from "../events/outbox.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { APPROVAL_EMAIL_HANDLER_KEY, EMAIL_UNAUTHORIZED_EVENT } from "./approval-email.ts";
import { BUDGET_EMAIL_HANDLER_KEY } from "./budget-email.ts";
import { HANDOFF_EMAIL_HANDLER_KEY } from "./handoff-email.ts";

// M-02: de una aprobación nueva al email, pasando por approval.created en el
// outbox, el publicador y el consumidor notify.approval_email, con el cliente de
// Resend de verdad contra un servidor falso. Se avisa exactamente a quien puede
// decidir cada aprobación (de la base de datos), una vez por persona aunque
// Resend falle varias veces seguidas, y a nadie de otro local fuera de su
// alcance ni de otra organización. Un 401 no se reintenta ni se intenta con
// nadie más, y deja su evento de seguridad.
const fixture = join(import.meta.dirname, "..", "testing", "approval-email-worker.ts");
const children = new Set<ChildProcess>();
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const marker = `m02-${randomUUID().slice(0, 8)}`;
const api = localSupabaseApi();
// Se arma en tiempo de ejecución: un literal con forma de clave lo marcaría gitleaks.
const RESEND_KEY = `re_${"t".repeat(24)}`;
const WEB = "http://127.0.0.1:3000";

interface Received {
  headers: IncomingHttpHeaders;
  body: { from: string; to: string[]; subject: string; html: string; text: string };
}
const received: Received[] = [];
/** Las peticiones cuya clave de idempotencia acaba así reciben un 503 tantas veces: el worker las reintenta. */
const failTimes = new Map<string, number>();
/** Las peticiones para estas personas (sufijo de la clave) reciben un 401: la clave de Resend no vale. */
const unauthorizedSuffixes = new Set<string>();
/** Cuántas veces devolvió 503 el servidor falso. */
let served503 = 0;
let server: Server;
let resendUrl = "";

const ids = {
  orgX: randomUUID(),
  orgY: randomUUID(),
  orgZ: randomUUID(),
  regionN: randomUUID(),
  regionS: randomUUID(),
  regionY: randomUUID(),
  regionZ: randomUUID(),
  locX1: randomUUID(),
  locX2: randomUUID(),
  locX3: randomUUID(),
  locY1: randomUUID(),
  locZ1: randomUUID(),
};
// Quién es quién: [clave, organización, rol, regiones, locales].
const people = {
  xAdmin: ["orgX", "org_admin", [], []],
  xRegionN: ["orgX", "region_manager", ["regionN"], []],
  xRegionS: ["orgX", "region_manager", ["regionS"], []],
  xManager1: ["orgX", "location_manager", [], ["locX1"]],
  xStaff1: ["orgX", "staff", [], ["locX1"]],
  xStaff2: ["orgX", "staff", [], ["locX2"]],
  xStaff3: ["orgX", "staff", [], ["locX3"]],
  yAdmin: ["orgY", "org_admin", [], []],
  yStaff1: ["orgY", "staff", [], ["locY1"]],
  zAdmin: ["orgZ", "org_admin", [], []],
  zStaff1: ["orgZ", "staff", [], ["locZ1"]],
} as const satisfies Record<string, readonly [keyof typeof ids, string, readonly (keyof typeof ids)[], readonly (keyof typeof ids)[]]>;
type Person = keyof typeof people;
const userIds = Object.fromEntries(Object.keys(people).map((key) => [key, randomUUID()])) as Record<Person, string>;
const emailOf = (person: Person) => `${marker}-${person.toLowerCase()}@demo.test`;

function startWorker(env: NodeJS.ProcessEnv): { child: ChildProcess; output(): string; exited: Promise<number | null> } {
  const child = spawn(process.execPath, [fixture], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => {
    child.on("close", (code) => {
      children.delete(child);
      resolve(code);
    });
  });
  return { child, output: () => output, exited };
}

async function waitFor(condition: () => boolean | Promise<boolean>, what: string, output: () => string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      const key = String(req.headers["idempotency-key"] ?? "");
      received.push({ headers: req.headers, body: JSON.parse(raw) as Received["body"] });
      res.setHeader("content-type", "application/json");
      if (req.method !== "POST" || req.url !== "/emails") {
        res.statusCode = 404;
        res.end(JSON.stringify({ name: "not_found" }));
      } else if ([...unauthorizedSuffixes].some((suffix) => key.endsWith(suffix))) {
        res.statusCode = 401;
        res.end(JSON.stringify({ name: "missing_api_key" }));
      } else if ([...failTimes].some(([suffix, left]) => key.endsWith(suffix) && left > 0)) {
        const [suffix, left] = [...failTimes].find(([s, n]) => key.endsWith(s) && n > 0) as [string, number];
        failTimes.set(suffix, left - 1);
        served503 += 1;
        res.statusCode = 503;
        res.end(JSON.stringify({ name: "application_error" }));
      } else {
        res.end(JSON.stringify({ id: randomUUID() }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  resendUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await admin.connect();
  // Las aprobaciones del seed también dejaron su approval.created: no son de este
  // test, y el worker tardaría en llegar a las suyas detrás de ellas.
  await admin.query("update public.domain_events set published_at = now() where type = 'approval.created' and published_at is null");
  await admin.query("begin");
  await admin.query("insert into public.organizations (id, name) values ($1, $2), ($3, $4), ($5, $6)", [
    ids.orgX,
    `${marker} X`,
    ids.orgY,
    `${marker} Y`,
    ids.orgZ,
    `${marker} Z`,
  ]);
  await admin.query("insert into public.regions (id, organization_id, name) values ($1, $2, 'Norte'), ($3, $2, 'Sur'), ($4, $5, 'Centro'), ($6, $7, 'Este')", [
    ids.regionN,
    ids.orgX,
    ids.regionS,
    ids.regionY,
    ids.orgY,
    ids.regionZ,
    ids.orgZ,
  ]);
  await admin.query(
    `insert into public.locations (id, organization_id, region_id, name) values
       ($1, $2, $3, 'X1'), ($4, $2, $3, 'X2'), ($5, $2, $6, 'X3'), ($7, $8, $9, 'Y1'), ($10, $11, $12, 'Z1')`,
    [ids.locX1, ids.orgX, ids.regionN, ids.locX2, ids.locX3, ids.regionS, ids.locY1, ids.orgY, ids.regionY, ids.locZ1, ids.orgZ, ids.regionZ],
  );
  for (const [person, [org, role, regions, locations]] of Object.entries(people) as [Person, (typeof people)[Person]][]) {
    await admin.query(
      "insert into auth.users (id, email, aud, role, email_confirmed_at) values ($1, $2, 'authenticated', 'authenticated', now())",
      [userIds[person], emailOf(person)],
    );
    await admin.query("insert into public.users (id, full_name, locale) values ($1, $2, $3)", [userIds[person], person, person === "xStaff1" ? "en-GB" : "es-ES"]);
    await admin.query(
      "insert into public.memberships (user_id, organization_id, role, scope_region_ids, scope_location_ids) values ($1, $2, $3, $4::uuid[], $5::uuid[])",
      [userIds[person], ids[org], role, regions.map((r) => ids[r]), locations.map((l) => ids[l])],
    );
  }
  await admin.query("commit");
});

afterAll(async () => {
  for (const child of children) child.kill("SIGKILL");
  // La política de modelos de Y (el aviso del tope) dejó su fila en audit_logs, que no se borra en cascada:
  // el superusuario de la prueba la quita antes (para la plataforma es solo inserción).
  await admin.query("delete from public.audit_logs where organization_id = any($1::uuid[])", [[ids.orgX, ids.orgY, ids.orgZ]]);
  await admin.query("delete from public.organizations where id = any($1::uuid[])", [[ids.orgX, ids.orgY, ids.orgZ]]);
  await admin.query("delete from auth.users where id = any($1::uuid[])", [Object.values(userIds)]);
  await admin.end();
  await new Promise((resolve) => server.close(resolve));
});

/** Una aprobación nueva en un local (como el worker: run, ejecución y aprobación). Su trigger escribe approval.created. */
async function createApproval(org: string, location: string, requiredRole: string): Promise<string> {
  const { rows: agents } = await admin.query<{ id: string }>("select id from public.agents where organization_id = $1 order by id limit 1", [org]);
  const agent = agents[0]?.id;
  if (!agent) throw new Error("la organización no tiene agentes");
  const hash = "c".repeat(64);
  const { rows: runs } = await admin.query<{ id: string }>(
    "insert into public.agent_runs (organization_id, location_id, agent_id, trigger) values ($1, $2, $3, 'inbound_message') returning id",
    [org, location, agent],
  );
  const { rows: executions } = await admin.query<{ id: string }>(
    `insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class,
       autonomy_applied, input, target, input_hash, status, idempotency_key)
     values ($1, $2, $3, 'reply', 1, 'external_message', 'draft', '{}', '{"kind":"none"}', $4, 'needs_approval', $5) returning id`,
    [runs[0]?.id, org, location, hash, `${marker}-${randomUUID()}`],
  );
  const { rows: approvals } = await admin.query<{ id: string }>(
    `insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
     values ($1, $2, $3, 'external_message', $4, $5, 'Responder: «Tenemos hueco el lunes a las 9:00»', now() + interval '1 day') returning id`,
    [executions[0]?.id, org, location, hash, requiredRole],
  );
  return approvals[0]?.id as string;
}

const keysFor = (approvalId: string) => received.map((r) => String(r.headers["idempotency-key"])).filter((key) => key.startsWith(`approval:${approvalId}:`));

describe("aviso por email de las aprobaciones nuevas (M-02)", () => {
  it("cada persona que puede decidir recibe un email, una sola vez; nadie fuera de su alcance ni de otra organización", async () => {
    const worker = startWorker({
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-approval-email-${process.pid}`,
      WORKER_APP_VERSION: "test-approval-email",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
      RESEND_API_KEY: RESEND_KEY,
      WEB_APP_URL: WEB,
      FAKE_RESEND_URL: resendUrl,
    });

    // X1: Resend cae para el staff de X1 durante 6 intentos y luego vuelve. Y1: todo bien.
    // Z1: Resend rechaza la clave (401).
    failTimes.set(`:${userIds.xStaff1}`, 6);
    unauthorizedSuffixes.add(`:${userIds.zAdmin}`).add(`:${userIds.zStaff1}`);
    const inX1 = await createApproval(ids.orgX, ids.locX1, "staff");
    const inY1 = await createApproval(ids.orgY, ids.locY1, "staff");
    const inZ1 = await createApproval(ids.orgZ, ids.locZ1, "staff");

    const expectedX1: Person[] = ["xAdmin", "xRegionN", "xManager1", "xStaff1"];
    await waitFor(
      () => new Set(keysFor(inX1)).size === expectedX1.length && served503 === 6 && keysFor(inX1).length === expectedX1.length + 6,
      "los avisos de X1, con los 6 reintentos",
      worker.output,
    );
    const expectedY1: Person[] = ["yAdmin", "yStaff1"];
    await waitFor(() => new Set(keysFor(inY1)).size === expectedY1.length, "los avisos de Y1", worker.output);
    await waitFor(() => worker.output().includes(EMAIL_UNAUTHORIZED_EVENT), "el 401 de Z1, registrado", worker.output);
    // Margen para que un envío de más (o a quien no toca) llegara también.
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const forX1 = received.filter((r) => String(r.headers["idempotency-key"]).startsWith(`approval:${inX1}:`));
    const forY1 = received.filter((r) => String(r.headers["idempotency-key"]).startsWith(`approval:${inY1}:`));
    const forZ1 = received.filter((r) => String(r.headers["idempotency-key"]).startsWith(`approval:${inZ1}:`));
    // Exactamente a quien puede decidir; ni el region_manager del sur, ni el staff de X2 o X3, ni nadie de la otra organización.
    expect(new Set(forX1.map((r) => r.body.to[0]))).toEqual(new Set(expectedX1.map(emailOf)));
    // Una vez por persona: solo el que falló se repite (6 503 y el 200), siempre con la misma clave.
    expect(forX1).toHaveLength(expectedX1.length + 6);
    expect(keysFor(inX1).filter((key) => key === `approval:${inX1}:${userIds.xStaff1}`)).toHaveLength(7);
    for (const person of expectedX1) {
      expect(keysFor(inX1)).toContain(`approval:${inX1}:${userIds[person]}`);
    }
    // Y1: cada uno, una vez; nadie de las otras organizaciones.
    expect(forY1.map((r) => r.body.to[0]).sort()).toEqual(expectedY1.map(emailOf).sort());
    // Z1 con un 401: un solo intento, sin reintentos ni nadie más; nadie lo recibe.
    expect(forZ1).toHaveLength(1);
    expect([emailOf("zAdmin"), emailOf("zStaff1")]).toContain(forZ1[0]?.body.to[0]);
    const unauthorized = worker
      .output()
      .split("\n")
      .filter((line) => line.includes(EMAIL_UNAUTHORIZED_EVENT))
      .map((line) => JSON.parse(line) as { level: string; approvalId: string; skipped: number });
    expect(unauthorized).toEqual([expect.objectContaining({ level: "error", approvalId: inZ1, skipped: 2 })]);

    // La clave de Resend solo en su cabecera; el remitente, la dirección de avisos; el enlace, a la web con el local.
    for (const request of [...forX1, ...forY1]) {
      expect(request.headers.authorization).toBe(`Bearer ${RESEND_KEY}`);
      expect(request.body.from).toBe(`${BRAND_NAME} <${NOTIFICATION_EMAIL_FROM}>`);
    }
    const staff = forX1.find((r) => r.body.to[0] === emailOf("xStaff1"));
    expect(staff?.body.subject).toMatch(/is waiting for your approval/);
    expect(forX1.find((r) => r.body.to[0] === emailOf("xAdmin"))?.body.subject).toMatch(/espera tu aprobación/);
    expect(staff?.body.text).toContain(`${WEB}/app/approvals?scope=location%3A${ids.locX1}`);

    // Una sola entrega por evento, terminada y por la cola de avisos (no la de eventos de dominio).
    const { rows: events } = await admin.query<{ id: string }>(
      "select id from public.domain_events where type = 'approval.created' and payload->>'approval_id' = any($1::text[])",
      [[inX1, inY1, inZ1]],
    );
    expect(events).toHaveLength(3);
    const { rows } = await admin.query<{ status: string; queue_name: string }>(
      "select status, queue_name from dbos.workflow_status where workflow_uuid = any($1::text[])",
      [events.map((event) => deliveryWorkflowId(event.id, APPROVAL_EMAIL_HANDLER_KEY))],
    );
    expect(rows).toEqual([
      { status: "SUCCESS", queue_name: "notifications" },
      { status: "SUCCESS", queue_name: "notifications" },
      { status: "SUCCESS", queue_name: "notifications" },
    ]);
    // Ningún email en los logs del worker.
    expect(worker.output()).not.toContain("@demo.test");
    expect(worker.output()).not.toContain(RESEND_KEY);

    worker.child.kill("SIGTERM");
    expect(await worker.exited, worker.output()).toBe(0);
  });
});

describe("aviso por email del tope mensual (PL-ledger)", () => {
  it("al pasar el tope, solo los org_admin reciben el aviso, una sola vez aunque la comprobación se repita y Resend falle", async () => {
    const worker = startWorker({
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-budget-email-${process.pid}`,
      WORKER_APP_VERSION: "test-budget-email",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
      RESEND_API_KEY: RESEND_KEY,
      WEB_APP_URL: WEB,
      FAKE_RESEND_URL: resendUrl,
    });

    // Y: tope de 1 € al mes, ya gastado. Resend cae dos veces para su org_admin.
    await admin.query(
      "insert into public.org_model_settings (organization_id, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur) values ($1, 0.5, 1, 1)",
      [ids.orgY],
    );
    await admin.query(
      `insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
       values ($1, 'agent_turn', 'llm_tokens', 2, 1, 1, 1.25, 'fake', 'gateway', 'other', 'budget-test')`,
      [ids.orgY],
    );
    failTimes.set(`:100:${userIds.yAdmin}`, 2);
    const before = served503;

    // Como el worker tras cada turno, dos veces (un paso que se repite, dos turnos a la vez): un solo evento.
    const { rows: first } = await admin.query<{ notified: number[] }>("select public.check_budget_thresholds($1) as notified", [ids.orgY]);
    const { rows: second } = await admin.query<{ notified: number[] }>("select public.check_budget_thresholds($1) as notified", [ids.orgY]);
    expect([first[0]?.notified, second[0]?.notified]).toEqual([[100], []]);

    const month = (await admin.query<{ month: string }>("select to_char(date_trunc('month', now() at time zone 'UTC'), 'YYYY-MM-DD') as month")).rows[0]?.month;
    const key = `budget:${ids.orgY}:${month}:100:${userIds.yAdmin}`;
    const forBudget = () => received.filter((r) => String(r.headers["idempotency-key"]).startsWith(`budget:${ids.orgY}:`));
    await waitFor(() => forBudget().length === 3 && served503 === before + 2, "el aviso del tope, con los 2 reintentos", worker.output);
    // Margen para que un envío de más (o a quien no toca) llegara también.
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    // Solo el org_admin (no el staff), una sola clave: los dos 503 y el 200, siempre la misma.
    expect(forBudget().map((r) => String(r.headers["idempotency-key"]))).toEqual([key, key, key]);
    expect(new Set(forBudget().map((r) => r.body.to[0]))).toEqual(new Set([emailOf("yAdmin")]));
    const email = forBudget().at(-1);
    expect(email?.body.subject).toBe("Habéis llegado al tope mensual de IA");
    expect(email?.body.from).toBe(`${BRAND_NAME} <${NOTIFICATION_EMAIL_FROM}>`);
    expect(email?.body.text).toContain(`${marker} Y ha gastado este mes 1,25 € de los 1,00 € de tope mensual de IA.`);
    // El enlace, al inicio de la app: los ajustes de modelos aún no existen.
    expect(email?.body.text).toContain(`${WEB}/app\n`);
    expect(email?.body.text).not.toContain("/settings/");

    // Un solo evento, una sola entrega, terminada y por la cola de avisos.
    const { rows: events } = await admin.query<{ id: string }>(
      "select id from public.domain_events where organization_id = $1 and type = 'usage.budget_threshold'",
      [ids.orgY],
    );
    expect(events).toHaveLength(1);
    const { rows } = await admin.query<{ status: string; queue_name: string }>(
      "select status, queue_name from dbos.workflow_status where workflow_uuid = $1",
      [deliveryWorkflowId(events[0]?.id as string, BUDGET_EMAIL_HANDLER_KEY)],
    );
    expect(rows).toEqual([{ status: "SUCCESS", queue_name: "notifications" }]);
    expect(worker.output()).not.toContain("@demo.test");

    worker.child.kill("SIGTERM");
    expect(await worker.exited, worker.output()).toBe(0);
  });
});

/** Una conversación del agente en un local (o de toda la organización, con location null). */
async function createConversation(org: string, location: string | null): Promise<string> {
  // El tipo del agente, de la base de datos: ninguna clave de agente escrita en el código (ADR 0030 §1).
  const { rows: agents } = await admin.query<{ id: string; type_key: string }>(
    `select a.id, t.key as type_key from public.agents a join public.agent_types t on t.id = a.agent_type_id
     where a.organization_id = $1 order by a.id limit 1`,
    [org],
  );
  const { rows: contacts } = await admin.query<{ id: string }>(
    "insert into public.contacts (organization_id, display_name) values ($1, 'Ana') returning id",
    [org],
  );
  const { rows: accounts } = await admin.query<{ id: string }>(
    `insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
     values ($1, $2, 'whatsapp', $3, $4, 'active') returning id`,
    [org, location, `${marker}-${randomUUID()}`, agents[0]?.type_key],
  );
  const { rows } = await admin.query<{ id: string }>(
    `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
     values ($1, $2, $3, $4, $5) returning id`,
    [org, location, contacts[0]?.id, accounts[0]?.id, agents[0]?.id],
  );
  // Un mensaje del cliente con algo que no debe salir en el email.
  await admin.query(
    "insert into public.messages (organization_id, conversation_id, direction, author, content) values ($1, $2, 'in', 'contact', 'Mi DNI es 12345678Z')",
    [org, rows[0]?.id],
  );
  return rows[0]?.id as string;
}

/** Como el worker al pasar la conversación a una persona: solo de agent a human. */
async function handOff(conversationId: string): Promise<void> {
  await admin.query("update public.conversations set mode = 'human' where id = $1 and mode = 'agent'", [conversationId]);
}

const handoffKeys = (eventIds: readonly string[]) =>
  received.map((r) => String(r.headers["idempotency-key"])).filter((key) => eventIds.some((id) => key.startsWith(`handoff:${id}:`)));

describe("aviso por email del paso a una persona (CU3)", () => {
  it("quien puede llevar la conversación recibe un email por paso, una sola vez; nadie fuera de su alcance ni de otra organización", async () => {
    const worker = startWorker({
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-handoff-email-${process.pid}`,
      WORKER_APP_VERSION: "test-handoff-email",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      RESEND_API_KEY: RESEND_KEY,
      WEB_APP_URL: WEB,
      FAKE_RESEND_URL: resendUrl,
    });

    const inX1 = await createConversation(ids.orgX, ids.locX1);
    const inX = await createConversation(ids.orgX, null);
    const inY1 = await createConversation(ids.orgY, ids.locY1);
    // Resend cae 3 veces para quien dirige X1 y luego vuelve.
    const { rows: before } = await admin.query<{ n: number }>("select count(*)::int as n from public.domain_events where type = 'conversation.handed_off'");
    failTimes.set(`:${userIds.xManager1}`, 3);
    const served503Before = served503;
    await handOff(inX1);
    // Repetido: la fila ya está en manos de una persona y no hay otro aviso.
    await handOff(inX1);
    await handOff(inX);
    await handOff(inY1);

    const eventsOf = async (conversationId: string) =>
      (
        await admin.query<{ id: string }>(
          "select id from public.domain_events where type = 'conversation.handed_off' and payload->>'conversation_id' = $1 order by created_at",
          [conversationId],
        )
      ).rows.map((row) => row.id);
    const [x1Events, xEvents, y1Events] = [await eventsOf(inX1), await eventsOf(inX), await eventsOf(inY1)];
    expect([x1Events.length, xEvents.length, y1Events.length]).toEqual([1, 1, 1]);
    const { rows: after } = await admin.query<{ n: number }>("select count(*)::int as n from public.domain_events where type = 'conversation.handed_off'");
    expect((after[0]?.n ?? 0) - (before[0]?.n ?? 0)).toBe(3);

    const expectedX1: Person[] = ["xAdmin", "xRegionN", "xManager1", "xStaff1"];
    await waitFor(
      () => new Set(handoffKeys(x1Events)).size === expectedX1.length && served503 - served503Before === 3,
      "los avisos de X1, con los 3 reintentos",
      worker.output,
    );
    await waitFor(() => new Set(handoffKeys(xEvents)).size === 1 && new Set(handoffKeys(y1Events)).size === 2, "los avisos de X y de Y1", worker.output);
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const forEvents = (eventIds: readonly string[]) => received.filter((r) => eventIds.some((id) => String(r.headers["idempotency-key"]).startsWith(`handoff:${id}:`)));
    // Exactamente quien puede llevarla: ni el region_manager del sur, ni el staff de X2 o X3, ni nadie de otra organización.
    expect(new Set(forEvents(x1Events).map((r) => r.body.to[0]))).toEqual(new Set(expectedX1.map(emailOf)));
    expect(forEvents(x1Events)).toHaveLength(expectedX1.length + 3);
    // La de toda la organización, solo el org_admin; la de Y1, las personas de Y1.
    expect(forEvents(xEvents).map((r) => r.body.to[0])).toEqual([emailOf("xAdmin")]);
    expect(forEvents(y1Events).map((r) => r.body.to[0]).sort()).toEqual([emailOf("yAdmin"), emailOf("yStaff1")].sort());

    const staff = forEvents(x1Events).find((r) => r.body.to[0] === emailOf("xStaff1"));
    expect(staff?.body.subject).toMatch(/handed a conversation to the team \(X1\)/);
    expect(staff?.body.text).toContain(`${WEB}/app/inbox/${inX1}?scope=location%3A${ids.locX1}`);
    for (const request of forEvents([...x1Events, ...xEvents, ...y1Events])) {
      expect(request.body.from).toBe(`${BRAND_NAME} <${NOTIFICATION_EMAIL_FROM}>`);
      // Sin el contenido de los mensajes.
      expect(request.body.text).not.toContain("12345678Z");
      expect(request.body.html).not.toContain("12345678Z");
    }

    // Devuelta al agente y pasada otra vez: es otro paso y otro aviso, con otra clave.
    await admin.query("update public.conversations set mode = 'agent' where id = $1", [inY1]);
    await handOff(inY1);
    const y1Again = await eventsOf(inY1);
    expect(y1Again).toHaveLength(2);
    await waitFor(() => new Set(handoffKeys([y1Again[1] as string])).size === 2, "el segundo aviso de Y1", worker.output);

    const { rows } = await admin.query<{ status: string; queue_name: string }>(
      "select status, queue_name from dbos.workflow_status where workflow_uuid = any($1::text[])",
      [[...x1Events, ...xEvents, ...y1Again].map((id) => deliveryWorkflowId(id, HANDOFF_EMAIL_HANDLER_KEY))],
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.status === "SUCCESS" && row.queue_name === "notifications")).toBe(true);
    expect(worker.output()).not.toContain("@demo.test");

    worker.child.kill("SIGTERM");
    expect(await worker.exited, worker.output()).toBe(0);
  });
});
