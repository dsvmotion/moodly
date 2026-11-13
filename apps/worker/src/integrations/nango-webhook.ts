import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceDb } from "@repo/db/service";
import {
  NANGO_SIGNATURE_HEADER,
  NANGO_WEBHOOK_MAX_BYTES,
  parseNangoWebhook,
  platformIntegrationByKey,
  verifyNangoWebhook,
  type ConnectorPlatform,
  type NangoAuthWebhook,
} from "@repo/integrations";
import type { Logger } from "pino";
import { z } from "zod";

// El webhook de Nango (O-02, ADR 0053): cuando una persona termina de autorizar
// en el popup, Nango avisa con el id de la conexión. Es lo único que activa
// una integración de plataforma.
//
// 1. La firma (X-Nango-Hmac-Sha256 sobre el cuerpo crudo), antes de nada: sin
//    ella, 401 y no se escribe nada. Ni se parsea el cuerpo.
// 2. La organización y la fila salen de las etiquetas que pusimos nosotros en la
//    sesión de conexión (organization_id, integration_id), que llegan firmadas;
//    y se vuelven a comprobar contra Nango (GET /connections): la conexión
//    existe, es de esa integración y lleva esas mismas etiquetas.
// 3. El cambio, con forOrganization(org).transaction (moodly_worker, RLS): solo
//    la fila con ese id, de esa organización, de tipo platform y de ese
//    proveedor. Si no hay ninguna, se ignora (y se registra).
// 4. Si la persona desconectó mientras tanto, la conexión nueva se borra en
//    Nango. Si reconectó con otra conexión, la vieja también.
//
// Respuestas: 200 cuando no hay nada que hacer o ya está hecho (Nango no
// reintenta), 401 sin firma buena, 400 si no es JSON, 500 si falla algo
// pasajero (Nango reintenta). Ningún token, email ni cuerpo en los logs: ids.

export const NANGO_WEBHOOK_PATH = "/webhooks/nango";

export interface NangoWebhookDeps {
  db: ServiceDb;
  platform: ConnectorPlatform;
  signingKey: string;
  logger: Logger;
}

export type NangoWebhookResult =
  | "invalid_signature"
  | "invalid_body"
  | "ignored"
  | "activated"
  | "marked_error"
  | "discarded";

const uuid = z.uuid();

interface IntegrationRow {
  id: string;
  status: string;
  external_connection_id: string | null;
}

/** El núcleo, sin HTTP: recibe el cuerpo crudo y la cabecera de la firma. */
export async function handleNangoWebhook(
  deps: NangoWebhookDeps,
  rawBody: Buffer,
  signature: string | string[] | undefined,
): Promise<NangoWebhookResult> {
  const { logger } = deps;
  if (!verifyNangoWebhook(rawBody, signature, deps.signingKey)) {
    logger.warn({ event: "integrations.webhook_rejected", reason: "signature" }, "webhook de Nango con firma no válida: ignorado");
    return "invalid_signature";
  }
  let webhook: NangoAuthWebhook | null;
  try {
    webhook = parseNangoWebhook(rawBody);
  } catch {
    logger.warn({ event: "integrations.webhook_rejected", reason: "json" }, "webhook de Nango firmado pero sin JSON");
    return "invalid_body";
  }
  if (!webhook) return "ignored";

  const entry = platformIntegrationByKey(webhook.integrationKey);
  const org = uuid.safeParse(webhook.tags["organization_id"]);
  const row = uuid.safeParse(webhook.tags["integration_id"]);
  const log = { integrationKey: webhook.integrationKey, operation: webhook.operation, connectionId: webhook.connectionId };
  if (!entry || !org.success || !row.success) {
    logger.warn({ ...log, event: "integrations.webhook_ignored", reason: "tags" }, "webhook de Nango sin integración conocida o sin nuestras etiquetas");
    return "ignored";
  }
  const scope = { ...log, organizationId: org.data, integrationId: row.data };

  if (!webhook.success) {
    // La autorización (o el refresco del token) falló: la fila pasa a error, si
    // sigue esperando esa conexión.
    const changed = await deps.db.forOrganization(org.data).transaction((sql) =>
      sql.query<{ id: string }>(
        `update public.integrations set status = 'error'
          where id = $1 and organization_id = $2 and kind = 'platform' and provider = $3
            and status in ('pending', 'active') and (external_connection_id is null or external_connection_id = $4)
          returning id`,
        [row.data, org.data, entry.provider, webhook.connectionId],
      ),
    );
    logger.info({ ...scope, event: "integrations.connection_failed", changed: changed.length }, "Nango avisa de una autorización fallida");
    return changed.length > 0 ? "marked_error" : "ignored";
  }
  if (webhook.operation === "refresh") return "ignored";

  // Contra la API: que la conexión exista y lleve las mismas etiquetas.
  const connection = await deps.platform.getConnection(entry.integrationKey, webhook.connectionId);
  if (
    !connection ||
    connection.tags["organization_id"] !== org.data ||
    connection.tags["integration_id"] !== row.data
  ) {
    logger.warn({ ...scope, event: "integrations.webhook_ignored", reason: "connection_mismatch" }, "la conexión del webhook no coincide en Nango");
    return "ignored";
  }

  const outcome = await deps.db.forOrganization(org.data).transaction(async (sql) => {
    const [current] = await sql.query<IntegrationRow>(
      `select id, status, external_connection_id from public.integrations
        where id = $1 and organization_id = $2 and kind = 'platform' and provider = $3
        for update`,
      [row.data, org.data, entry.provider],
    );
    if (!current) return { result: "ignored" as const, previous: null };
    if (current.status === "disconnected") return { result: "discarded" as const, previous: null };
    await sql.query(
      `update public.integrations set status = 'active', external_connection_id = $3, last_health_check = now()
        where id = $1 and organization_id = $2`,
      [row.data, org.data, webhook.connectionId],
    );
    const previous = current.external_connection_id && current.external_connection_id !== webhook.connectionId ? current.external_connection_id : null;
    return { result: "activated" as const, previous };
  });

  if (outcome.result === "ignored") {
    logger.warn({ ...scope, event: "integrations.webhook_ignored", reason: "no_row" }, "el webhook de Nango no corresponde a ninguna integración pendiente");
    return "ignored";
  }
  // Lo que ya no es de nadie se borra en Nango (no deja tokens huérfanos).
  const orphan = outcome.result === "discarded" ? webhook.connectionId : outcome.previous;
  if (orphan) {
    await deps.platform.deleteConnection(entry.integrationKey, orphan).catch((err: unknown) => {
      logger.error({ ...scope, err, orphan, event: "integrations.orphan_not_deleted" }, "no se pudo borrar en Nango una conexión que ya no se usa");
    });
  }
  logger.info({ ...scope, event: `integrations.${outcome.result}` }, outcome.result === "activated" ? "integración conectada" : "conexión descartada: la integración está desconectada");
  return outcome.result;
}

const STATUS: Record<NangoWebhookResult, number> = {
  invalid_signature: 401,
  invalid_body: 400,
  ignored: 200,
  activated: 200,
  marked_error: 200,
  discarded: 200,
};

function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk: Buffer) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > max) {
        tooBig = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(tooBig ? null : Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function reply(res: ServerResponse, status: number, body: Record<string, string>) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));
}

/**
 * La ruta HTTP para el servidor del worker: atiende POST /webhooks/nango y
 * devuelve true; cualquier otra petición, false (la atiende otro).
 */
export function createNangoWebhookRoute(deps: NangoWebhookDeps) {
  return (req: IncomingMessage, res: ServerResponse, url: URL): boolean => {
    if (url.pathname !== NANGO_WEBHOOK_PATH) return false;
    if (req.method !== "POST") {
      reply(res, 405, { error: "method_not_allowed" });
      return true;
    }
    readBody(req, NANGO_WEBHOOK_MAX_BYTES)
      .then(async (body) => {
        if (!body) {
          deps.logger.warn({ event: "integrations.webhook_rejected", reason: "size" }, "webhook de Nango demasiado grande");
          reply(res, 413, { error: "too_large" });
          return;
        }
        const result = await handleNangoWebhook(deps, body, req.headers[NANGO_SIGNATURE_HEADER]);
        reply(res, STATUS[result], { status: result === "invalid_signature" ? "unauthorized" : "ok" });
      })
      .catch((err: unknown) => {
        deps.logger.error({ err, event: "integrations.webhook_failed" }, "el webhook de Nango falló; Nango lo reintentará");
        if (!res.headersSent) reply(res, 500, { error: "retry" });
      });
    return true;
  };
}
