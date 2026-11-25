import type { ChannelAdapter, DeliveryUpdate, NormalizedInbound, RawWebhook, VerifiedSender } from "@repo/channels";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import type { Logger } from "pino";
import { DEAD_LETTER } from "./attempts.ts";
import type { IngestInput } from "./ingest.ts";

// La entrada de un webhook de un canal (ADR 0052 §2), en este orden:
//
//   1. el canal tiene adaptador; si no, 404;
//   2. la firma del proveedor es válida (en tiempo constante, con el secreto de
//      la plataforma); si no, 401 y nada más: sin firma no se resuelve ninguna
//      cuenta, para que nadie pueda preguntar cuáles existen. Si la firma es de
//      una cuenta (el token del chat web), solo valen sus mensajes: los que
//      nombran otra se ignoran sin resolverla;
//   3. cada mensaje, por su cuenta del canal: resolve(canal, id externo), la
//      segunda lectura entre organizaciones (CLAUDE.md); solo una cuenta
//      activa; de ahí sale la organización, nunca del payload;
//   4. con forOrganization(esa organización), el evento en inbound_events,
//      una sola vez (clave única por cuenta e id del evento): un reintento del
//      proveedor no crea nada nuevo;
//   5. el workflow que lo convierte en mensaje (channels.ingest), con id
//      determinista: arrancarlo dos veces devuelve el mismo;
//   6. cada aviso de estado (enviado, entregado, leído, fallido), por la cuenta
//      que envió el mensaje, igual que en 3: se aplica al mensaje que salió con
//      ese id del proveedor, de esa organización y de esa cuenta. El estado solo
//      avanza (guard_delivery_status); un aviso de un mensaje que no se conoce
//      se ignora.
//
// Responde 200 en cuanto todo lo que llegó está guardado: el proveedor no
// tiene que reintentar lo que ya está a salvo, aunque se vaya a ignorar.

export interface ReceiveDeps {
  db: ServiceDb;
  adapters: ReadonlyMap<string, ChannelAdapter>;
  startIngest: (input: IngestInput) => Promise<void>;
  logger: Logger;
}

export interface ReceiveResult {
  status: 200 | 400 | 401 | 404 | 500;
  accepted: number;
  duplicates: number;
  ignored: number;
}

/**
 * Lo más grande que se guarda de un mensaje normalizado: por debajo del CHECK
 * de inbound_events.payload (64 KB), para no llegar nunca a la base de datos
 * con algo que va a rechazar.
 */
export const MAX_INBOUND_PAYLOAD_BYTES = 60_000;

/**
 * Errores de Postgres que no se arreglan reintentando (datos que no caben o no
 * valen): el mensaje se ignora y se confirma al proveedor, para que no lo
 * reintente para siempre ni bloquee el resto del lote.
 */
const PERMANENT_CODES = new Set(["23514", "23502", "22001", "22P02", "22023", "23503"]);

class TransientIngressError extends Error {
  override name = "TransientIngressError";
}

const none = { accepted: 0, duplicates: 0, ignored: 0 };

export async function receiveWebhook(channel: string, webhook: RawWebhook, deps: ReceiveDeps): Promise<ReceiveResult> {
  const log = deps.logger.child({ component: "ingress", channel });
  const adapter = deps.adapters.get(channel);
  if (!adapter) return { status: 404, ...none };
  const sender = await adapter.verify(webhook);
  if (!sender) {
    // Sin el cuerpo ni las cabeceras: pueden llevar datos.
    log.warn({ securityEvent: "ingress.bad_signature" }, "webhook con firma no válida");
    return { status: 401, ...none };
  }
  let parsed;
  try {
    parsed = adapter.parse(webhook);
  } catch (error) {
    log.warn({ error: (error as Error).name }, "webhook firmado que no se entiende");
    return { status: 400, ...none };
  }
  const result: ReceiveResult = { status: 200, ...none };
  // Cada mensaje por su cuenta: uno que falla no tira el lote. Lo que no se
  // arregla reintentando se ignora (y se confirma); si algo falló de forma
  // pasajera, al final un 500 para que el proveedor repita el lote, y lo que ya
  // se guardó no se duplica.
  let retryLater = false;
  for (const message of parsed.messages) {
    try {
      const outcome = await receiveOne(channel, sender, message, deps, log);
      result[outcome] += 1;
    } catch (error) {
      retryLater = true;
      log.error({ error: (error as Error).name }, "un mensaje del webhook no se pudo guardar; el proveedor lo repetirá");
    }
  }
  const applied = { applied: 0, unmatched: 0, ignored: 0 };
  for (const update of parsed.statuses) {
    try {
      applied[await applyStatus(channel, sender, update, deps, log)] += 1;
    } catch (error) {
      retryLater = true;
      log.error({ error: (error as Error).name }, "un aviso de estado no se pudo aplicar; el proveedor lo repetirá");
    }
  }
  if (retryLater) result.status = 500;
  log.info(
    { accepted: result.accepted, duplicates: result.duplicates, ignored: result.ignored, statuses: applied },
    "webhook recibido",
  );
  return result;
}

type Outcome = "accepted" | "duplicates" | "ignored";

async function receiveOne(
  channel: string,
  sender: VerifiedSender,
  message: NormalizedInbound,
  deps: ReceiveDeps,
  log: Logger,
): Promise<Outcome> {
  if (message.channel !== channel) {
    log.warn({ reason: "channel_mismatch" }, "mensaje de otro canal en el webhook");
    return "ignored";
  }
  // Una firma de una cuenta solo vale para los mensajes de esa cuenta: un
  // cuerpo firmado para A que nombre a B no se atribuye a B.
  if (sender.scope === "account" && message.accountExternalId !== sender.accountExternalId) {
    log.warn({ securityEvent: "ingress.account_mismatch" }, "mensaje para una cuenta distinta de la firmada");
    return "ignored";
  }
  if (Buffer.byteLength(JSON.stringify(message), "utf8") > MAX_INBOUND_PAYLOAD_BYTES) {
    log.warn({ reason: "payload_too_large" }, "mensaje demasiado grande para guardarlo: se ignora");
    return "ignored";
  }
  const account = await deps.db.channelAccounts.resolve(channel, message.accountExternalId);
  if (!account || account.status !== "active") {
    log.info({ reason: account ? `account_${account.status}` : "account_unknown" }, "mensaje para una cuenta que no atiende");
    return "ignored";
  }
  // El evento, como moodly_worker por SQL bajo RLS (20261112230000), una sola vez
  // por (cuenta, id del evento): un reintento del proveedor no crea nada nuevo.
  const tenant = deps.db.forOrganization(account.organizationId);
  let stored: StoredInboundEvent | undefined;
  try {
    stored = await storeInboundEvent(tenant, account.id, message);
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && PERMANENT_CODES.has(code)) {
      log.warn({ reason: "rejected_by_database", code }, "mensaje que la base de datos no admite: se ignora");
      return "ignored";
    }
    throw new TransientIngressError(`no se pudo guardar el evento de entrada (${typeof code === "string" ? code : "unknown"})`, { cause: error });
  }
  if (!stored) throw new TransientIngressError("el evento repetido no se encuentra");
  let inboundEventId: string;
  let outcome: Outcome;
  if (stored.inserted) {
    inboundEventId = stored.id;
    outcome = "accepted";
  } else {
    // Ya estaba: un reintento del proveedor. Si no llegó a procesarse, se vuelve a lanzar (mismo id de workflow).
    const settled = stored.status === "processed" || stored.status === "ignored" || stored.error_code === DEAD_LETTER;
    if (settled) return "duplicates";
    inboundEventId = stored.id;
    outcome = "duplicates";
  }
  await deps.startIngest({ organizationId: account.organizationId, inboundEventId });
  return outcome;
}

export interface StoredInboundEvent {
  id: string;
  inserted: boolean;
  status: string;
  error_code: string | null;
}

/**
 * El evento de entrada, una sola vez por (cuenta, id del evento) en la
 * organización de la cuenta (db.organizationId): si ya estaba, el que hay. La
 * lectura del repetido filtra por esa organización explícita, no solo por RLS
 * (3.2).
 */
export async function storeInboundEvent(
  db: Pick<TenantDb, "organizationId" | "transaction">,
  channelAccountId: string,
  message: NormalizedInbound,
): Promise<StoredInboundEvent | undefined> {
  return db.transaction(async (sql) => {
    const [inserted] = await sql.query<{ id: string }>(
      `insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (channel_account_id, provider_event_id) do nothing
       returning id`,
      [db.organizationId, channelAccountId, message.providerEventId, JSON.stringify(message)],
    );
    if (inserted) return { id: inserted.id, inserted: true, status: "received", error_code: null };
    const [existing] = await sql.query<{ id: string; status: string; error_code: string | null }>(
      "select id, status, error_code from public.inbound_events where organization_id = $1 and channel_account_id = $2 and provider_event_id = $3",
      [db.organizationId, channelAccountId, message.providerEventId],
    );
    return existing ? { ...existing, inserted: false } : undefined;
  });
}

type StatusOutcome = "applied" | "unmatched" | "ignored";

/**
 * Aplica un aviso de estado al mensaje que salió (como moodly_worker por SQL
 * bajo RLS, 20261113110000): el de la organización de la cuenta que lo envió,
 * en una conversación de esa cuenta y con ese id del proveedor. Si aún no
 * tiene id del proveedor (el aviso llegó antes de guardarlo, o el envío quedó
 * «unknown»), por nuestro id, si el proveedor lo devuelve (reference), y se
 * guarda el wamid (20261113120000). Las reglas del
 * estado son de la base de datos (guard_delivery_status): un aviso tardío o
 * repetido no lo hace retroceder. El error del proveedor solo con un fallo.
 */
async function applyStatus(
  channel: string,
  sender: VerifiedSender,
  update: DeliveryUpdate,
  deps: ReceiveDeps,
  log: Logger,
): Promise<StatusOutcome> {
  if (update.channel !== channel) {
    log.warn({ reason: "channel_mismatch" }, "aviso de estado de otro canal en el webhook");
    return "ignored";
  }
  if (sender.scope === "account" && update.accountExternalId !== sender.accountExternalId) {
    log.warn({ securityEvent: "ingress.account_mismatch" }, "aviso de estado para una cuenta distinta de la firmada");
    return "ignored";
  }
  const account = await deps.db.channelAccounts.resolve(channel, update.accountExternalId);
  // Una cuenta desactivada sigue recibiendo los avisos de lo que ya envió.
  if (!account) {
    log.info({ reason: "account_unknown" }, "aviso de estado para una cuenta que no existe");
    return "ignored";
  }
  const tenant = deps.db.forOrganization(account.organizationId);
  let updated: number;
  try {
    updated = await tenant.transaction(async (sql) => {
      const rows = await sql.query<{ id: string }>(
        `update public.messages m
         set status = $4, delivery_error = case when $4 = 'failed' then $5 else null end,
             external_message_id = coalesce(m.external_message_id, $3)
         where m.organization_id = $1 and m.direction = 'out'
           and (m.external_message_id = $3 or ($6::uuid is not null and m.id = $6::uuid and m.external_message_id is null))
           and m.conversation_id in (select c.id from public.conversations c where c.organization_id = $1 and c.channel_account_id = $2)
         returning m.id`,
        [account.organizationId, account.id, update.providerMessageId, update.status, update.errorCode ?? null, update.reference ?? null],
      );
      return rows.length;
    });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && PERMANENT_CODES.has(code)) {
      log.warn({ reason: "rejected_by_database", code }, "aviso de estado que la base de datos no admite: se ignora");
      return "ignored";
    }
    throw new TransientIngressError(`no se pudo aplicar el aviso de estado (${typeof code === "string" ? code : "unknown"})`, { cause: error });
  }
  return updated > 0 ? "applied" : "unmatched";
}
