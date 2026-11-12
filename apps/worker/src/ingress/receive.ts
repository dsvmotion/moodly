import type { ChannelAdapter, NormalizedInbound, RawWebhook, VerifiedSender } from "@repo/channels";
import type { ServiceDb } from "@repo/db/service";
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
//      determinista: arrancarlo dos veces devuelve el mismo.
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
  if (retryLater) result.status = 500;
  log.info({ accepted: result.accepted, duplicates: result.duplicates, ignored: result.ignored }, "webhook recibido");
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
  const tenant = deps.db.forOrganization(account.organizationId);
  const inserted = await tenant
    .from("inbound_events")
    .insert({ channel_account_id: account.id, provider_event_id: message.providerEventId, payload: message })
    .select("id")
    .single();
  let inboundEventId: string;
  let outcome: Outcome;
  if (inserted.error?.code === "23505") {
    // Ya estaba: un reintento del proveedor. Si no llegó a procesarse, se vuelve a lanzar (mismo id de workflow).
    const existing = await tenant
      .from("inbound_events")
      .select("id, status, error_code")
      .eq("channel_account_id", account.id)
      .eq("provider_event_id", message.providerEventId)
      .single();
    if (existing.error) throw new TransientIngressError(`no se pudo leer el evento repetido (${existing.error.code})`);
    const settled = existing.data.status === "processed" || existing.data.status === "ignored" || existing.data.error_code === DEAD_LETTER;
    if (settled) return "duplicates";
    inboundEventId = existing.data.id;
    outcome = "duplicates";
  } else if (inserted.error && PERMANENT_CODES.has(inserted.error.code)) {
    log.warn({ reason: "rejected_by_database", code: inserted.error.code }, "mensaje que la base de datos no admite: se ignora");
    return "ignored";
  } else if (inserted.error) {
    throw new TransientIngressError(`no se pudo guardar el evento de entrada (${inserted.error.code})`);
  } else {
    inboundEventId = inserted.data.id;
    outcome = "accepted";
  }
  await deps.startIngest({ organizationId: account.organizationId, inboundEventId });
  return outcome;
}
