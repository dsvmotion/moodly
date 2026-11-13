import { DBOS } from "@dbos-inc/dbos-sdk";
import type { WorkflowStatusString } from "@dbos-inc/dbos-sdk";
import { normalizedInboundSchema } from "@repo/channels";
import type { NormalizedInbound } from "@repo/channels";
import type { ServiceDb, TenantDb, TenantSql } from "@repo/db/service";
import type { Logger } from "pino";
import { z } from "zod";
import { DEAD_LETTER, runAttempts } from "./attempts.ts";

// Lo que entra por un canal, ya guardado en inbound_events, se convierte en un
// mensaje de su conversación (ADR 0052 §2, PL-T2). Un workflow de DBOS por
// evento (id inbound:<evento>): si el proceso cae a medias, sigue donde iba, y
// el mismo evento no se procesa dos veces.
//
// - La organización es la de la fila del evento (la de su cuenta del canal);
//   todo se lee y escribe con forOrganization(esa organización).
// - El contacto sale de su identidad en el canal; la conversación abierta de
//   ese contacto en esa cuenta, o una nueva con el agente por defecto de la
//   cuenta y su local.
// - El mensaje del cliente emite message.received (trigger de la base de
//   datos) y su entrega a los consumidores se encola aquí mismo, con el mismo
//   id que usaría el publicador del outbox: el turno empieza sin esperar a su
//   vuelta de cada 5 s, y el publicador ya no crea otra.

export const INGEST_WORKFLOW = "channels.ingest";
export const INGEST_QUEUE = "channels-ingest";
export const SWEEP_WORKFLOW = "channels.ingest-sweep";
export const SWEEP_SCHEDULE_NAME = "channels.ingest-sweep";
/** Cada minuto, a los 23 s. */
export const SWEEP_SCHEDULE = "23 * * * * *";
/** Lo que se vuelve a intentar: los de las últimas 24 h; los más viejos se quedan para mirarlos. */
const SWEEP_WINDOW_MS = 24 * 3_600_000;
/** Un workflow en ERROR se rebobina como mucho una vez cada 5 min (288 veces en la ventana). */
export const SWEEP_MIN_AGE_MS = 5 * 60_000;

/**
 * Rebobina un workflow de la entrada que quedó en ERROR: desde su primer paso
 * fallido (o desde el siguiente al último, si falló entre pasos), con el mismo
 * id y en la cola de la entrada.
 */
async function rewindFailed(workflowID: string): Promise<void> {
  const startStep = rewindStartStep((await DBOS.listWorkflowSteps(workflowID)) ?? []);
  await DBOS.rewindWorkflow(workflowID, { startStep, queueName: INGEST_QUEUE });
}

/**
 * Desde qué paso se rebobina un workflow en ERROR: el último paso guardado si
 * falló (el que tiró el workflow), o el siguiente si falló entre pasos. Nunca
 * el primer paso con error: los fallos de intentos anteriores, ya recogidos
 * por runAttempts, también se guardan con error, y volver a ellos reiniciaría
 * la cuenta de intentos (y chocaría con guard_inbound_event_attempts, que no
 * deja que attempts baje).
 */
export function rewindStartStep(steps: readonly { functionID: number; error: unknown }[]): number {
  const last = [...steps].sort((a, b) => a.functionID - b.functionID).at(-1);
  if (!last) return 0;
  return last.error !== null && last.error !== undefined ? last.functionID : last.functionID + 1;
}
/**
 * Los estados de DBOS de un workflow que se vuelve a intentar solo: ERROR, que
 * aquí solo sale si no se pudo apuntar un intento en la base de datos (los
 * fallos del mensaje se cuentan dentro, hasta el dead_letter). DBOS 5.3 no
 * reanuda un ERROR (resumeWorkflow no lo toca): se rebobina con el mismo id
 * desde el primer paso que falló (rewindWorkflow), con los pasos buenos y los
 * intentos ya contados intactos: el tope se mantiene.
 */
export const RESUMABLE_STATUSES: readonly WorkflowStatusString[] = ["ERROR"];
/**
 * Los que no se tocan y miran las personas: CANCELLED (lo paró alguien) y
 * MAX_RECOVERY_ATTEMPTS_EXCEEDED (el proceso cayó con él demasiadas veces:
 * reanudarlo lo volvería a tirar).
 */
export const PARKED_STATUSES: readonly WorkflowStatusString[] = ["CANCELLED", "MAX_RECOVERY_ATTEMPTS_EXCEEDED"];

export function ingestWorkflowId(inboundEventId: string): string {
  return `inbound:${inboundEventId}`;
}

export interface IngestInput {
  /** La organización de la fila del evento (la de su cuenta del canal). */
  organizationId: string;
  inboundEventId: string;
}

export type IngestResult =
  | { outcome: "processed"; conversationId: string; messageId: string; eventId: string | null }
  | { outcome: "skipped"; reason: "missing" | "already_settled" }
  | { outcome: "ignored" | "failed"; reason: string }
  | { outcome: "dead_letter"; attempts: number; lastError: string };

/** Lo que la entrega del outbox necesita de un evento de dominio. */
export interface PendingEvent {
  id: string;
  organizationId: string;
  type: string;
}

export interface IngestOptions {
  db: ServiceDb;
  logger: Logger;
  /** Encola ya las entregas de un evento de dominio (las mismas que encolaría el publicador). */
  enqueueDeliveries: (event: PendingEvent) => Promise<number>;
  /** Solo para tests: se llama al empezar cada intento; si lanza, el intento falla. */
  beforeAttempt?: (input: IngestInput, attempt: number) => Promise<void>;
  /** Solo para tests: se llama al apuntar un intento fallido; si lanza, el apunte falla. */
  beforeRecordFailure?: (input: IngestInput, attempt: number) => Promise<void>;
  /** Solo para tests: la espera entre intentos (por defecto, la de attempts.ts). */
  backoffMs?: readonly number[];
  /** Solo para tests: cuánto lleva un workflow en ERROR antes de rebobinarlo (por defecto, SWEEP_MIN_AGE_MS). */
  sweepMinAgeMs?: number;
}

/**
 * La clave del mensaje del cliente: el id del proveedor, o, si el canal no lo
 * da, el del evento. Con ella, guardar el mensaje dos veces (un reintento del
 * paso después de escribir) devuelve el mismo: un mensaje y un turno.
 */
export function inboundMessageKey(message: NormalizedInbound): string {
  return message.providerMessageId ?? `evt:${message.providerEventId}`;
}

/** Las identidades que guarda contact_identities. */
const IDENTITY_KINDS = new Set(["phone", "email", "instagram", "webchat"]);

const DB_STEP = { retriesAllowed: true, maxAttempts: 4, intervalSeconds: 1, backoffRate: 2 } as const;

// Todo lo de la entrada, como moodly_worker por SQL bajo RLS (20261112230000):
// cada función es una transacción de forOrganization(org), y solo puede leer y
// escribir en esa organización y las columnas que la migración le concede.

/** El código de Postgres de un error (sin el mensaje: puede llevar datos). */
function pgCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "unknown";
}

/** Lo mismo que lanza la transacción, con solo el código: el mensaje de Postgres puede llevar datos. */
async function tx<T>(db: TenantDb, what: string, fn: (sql: TenantSql) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(fn);
  } catch (error) {
    throw Object.assign(new Error(`${what} (${pgCode(error)})`, { cause: error }), { code: pgCode(error) });
  }
}

interface Loaded {
  status: string;
  channelAccountId: string;
  message: NormalizedInbound;
}

async function load(db: TenantDb, inboundEventId: string): Promise<Loaded | null> {
  const [row] = await tx(db, "no se pudo leer el evento de entrada", (sql) =>
    sql.query<{ status: string; channel_account_id: string; payload: unknown }>(
      "select status, channel_account_id, payload from public.inbound_events where id = $1",
      [inboundEventId],
    ),
  );
  if (!row) return null;
  return { status: row.status, channelAccountId: row.channel_account_id, message: normalizedInboundSchema.parse(row.payload) };
}

async function settle(db: TenantDb, inboundEventId: string, status: "ignored" | "failed", errorCode: string): Promise<void> {
  await tx(db, "no se pudo cerrar el evento de entrada", (sql) =>
    sql.query("update public.inbound_events set status = $2, error_code = $3 where id = $1 and status in ('received', 'failed')", [
      inboundEventId,
      status,
      errorCode,
    ]),
  );
}

/**
 * El contacto de esa identidad en la organización; si no existe, se crea con su
 * identidad, en una sola transacción. Si otro mensaje del mismo cliente lo crea
 * a la vez, la identidad choca (23505), esta transacción se deshace entera (y
 * con ella su contacto: el worker nunca borra contactos) y vale el del otro.
 */
async function ensureContact(db: TenantDb, message: NormalizedInbound): Promise<string> {
  const find = (sql: TenantSql) =>
    sql
      .query<{ contact_id: string }>("select contact_id from public.contact_identities where kind = $1 and external_id = $2 limit 1", [
        message.from.kind,
        message.from.value,
      ])
      .then((rows) => rows[0]?.contact_id ?? null);
  try {
    return await db.transaction(async (sql) => {
      const existing = await find(sql);
      if (existing) return existing;
      const [contact] = await sql.query<{ id: string }>(
        "insert into public.contacts (organization_id, display_name) values ($1, $2) returning id",
        [db.organizationId, message.displayName?.trim().slice(0, 200) || null],
      );
      if (!contact) throw new Error("no se pudo crear el contacto");
      await sql.query("insert into public.contact_identities (organization_id, contact_id, kind, external_id) values ($1, $2, $3, $4)", [
        db.organizationId,
        contact.id,
        message.from.kind,
        message.from.value,
      ]);
      return contact.id;
    });
  } catch (error) {
    if (pgCode(error) !== "23505") throw Object.assign(new Error(`no se pudo crear el contacto (${pgCode(error)})`, { cause: error }), { code: pgCode(error) });
    const winner = await tx(db, "no se pudo leer la identidad del contacto", find);
    if (!winner) throw new Error("la identidad del contacto desapareció", { cause: error });
    return winner;
  }
}

const turnContextSchema = z.object({ agent: z.object({ type_key: z.string() }) });

/** La conversación abierta del contacto en esa cuenta, o una nueva con el agente por defecto de la cuenta. */
async function ensureConversation(db: TenantDb, channelAccountId: string, contactId: string): Promise<string | { failed: string }> {
  return tx(db, "no se pudo abrir la conversación", async (sql) => {
    const [open] = await sql.query<{ id: string }>(
      `select id from public.conversations
       where contact_id = $1 and channel_account_id = $2 and mode in ('agent', 'human')
       order by created_at desc limit 1`,
      [contactId, channelAccountId],
    );
    if (open) return open.id;
    const [account] = await sql.query<{ channel: string; location_id: string | null; default_agent_type: string }>(
      "select channel, location_id, default_agent_type from public.channel_accounts where id = $1",
      [channelAccountId],
    );
    if (!account) return { failed: "channel_account_missing" };
    const agents = await sql.query<{ id: string }>("select id from public.agents order by created_at limit 50");
    let agentId: string | null = null;
    for (const agent of agents) {
      // El contexto del agente con la organización de la transacción (20261112110000).
      const [context] = await sql.query<{ context: unknown }>("select private.worker_agent_turn_context($1) as context", [agent.id]);
      const parsed = turnContextSchema.safeParse(context?.context);
      if (parsed.success && parsed.data.agent.type_key === account.default_agent_type) {
        agentId = agent.id;
        break;
      }
    }
    if (!agentId) return { failed: "no_default_agent" };
    // El canal es el de la cuenta (validate_conversation lo comprueba); nace con el agente.
    const [created] = await sql.query<{ id: string }>(
      `insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, channel, agent_id)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [db.organizationId, account.location_id, contactId, channelAccountId, account.channel, agentId],
    );
    if (!created) throw new Error("no se pudo crear la conversación");
    return created.id;
  });
}

/** El mensaje del cliente; si ya se guardó (reintento del paso), el mismo, con o sin id del proveedor. */
async function insertMessage(db: TenantDb, conversationId: string, message: NormalizedInbound): Promise<string> {
  const key = inboundMessageKey(message);
  return tx(db, "no se pudo guardar el mensaje", async (sql) => {
    const [existing] = await sql.query<{ id: string }>(
      "select id from public.messages where conversation_id = $1 and external_message_id = $2 limit 1",
      [conversationId, key],
    );
    if (existing) return existing.id;
    const [inserted] = await sql.query<{ id: string }>(
      `insert into public.messages (organization_id, conversation_id, direction, author, content, attachments, external_message_id, status)
       values ($1, $2, 'in', 'contact', $3, $4::jsonb, $5, 'received') returning id`,
      [db.organizationId, conversationId, message.text, JSON.stringify(message.attachments), key],
    );
    if (!inserted) throw new Error("no se pudo guardar el mensaje");
    return inserted.id;
  });
}

async function markProcessed(db: TenantDb, inboundEventId: string, conversationId: string, messageId: string): Promise<void> {
  await tx(db, "no se pudo marcar el evento de entrada", (sql) =>
    sql.query(
      `update public.inbound_events set status = 'processed', conversation_id = $2, message_id = $3, error_code = null
       where id = $1 and status in ('received', 'failed')`,
      [inboundEventId, conversationId, messageId],
    ),
  );
}

/** El message.received que emitió la base de datos al guardar el mensaje (emit_message_received). */
async function messageReceivedEvent(db: TenantDb, messageId: string): Promise<{ id: string; type: string } | null> {
  const [event] = await tx(db, "no se pudo leer el evento del mensaje", (sql) =>
    sql.query<{ id: string; type: string }>(
      "select id, type from public.domain_events where type = 'message.received' and payload->>'message_id' = $1 limit 1",
      [messageId],
    ),
  );
  return event ?? null;
}

async function recordFailure(db: TenantDb, inboundEventId: string, attempt: number, code: string): Promise<void> {
  await tx(db, "no se pudo apuntar el intento fallido", (sql) =>
    sql.query(
      "update public.inbound_events set status = 'failed', attempts = $2, error_code = $3 where id = $1 and status in ('received', 'failed')",
      [inboundEventId, attempt, code.slice(0, 100)],
    ),
  );
}

export function registerIngest({ db, logger, enqueueDeliveries, beforeAttempt, beforeRecordFailure, backoffMs, sweepMinAgeMs = SWEEP_MIN_AGE_MS }: IngestOptions) {
  const log = logger.child({ component: "ingress" });

  async function ingest(input: IngestInput): Promise<IngestResult> {
    const tenant = db.forOrganization(input.organizationId);
    const outcome = await runAttempts(
      async (attempt) => {
        if (beforeAttempt) await DBOS.runStep(() => beforeAttempt(input, attempt), { name: `attempt-${attempt}:test` });
        return processOnce(input);
      },
      {
        recordFailure: (attempt, code) =>
          DBOS.runStep(
            async () => {
              if (beforeRecordFailure) await beforeRecordFailure(input, attempt);
              await recordFailure(tenant, input.inboundEventId, attempt, code);
            },
            { name: `attempt-${attempt}:failed`, ...DB_STEP },
          ),
        sleep: (ms) => DBOS.sleep(ms),
      },
      undefined,
      backoffMs,
    );
    if (outcome.ok) return outcome.value;
    log.error(
      { organizationId: input.organizationId, inboundEventId: input.inboundEventId, attempts: outcome.attempts, error: outcome.lastError, reason: DEAD_LETTER },
      "evento de entrada sin procesar tras agotar los intentos",
    );
    return { outcome: "dead_letter", attempts: outcome.attempts, lastError: outcome.lastError };
  }

  async function processOnce(input: IngestInput): Promise<IngestResult> {
    const tenant = db.forOrganization(input.organizationId);
    const fields = { organizationId: input.organizationId, inboundEventId: input.inboundEventId };
    const loaded = await DBOS.runStep(() => load(tenant, input.inboundEventId), { name: "load", ...DB_STEP });
    if (!loaded) {
      log.warn(fields, "el evento de entrada no está en su organización");
      return { outcome: "skipped", reason: "missing" };
    }
    if (loaded.status === "processed" || loaded.status === "ignored") return { outcome: "skipped", reason: "already_settled" };
    const { message } = loaded;
    if (!IDENTITY_KINDS.has(message.from.kind)) {
      await DBOS.runStep(() => settle(tenant, input.inboundEventId, "ignored", "unsupported_identity"), { name: "ignore", ...DB_STEP });
      log.info({ ...fields, reason: "unsupported_identity" }, "mensaje de entrada que no se atiende");
      return { outcome: "ignored", reason: "unsupported_identity" };
    }
    const contactId = await DBOS.runStep(() => ensureContact(tenant, message), { name: "contact", ...DB_STEP });
    const conversation = await DBOS.runStep(() => ensureConversation(tenant, loaded.channelAccountId, contactId), {
      name: "conversation",
      ...DB_STEP,
    });
    if (typeof conversation !== "string") {
      await DBOS.runStep(() => settle(tenant, input.inboundEventId, "failed", conversation.failed), { name: "fail", ...DB_STEP });
      log.error({ ...fields, reason: conversation.failed }, "el mensaje de entrada no tiene conversación");
      return { outcome: "failed", reason: conversation.failed };
    }
    const messageId = await DBOS.runStep(() => insertMessage(tenant, conversation, message), { name: "message", ...DB_STEP });
    await DBOS.runStep(() => markProcessed(tenant, input.inboundEventId, conversation, messageId), { name: "processed", ...DB_STEP });
    // El turno, ya: la entrega de message.received con el mismo id que la del publicador.
    const event = await DBOS.runStep(() => messageReceivedEvent(tenant, messageId), { name: "event", ...DB_STEP });
    if (event) await enqueueDeliveries({ id: event.id, organizationId: input.organizationId, type: event.type });
    log.info({ ...fields, conversationId: conversation, messageId }, "mensaje de entrada guardado");
    return { outcome: "processed", conversationId: conversation, messageId, eventId: event?.id ?? null };
  }

  const workflow = DBOS.registerWorkflow(ingest, { name: INGEST_WORKFLOW });

  // Lo que DBOS dejó en ERROR (no se pudo apuntar un intento) se reanuda donde
  // iba; lo cancelado o lo que tiró el proceso demasiadas veces se cuenta en el
  // log y se queda para una persona. Solo mira el esquema de DBOS, nunca datos
  // de las organizaciones: la organización ya va en la entrada del workflow,
  // que se guardó al arrancarlo.
  async function sweep(): Promise<void> {
    const since = new Date(Date.now() - SWEEP_WINDOW_MS).toISOString();
    const list = (status: readonly WorkflowStatusString[]) =>
      DBOS.listWorkflows({ workflowName: INGEST_WORKFLOW, status: [...status], startTime: since, limit: 100, loadInput: false, loadOutput: false });
    const stuck = await DBOS.runStep(
      async () => {
        const now = Date.now();
        return (await list(RESUMABLE_STATUSES))
          .filter((status) => now - (status.updatedAt ?? status.createdAt) >= sweepMinAgeMs)
          .map((status) => status.workflowID);
      },
      { name: "stuck", ...DB_STEP },
    );
    // Desde el workflow, no desde un paso (DBOS no lo deja): cada llamada de DBOS se guarda como un paso propio.
    for (const workflowID of stuck) {
      await rewindFailed(workflowID);
      log.warn({ workflowID }, "evento de entrada en ERROR, rebobinado");
    }
    if (stuck.length > 0) log.warn({ rewound: stuck.length }, "eventos de entrada parados, vueltos a intentar");
    const parked = await DBOS.runStep(
      async () => {
        const inWindow = (await list(PARKED_STATUSES)).length;
        // Lo que se quedó en ERROR más allá de la ventana ya no se vuelve a intentar: también hay que mirarlo.
        const expired = (
          await DBOS.listWorkflows({ workflowName: INGEST_WORKFLOW, status: [...RESUMABLE_STATUSES], endTime: since, limit: 100, loadInput: false, loadOutput: false })
        ).length;
        return { inWindow, expired };
      },
      { name: "parked", ...DB_STEP },
    );
    if (parked.inWindow + parked.expired > 0) {
      log.error({ parked: parked.inWindow, expired: parked.expired, reason: DEAD_LETTER }, "eventos de entrada parados que no se reanudan solos: hay que mirarlos");
    }
  }
  const sweepWorkflow = DBOS.registerWorkflow(sweep, { name: SWEEP_WORKFLOW });

  return {
    workflow,
    sweep: sweepWorkflow,
    /**
     * Arranca el workflow de un evento de entrada. Si ya existe y sigue vivo,
     * terminó o está apartado para una persona, no hace nada (el mismo id); si
     * quedó en ERROR, lo rebobina desde el paso que falló.
     */
    async start(input: IngestInput): Promise<void> {
      const workflowID = ingestWorkflowId(input.inboundEventId);
      const status = await DBOS.getWorkflowStatus(workflowID);
      if (status && (RESUMABLE_STATUSES as readonly string[]).includes(status.status)) {
        // Un reintento del proveedor sobre un evento en ERROR: se vuelve a intentar ya, sin esperar al barrido.
        await rewindFailed(workflowID);
        return;
      }
      await DBOS.startWorkflow(workflow, { workflowID, queueName: INGEST_QUEUE, workflowIDReusePolicy: "return-existing" })(input);
    },
  };
}

/** La cola y el barrido de la entrada viven en la base de datos: después de DBOS.launch(). */
export async function startIngestQueue(
  sweep: () => Promise<void>,
  /** Solo para tests: la programación del barrido (por defecto, SWEEP_SCHEDULE). */
  sweepSchedule: string = SWEEP_SCHEDULE,
): Promise<void> {
  await DBOS.registerQueue(INGEST_QUEUE, { workerConcurrency: 4 });
  await DBOS.applySchedules([{ scheduleName: SWEEP_SCHEDULE_NAME, workflowFn: sweep, schedule: sweepSchedule }]);
}
