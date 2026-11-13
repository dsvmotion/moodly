import { ChannelSendError, type ChannelAdapter, type NormalizedOutbound } from "@repo/channels";
import type { TenantDb } from "@repo/db/service";
import { z } from "zod";
import { DB_STEP, type EventHandler } from "../events/handlers.ts";

// El envío de lo que sale por un canal del proveedor (O-01, ADR 0052 §3): la
// respuesta del agente por WhatsApp. Consume message.outbound, que la base de
// datos emite con cada mensaje que sale pending por un canal que envía el
// worker (20261113120000).
//
// Meta no acepta claves de idempotencia, así que nunca se envía dos veces a
// ciegas:
//
//   1. «send», un solo paso: primero reclama el mensaje (pending → unknown, en
//      la base de datos) y, solo si lo reclamó, lo envía. Si el proceso cae a
//      medias y DBOS repite el paso, el mensaje ya no está pending: no se
//      vuelve a enviar.
//   2. Si el envío falla, outcomeUnknown se mira ANTES que retryable: con un
//      corte de red, un timeout, un 5xx o una respuesta sin id, el proveedor
//      pudo recibirlo, y repetirlo podría duplicarlo al cliente. El mensaje se
//      queda «unknown», para una persona, hasta que lo concilie el primer aviso
//      de estado de Meta (por el wamid o por nuestro id, que va en
//      biz_opaque_callback_data). Solo un rechazo seguro y pasajero (un 429, el
//      límite de ritmo de Meta) se reintenta, dentro del mismo paso.
//   3. «record», con reintentos: sent con el wamid, o failed con el código del
//      proveedor (nunca su texto).
//
// La organización es la de la fila del evento (ctx.db); el destino sale de la
// identidad del contacto de la conversación, nunca del modelo ni del payload.

export const CHANNEL_SEND_HANDLER_KEY = "channels.send";
/** Intentos de un rechazo seguro y pasajero (429): el primero y dos más. */
export const SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2_000, 8_000];

const outgoingSchema = z.object({
  id: z.uuid(),
  conversation_id: z.uuid(),
  status: z.string(),
  content: z.string(),
  idempotency_key: z.string().nullable(),
  channel: z.string(),
  account_external_id: z.string(),
  phone: z.string().nullable(),
});
type Outgoing = z.infer<typeof outgoingSchema>;

export type SendOutcome =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "failed"; code: string }
  | { outcome: "unknown"; code: string }
  | { outcome: "not_pending" };

async function loadOutgoing(db: TenantDb, messageId: string, conversationId: string): Promise<Outgoing | null> {
  const [row] = await db.transaction((sql) =>
    sql.query<Record<string, unknown>>(
      `select m.id, m.conversation_id, m.status, m.content, m.idempotency_key, c.channel,
              a.external_id as account_external_id,
              (select i.external_id from public.contact_identities i
               where i.contact_id = c.contact_id and i.kind = 'phone' order by i.external_id limit 1) as phone
       from public.messages m
       join public.conversations c on c.id = m.conversation_id and c.organization_id = m.organization_id
       join public.channel_accounts a on a.id = c.channel_account_id and a.organization_id = c.organization_id
       where m.organization_id = $1 and m.id = $2 and m.conversation_id = $3 and m.direction = 'out'`,
      [db.organizationId, messageId, conversationId],
    ),
  );
  return row ? outgoingSchema.parse(row) : null;
}

/** Pending → unknown, solo si sigue pending: quien lo reclama es el único que lo envía. */
async function claim(db: TenantDb, messageId: string): Promise<boolean> {
  const rows = await db.transaction((sql) =>
    sql.query<{ id: string }>(
      "update public.messages set status = 'unknown' where organization_id = $1 and id = $2 and status = 'pending' returning id",
      [db.organizationId, messageId],
    ),
  );
  return rows.length > 0;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reclama y envía. No lanza por un fallo del envío: lo devuelve. Solo lanza si
 * falla la base de datos antes de enviar (el reclamo), así que DBOS puede
 * repetir el paso sin riesgo: o no se reclamó, o ya no está pending.
 */
export async function claimAndSend(
  db: TenantDb,
  adapter: ChannelAdapter,
  message: NormalizedOutbound & { reference: string },
  delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<SendOutcome> {
  if (!(await claim(db, message.reference))) return { outcome: "not_pending" };
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { providerMessageId } = await adapter.send(message);
      return { outcome: "sent", providerMessageId };
    } catch (error) {
      if (!(error instanceof ChannelSendError)) return { outcome: "unknown", code: "unexpected_error" };
      // Primero: ¿pudo llegar? Entonces no se repite, sea o no «retryable».
      if (error.outcomeUnknown) return { outcome: "unknown", code: error.providerCode ?? "outcome_unknown" };
      if (error.retryable && attempt < SEND_ATTEMPTS) {
        await sleep(delays[attempt - 1] ?? delays.at(-1) ?? 0);
        continue;
      }
      return { outcome: "failed", code: error.providerCode ?? "send_failed" };
    }
  }
}

async function record(db: TenantDb, messageId: string, outcome: SendOutcome): Promise<void> {
  if (outcome.outcome === "sent") {
    await db.transaction((sql) =>
      sql.query(
        `update public.messages
         set status = 'sent', external_message_id = coalesce(external_message_id, $3)
         where organization_id = $1 and id = $2`,
        [db.organizationId, messageId, outcome.providerMessageId],
      ),
    );
  } else if (outcome.outcome === "failed") {
    await db.transaction((sql) =>
      sql.query("update public.messages set status = 'failed', delivery_error = $3 where organization_id = $1 and id = $2", [
        db.organizationId,
        messageId,
        outcome.code.slice(0, 100),
      ]),
    );
  }
}

const payloadSchema = z.object({ conversation_id: z.uuid(), message_id: z.uuid() });

export interface ChannelSendOptions {
  /** Los adaptadores con envío, por canal. Sin el del canal, el mensaje se queda pending. */
  adapters: ReadonlyMap<string, ChannelAdapter>;
  /** Las esperas entre intentos de un rechazo pasajero (para los tests). */
  retryDelaysMs?: readonly number[];
}

export function createChannelSendHandler(options: ChannelSendOptions): EventHandler {
  return {
    key: CHANNEL_SEND_HANDLER_KEY,
    eventTypes: ["message.outbound"],
    async handle(event, ctx) {
      const { conversation_id: conversationId, message_id: messageId } = payloadSchema.parse(event.payload);
      const log = ctx.logger.child({ component: CHANNEL_SEND_HANDLER_KEY, messageId });
      const outgoing = await ctx.step("load", () => loadOutgoing(ctx.db, messageId, conversationId), DB_STEP);
      if (!outgoing || outgoing.status !== "pending") {
        log.info({ reason: outgoing ? `status_${outgoing.status}` : "missing" }, "no hay nada que enviar");
        return;
      }
      const adapter = options.adapters.get(outgoing.channel);
      if (!adapter) {
        // Sin las credenciales del canal: se queda pending, a la vista en la bandeja.
        log.warn({ channel: outgoing.channel }, "sin adaptador para el canal: el mensaje se queda pending");
        return;
      }
      if (!outgoing.phone) {
        await ctx.step("record", () => record(ctx.db, messageId, { outcome: "failed", code: "no_recipient" }), DB_STEP);
        log.warn({ reason: "no_recipient" }, "el contacto no tiene teléfono: el mensaje falla sin enviarse");
        return;
      }
      const message: NormalizedOutbound & { reference: string } = {
        channel: outgoing.channel as NormalizedOutbound["channel"],
        accountExternalId: outgoing.account_external_id,
        to: { kind: "phone", value: outgoing.phone },
        text: outgoing.content,
        buttons: [],
        attachments: [],
        idempotencyKey: outgoing.idempotency_key ?? messageId,
        reference: messageId,
      };
      const outcome = await ctx.step("send", () => claimAndSend(ctx.db, adapter, message, options.retryDelaysMs), DB_STEP);
      await ctx.step("record", () => record(ctx.db, messageId, outcome), DB_STEP);
      if (outcome.outcome === "sent") log.info("mensaje enviado");
      else if (outcome.outcome === "failed") log.warn({ code: outcome.code }, "el proveedor rechazó el envío");
      else if (outcome.outcome === "unknown") {
        log.warn({ code: outcome.code }, "no se sabe si el envío llegó: no se repite; lo concilia el aviso de Meta o una persona");
      } else log.info({ reason: "not_pending" }, "otro intento ya lo reclamó: no se envía");
    },
  };
}
