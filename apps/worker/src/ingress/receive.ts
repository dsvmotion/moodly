import type { ChannelAdapter, RawWebhook } from "@repo/channels";
import type { ServiceDb } from "@repo/db/service";
import type { Logger } from "pino";
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
  status: 200 | 400 | 401 | 404;
  accepted: number;
  duplicates: number;
  ignored: number;
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
  for (const message of parsed.messages) {
    if (message.channel !== channel) {
      result.ignored += 1;
      log.warn({ reason: "channel_mismatch" }, "mensaje de otro canal en el webhook");
      continue;
    }
    // Una firma de una cuenta solo vale para los mensajes de esa cuenta: un
    // cuerpo firmado para A que nombre a B no se atribuye a B.
    if (sender.scope === "account" && message.accountExternalId !== sender.accountExternalId) {
      result.ignored += 1;
      log.warn({ securityEvent: "ingress.account_mismatch" }, "mensaje para una cuenta distinta de la firmada");
      continue;
    }
    const account = await deps.db.channelAccounts.resolve(channel, message.accountExternalId);
    if (!account || account.status !== "active") {
      result.ignored += 1;
      log.info({ reason: account ? `account_${account.status}` : "account_unknown" }, "mensaje para una cuenta que no atiende");
      continue;
    }
    const tenant = deps.db.forOrganization(account.organizationId);
    const inserted = await tenant
      .from("inbound_events")
      .insert({ channel_account_id: account.id, provider_event_id: message.providerEventId, payload: message })
      .select("id")
      .single();
    let inboundEventId: string;
    if (inserted.error?.code === "23505") {
      // Ya estaba: un reintento del proveedor. Si no llegó a procesarse, se vuelve a lanzar (mismo id de workflow).
      const existing = await tenant
        .from("inbound_events")
        .select("id, status")
        .eq("channel_account_id", account.id)
        .eq("provider_event_id", message.providerEventId)
        .single();
      if (existing.error) throw new Error(`no se pudo leer el evento repetido (${existing.error.code})`);
      result.duplicates += 1;
      if (existing.data.status !== "received" && existing.data.status !== "failed") continue;
      inboundEventId = existing.data.id;
    } else if (inserted.error) {
      throw new Error(`no se pudo guardar el evento de entrada (${inserted.error.code})`);
    } else {
      inboundEventId = inserted.data.id;
      result.accepted += 1;
    }
    await deps.startIngest({ organizationId: account.organizationId, inboundEventId });
  }
  log.info({ accepted: result.accepted, duplicates: result.duplicates, ignored: result.ignored }, "webhook recibido");
  return result;
}
