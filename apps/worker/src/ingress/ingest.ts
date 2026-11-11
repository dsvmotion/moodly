import { DBOS } from "@dbos-inc/dbos-sdk";
import { normalizedInboundSchema } from "@repo/channels";
import type { NormalizedInbound } from "@repo/channels";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import type { Logger } from "pino";
import { z } from "zod";

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
  | { outcome: "ignored" | "failed"; reason: string };

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
}

/** Las identidades que guarda contact_identities. */
const IDENTITY_KINDS = new Set(["phone", "email", "instagram", "webchat"]);

const DB_STEP = { retriesAllowed: true, maxAttempts: 4, intervalSeconds: 1, backoffRate: 2 } as const;

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

interface Loaded {
  status: string;
  channelAccountId: string;
  message: NormalizedInbound;
}

async function load(db: TenantDb, inboundEventId: string): Promise<Loaded | null> {
  const row = check(
    await db.from("inbound_events").select("status, channel_account_id, payload").eq("id", inboundEventId).maybeSingle(),
    "el evento de entrada",
  );
  if (!row) return null;
  return { status: row.status, channelAccountId: row.channel_account_id, message: normalizedInboundSchema.parse(row.payload) };
}

async function settle(db: TenantDb, inboundEventId: string, status: "ignored" | "failed", errorCode: string): Promise<void> {
  const { error } = await db.from("inbound_events").update({ status, error_code: errorCode }).eq("id", inboundEventId).in("status", ["received", "failed"]);
  if (error) throw new Error(`no se pudo cerrar el evento de entrada (${error.code})`);
}

/** El contacto de esa identidad en la organización; si no existe, se crea con su identidad. */
async function ensureContact(db: TenantDb, message: NormalizedInbound): Promise<string> {
  const found = async () =>
    check(
      await db.from("contact_identities").select("contact_id").eq("kind", message.from.kind).eq("external_id", message.from.value).maybeSingle(),
      "la identidad del contacto",
    )?.contact_id ?? null;
  const existing = await found();
  if (existing) return existing;
  const contact = await db
    .from("contacts")
    .insert({ display_name: message.displayName?.trim().slice(0, 200) || null })
    .select("id")
    .single();
  if (contact.error) throw new Error(`no se pudo crear el contacto (${contact.error.code})`);
  const identity = await db.from("contact_identities").insert({ contact_id: contact.data.id, kind: message.from.kind, external_id: message.from.value });
  if (identity.error?.code === "23505") {
    // Otro mensaje del mismo cliente lo creó a la vez: vale el suyo; el contacto sobrante se borra.
    await db.from("contacts").delete().eq("id", contact.data.id);
    const winner = await found();
    if (!winner) throw new Error("la identidad del contacto desapareció");
    return winner;
  }
  if (identity.error) throw new Error(`no se pudo guardar la identidad del contacto (${identity.error.code})`);
  return contact.data.id;
}

const turnContextSchema = z.object({ agent: z.object({ type_key: z.string() }) });

/** La conversación abierta del contacto en esa cuenta, o una nueva con el agente por defecto de la cuenta. */
async function ensureConversation(db: TenantDb, channelAccountId: string, contactId: string): Promise<string | { failed: string }> {
  const open = check(
    await db
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("channel_account_id", channelAccountId)
      .in("mode", ["agent", "human"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "la conversación abierta",
  );
  if (open) return open.id;
  const account = check(
    await db.from("channel_accounts").select("channel, location_id, default_agent_type").eq("id", channelAccountId).maybeSingle(),
    "la cuenta del canal",
  );
  if (!account) return { failed: "channel_account_missing" };
  const agents = check(await db.from("agents").select("id").order("created_at").limit(50), "los agentes") ?? [];
  let agentId: string | null = null;
  for (const agent of agents) {
    const parsed = turnContextSchema.safeParse(await db.agentTurnContext(agent.id));
    if (parsed.success && parsed.data.agent.type_key === account.default_agent_type) {
      agentId = agent.id;
      break;
    }
  }
  if (!agentId) return { failed: "no_default_agent" };
  const created = await db
    .from("conversations")
    // El canal lo pone la base de datos desde la cuenta (validate_conversation); el tipo lo pide.
    .insert({ location_id: account.location_id, contact_id: contactId, channel_account_id: channelAccountId, channel: account.channel, agent_id: agentId })
    .select("id")
    .single();
  if (created.error) throw new Error(`no se pudo crear la conversación (${created.error.code})`);
  return created.data.id;
}

/** El mensaje del cliente; si ya se guardó (reintento del paso), el mismo. */
async function insertMessage(db: TenantDb, conversationId: string, message: NormalizedInbound): Promise<string> {
  if (message.providerMessageId) {
    const existing = check(
      await db
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("external_message_id", message.providerMessageId)
        .limit(1)
        .maybeSingle(),
      "el mensaje ya guardado",
    );
    if (existing) return existing.id;
  }
  const inserted = await db
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "in",
      author: "contact",
      content: message.text,
      attachments: message.attachments,
      external_message_id: message.providerMessageId ?? null,
      status: "received",
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(`no se pudo guardar el mensaje (${inserted.error.code})`);
  return inserted.data.id;
}

export function registerIngest({ db, logger, enqueueDeliveries }: IngestOptions) {
  const log = logger.child({ component: "ingress" });

  async function ingest(input: IngestInput): Promise<IngestResult> {
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
    await DBOS.runStep(
      async () => {
        const { error } = await tenant
          .from("inbound_events")
          .update({ status: "processed", conversation_id: conversation, message_id: messageId, error_code: null })
          .eq("id", input.inboundEventId)
          .in("status", ["received", "failed"]);
        if (error) throw new Error(`no se pudo marcar el evento de entrada (${error.code})`);
      },
      { name: "processed", ...DB_STEP },
    );
    // El turno, ya: la entrega de message.received con el mismo id que la del publicador.
    const event = await DBOS.runStep(
      async () =>
        check(
          await tenant
            .from("domain_events")
            .select("id, type")
            .eq("type", "message.received")
            .eq("payload->>message_id", messageId)
            .limit(1)
            .maybeSingle(),
          "el evento del mensaje",
        ),
      { name: "event", ...DB_STEP },
    );
    if (event) await enqueueDeliveries({ id: event.id, organizationId: input.organizationId, type: event.type });
    log.info({ ...fields, conversationId: conversation, messageId }, "mensaje de entrada guardado");
    return { outcome: "processed", conversationId: conversation, messageId, eventId: event?.id ?? null };
  }

  const workflow = DBOS.registerWorkflow(ingest, { name: INGEST_WORKFLOW });
  return {
    workflow,
    /** Arranca (o devuelve, si ya existe) el workflow de un evento de entrada. */
    async start(input: IngestInput): Promise<void> {
      await DBOS.startWorkflow(workflow, {
        workflowID: ingestWorkflowId(input.inboundEventId),
        queueName: INGEST_QUEUE,
        workflowIDReusePolicy: "return-existing",
      })(input);
    },
  };
}

/** La cola de la entrada vive en la base de datos: después de DBOS.launch(). */
export async function startIngestQueue(): Promise<void> {
  await DBOS.registerQueue(INGEST_QUEUE, { workerConcurrency: 4 });
}
