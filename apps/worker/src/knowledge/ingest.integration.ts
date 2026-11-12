import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_CHUNK_CHARS, createFakeEmbedder } from "@repo/knowledge";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliveryWorkflowId } from "../events/outbox.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { INGEST_HANDLER_KEY } from "./ingest.ts";

// La ingesta del conocimiento de punta a punta (paso B20-1): una fuente de texto
// que se crea o cambia emite knowledge_source.pending, el outbox lo entrega a
// knowledge.ingest en un worker de verdad (DBOS y Supabase local), que la
// trocea, saca los embeddings (falsos y deterministas, los mismos que usa el
// test para buscar) y deja sus fragmentos en lugar de los que tuviera. Las
// fuentes viven en un local temporal de Demo A que se borra al terminar. Lo que
// hace la guarda cuando el texto lo cambia el org_admin desde la app (volver a
// pending) lo prueba pgTAP (35_knowledge_text); aquí se deja igual a mano.
const fixture = join(import.meta.dirname, "..", "testing", "knowledge-worker.ts");
const dir = mkdtempSync(join(tmpdir(), "worker-knowledge-"));
const children = new Set<ChildProcess>();
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const api = localSupabaseApi();
const marker = `knowledge-${randomUUID().slice(0, 8)}`;
const markerFile = join(dir, "started.jsonl");
const embedder = createFakeEmbedder(16);
const ids: Record<string, string> = {};
let worker: { child: ChildProcess; output(): string } | null = null;
let policySet = false;

async function one(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`sin id: ${sql}`);
  return id;
}

async function waitFor(condition: () => Promise<boolean>, what: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`no llegó a pasar: ${what}\n${worker?.output() ?? ""}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Una fuente de texto en el local de prueba (o de toda la organización), como la deja la app: pending. */
async function source(title: string, body: string | null, options: { orgWide?: boolean; storagePath?: string } = {}): Promise<string> {
  return one(
    `insert into public.knowledge_sources (organization_id, location_id, type, title, body, storage_path)
     values ($1, $2, 'faq', $3, $4, $5) returning id`,
    [ids.org, options.orgWide ? null : ids.location, `${marker} ${title}`, body, options.storagePath ?? null],
  );
}

/** El texto nuevo, de vuelta en pending: lo que hace la guarda cuando lo cambia el org_admin. */
async function rewrite(sourceId: string, body: string): Promise<void> {
  await admin.query("update public.knowledge_sources set body = $2, status = 'pending' where id = $1", [sourceId, body]);
}

async function status(sourceId: string): Promise<string> {
  const { rows } = await admin.query<{ status: string }>("select status from public.knowledge_sources where id = $1", [sourceId]);
  return rows[0]?.status ?? "missing";
}

async function chunks(sourceId: string) {
  const { rows } = await admin.query<{
    organization_id: string;
    location_id: string | null;
    ordinal: number;
    content: string;
    embedding_model: string;
    embedding_dim: number;
    embedding: string;
  }>(
    `select organization_id, location_id, ordinal, content, embedding_model, embedding_dim, embedding::text
     from public.knowledge_chunks where source_id = $1 order by ordinal`,
    [sourceId],
  );
  return rows;
}

/** Los eventos de una fuente y si su entrega a knowledge.ingest terminó bien. */
async function deliveries(sourceId: string) {
  const { rows } = await admin.query<{ id: string }>(
    "select id from public.domain_events where type = 'knowledge_source.pending' and payload->>'source_id' = $1 order by created_at",
    [sourceId],
  );
  const statuses: string[] = [];
  for (const row of rows) {
    const { rows: wf } = await admin.query<{ status: string }>("select status from dbos.workflow_status where workflow_uuid = $1", [
      deliveryWorkflowId(row.id, INGEST_HANDLER_KEY),
    ]);
    statuses.push(wf[0]?.status ?? "none");
  }
  return statuses;
}

/** Lo que encuentra search_knowledge (la que usa el retriever del worker) con los mismos embeddings. */
async function search(query: string, k = 3) {
  const [vector] = await embedder.embed([query]);
  const { rows } = await admin.query<{ source_id: string; content: string }>(
    "select source_id, content from public.search_knowledge($1, $2, $3, $4::extensions.vector, $5, $6)",
    [ids.org, ids.location, embedder.model, `[${(vector ?? []).join(",")}]`, query, k],
  );
  return rows;
}

beforeAll(async () => {
  await admin.connect();
  ids.org = await one("select id from public.organizations where name = 'Demo A'", []);
  ids.location = await one("insert into public.locations (organization_id, name, timezone) values ($1, $2, 'Europe/Madrid') returning id", [
    ids.org,
    marker,
  ]);

  const child = spawn(process.execPath, [fixture, markerFile], {
    env: {
      ...process.env,
      WORKER_SYSTEM_DATABASE_URL: localSystemDatabaseUrl(),
      WORKER_EXECUTOR_ID: `test-${randomUUID().slice(0, 8)}`,
      WORKER_APP_VERSION: "test-knowledge",
      LOG_LEVEL: "info",
      SUPABASE_URL: api.url,
      SUPABASE_SECRET_KEY: api.secretKey,
      WORKER_DATABASE_URL: localWorkerDatabaseUrl(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.on("close", () => children.delete(child));
  worker = { child, output: () => output };
  await waitFor(async () => existsSync(markerFile) && readFileSync(markerFile, "utf8").includes('"started"'), "el worker arranca");
}, 90_000);

afterAll(async () => {
  for (const child of children) child.kill("SIGKILL");
  if (policySet) await admin.query("delete from public.org_model_settings where organization_id = $1", [ids.org]);
  if (ids.location) {
    await admin.query(
      "delete from public.domain_events where type = 'knowledge_source.pending' and payload->>'source_id' in (select id::text from public.knowledge_sources where title like $1)",
      [`${marker} %`],
    );
    await admin.query("delete from public.knowledge_sources where title like $1", [`${marker} %`]);
    await admin.query("delete from public.locations where id = $1", [ids.location]);
  }
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

describe("la ingesta del conocimiento (paso B20-1)", () => {
  it("una fuente nueva queda troceada, con sus embeddings y su alcance, en ready, y se encuentra", async () => {
    const parking = "Hay aparcamiento gratuito para clientes en la calle de atrás, entrando por la rampa azul.";
    const long = Array.from({ length: 30 }, (_, i) => `La sesión de láser número ${i + 1} dura unos cuarenta minutos y conviene no tomar el sol antes.`).join(" ");
    const id = await source("Información práctica", `${parking}\n\n${long}`);
    // ready se pone dentro del paso; el workflow termina justo después: se esperan las dos cosas.
    await waitFor(async () => (await status(id)) === "ready" && (await deliveries(id)).join() === "SUCCESS", "la fuente queda ready y la entrega termina");

    const rows = await chunks(id);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.map((row) => row.ordinal)).toEqual(rows.map((_, i) => i));
    for (const row of rows) {
      expect(row.content.startsWith(`${marker} Información práctica`)).toBe(true);
      expect(row.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect([row.organization_id, row.location_id, row.embedding_model, row.embedding_dim]).toEqual([ids.org, ids.location, "fake-hash-16", 16]);
    }
    // El vector guardado es el del texto del fragmento, no otro.
    const [expected] = await embedder.embed([rows[0]?.content ?? ""]);
    const stored = JSON.parse(rows[0]?.embedding ?? "[]") as number[];
    stored.forEach((value, i) => expect(value).toBeCloseTo(expected?.[i] ?? Number.NaN, 5));

    const hits = await search("aparcamiento gratuito rampa azul");
    expect(hits[0]?.source_id).toBe(id);
    expect(hits[0]?.content).toContain("aparcamiento gratuito");
    expect(await deliveries(id)).toEqual(["SUCCESS"]);
  });

  it("cambiar el texto la reindexa: los fragmentos viejos se van y quedan los del texto nuevo", async () => {
    const id = await source("Horario", "Abrimos de lunes a viernes de 9:00 a 20:00.");
    await waitFor(async () => (await status(id)) === "ready", "la primera versión queda ready");
    expect((await chunks(id)).map((row) => row.content)).toEqual([`${marker} Horario\nAbrimos de lunes a viernes de 9:00 a 20:00.`]);

    await rewrite(id, "Abrimos de lunes a sábado de 10:00 a 21:00.\n\nLos domingos y festivos, cerrado.");
    await waitFor(async () => (await deliveries(id)).join() === "SUCCESS,SUCCESS" && (await status(id)) === "ready", "la segunda versión queda ready");
    expect((await chunks(id)).map((row) => row.content)).toEqual([
      `${marker} Horario\nAbrimos de lunes a sábado de 10:00 a 21:00.\n\nLos domingos y festivos, cerrado.`,
    ]);
    const hits = await search("domingos festivos cerrado");
    expect(hits.filter((hit) => hit.source_id === id).map((hit) => hit.content)).toEqual([
      `${marker} Horario\nAbrimos de lunes a sábado de 10:00 a 21:00.\n\nLos domingos y festivos, cerrado.`,
    ]);
  });

  it("si el texto cambia mientras se indexa, la entrega vieja no escribe nada y quedan los fragmentos del texto nuevo", async () => {
    // La primera entrega tarda 12 s en sacar los embeddings; mientras, el texto
    // cambia y la segunda entrega (otro workflow de la cola) termina antes.
    const id = await source("Ofertas", "Descuento del 10 % en bonos de cinco sesiones. LENTO-EMBEDDING");
    await waitFor(async () => (await status(id)) === "processing", "la primera entrega empieza");
    await rewrite(id, "Descuento del 20 % en bonos de cinco sesiones.");
    await waitFor(async () => (await deliveries(id)).join() === "SUCCESS,SUCCESS", "las dos entregas terminan", 50_000);
    expect(await status(id)).toBe("ready");
    expect((await chunks(id)).map((row) => row.content)).toEqual([`${marker} Ofertas\nDescuento del 20 % en bonos de cinco sesiones.`]);
    expect((worker?.output() ?? "").split("\n").some((line) => line.includes(`"sourceId":"${id}"`) && line.includes('"reason":"changed"'))).toBe(true);
  }, 60_000);

  it("si los embeddings fallan, la fuente queda en error, sin fragmentos, y no se busca en ella", async () => {
    const id = await source("Precios", "El precio de la limpieza facial es de 45 euros. FALLA-EMBEDDING");
    // La fuente pasa a error dentro del paso; el workflow termina justo después: se esperan las dos cosas.
    await waitFor(async () => (await status(id)) === "error" && (await deliveries(id)).join() === "SUCCESS", "la fuente queda en error y la entrega termina");
    expect(await chunks(id)).toEqual([]);
    expect(await deliveries(id)).toEqual(["SUCCESS"]);
    expect((worker?.output() ?? "").split("\n").some((line) => line.includes(`"sourceId":"${id}"`) && line.includes("no se pudo indexar"))).toBe(true);

    // Y si después se corrige el texto, se indexa.
    await rewrite(id, "El precio de la limpieza facial es de 45 euros.");
    await waitFor(async () => (await status(id)) === "ready", "la fuente corregida queda ready");
    expect((await chunks(id)).map((row) => row.content)).toEqual([`${marker} Precios\nEl precio de la limpieza facial es de 45 euros.`]);
  });

  it("con «Solo UE», el texto no sale hacia el proveedor: la fuente queda en error, sin fragmentos", async () => {
    await admin.query("insert into public.org_model_settings (organization_id, residency) values ($1, 'eu')", [ids.org]);
    policySet = true;
    const id = await source("Tarifas", "La depilación de axilas cuesta 39 euros. FALLA-EMBEDDING");
    await waitFor(async () => (await status(id)) === "error", "la fuente queda en error");
    expect(await chunks(id)).toEqual([]);
    const lines = (worker?.output() ?? "").split("\n").filter((line) => line.includes(`"sourceId":"${id}"`));
    // Si hubiera llamado al proveedor, el embedder de prueba habría fallado (FALLA-EMBEDDING): no llegó a llamarlo.
    expect(lines.some((line) => line.includes("la política de modelos de la organización no deja indexar la fuente"))).toBe(true);
    expect(lines.some((line) => line.includes("no se pudo indexar"))).toBe(false);

    // Con la política de plataforma, la misma fuente corregida se indexa.
    await admin.query("delete from public.org_model_settings where organization_id = $1", [ids.org]);
    policySet = false;
    await rewrite(id, "La depilación de axilas cuesta 39 euros.");
    await waitFor(async () => (await status(id)) === "ready", "la fuente queda ready");
  });

  it("una fuente de toda la organización se indexa sin local, y una sin texto (de archivo) se queda en pending", async () => {
    const orgWide = await source("Política de cancelación", "Cancela con 24 horas de antelación sin coste.", { orgWide: true });
    const file = await source("Folleto", null, { storagePath: `${marker}/folleto.pdf` });
    await waitFor(async () => (await status(orgWide)) === "ready", "la de la organización queda ready");
    expect((await chunks(orgWide)).map((row) => row.location_id)).toEqual([null]);

    await waitFor(async () => (await deliveries(file)).join() === "SUCCESS", "la entrega de la de archivo termina");
    expect([await status(file), await chunks(file)]).toEqual(["pending", []]);
  });
});
