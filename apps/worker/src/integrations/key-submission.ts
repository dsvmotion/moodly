import { DBOS } from "@dbos-inc/dbos-sdk";
import type { ServiceDb, TenantDb, TenantSql } from "@repo/db/service";
import { KoiboxError, createKoiboxReader } from "@repo/integrations";
import { SubmissionRejectedError, openSubmission, type IngressKeyring, type SubmissionContext } from "@repo/integrations/key-ingress";
import type { Logger } from "pino";
import { DB_STEP, type DomainEvent, type EventContext, type EventHandler, type StepRetry } from "../events/handlers.ts";
import type { SecretVault } from "../secrets/vault.ts";
import { KOIBOX_PROVIDER, koiboxSecretName } from "./koibox.ts";

// El alta, la rotación y la limpieza de la clave de una integración con clave
// del cliente (ADR 0055 §4 y §5; hoy, Koibox).
//
// integrations.key_submission (integration.key_submitted):
// - Arranca un workflow por envío, con ID determinista (key-submission:<envío>):
//   si la entrega se repite, DBOS devuelve el mismo en vez de arrancar otro.
// - Su estado lleva solo identificadores (la organización sale de la fila del
//   evento, nunca del payload). La clave en claro solo existe dentro de un paso
//   («apply»), en memoria: se descifra, se comprueba contra el proveedor, se
//   vuelve a cifrar con SecretVault y se escribe, todo dentro del mismo paso.
//   El resultado del paso es solo el desenlace.
// - La comprobación contra el proveedor va antes y fuera de la transacción. La
//   transacción empieza con `select … for update` de la integración, borra el
//   propio envío (si ya no estaba, otro workflow o un reintento lo aplicó: no
//   escribe), y decide con el estado de después del bloqueo:
//   - desconectada: no escribe nada;
//   - el envío no es posterior a la marca del último aplicado: no escribe nada;
//   - clave buena: cambia la clave del secreto enlazado o inserta uno nuevo, y
//     la integración queda activa;
//   - clave mala: una pendiente pasa a error (y pierde el secreto viejo, si lo
//     conservaba); una activa o en error no cambia.
//   En los dos casos avanza la marca.
// - Un 42501 de las guardas (p. ej. «una integración desconectada no recibe un
//   secreto») es un rechazo definitivo, no un fallo pasajero: no se reintenta
//   (nota de V10 en #329).
// - Caducidad: el workflow duerme hasta 15 minutos después del envío y lo borra
//   si sigue ahí (falló antes de aplicarlo, o no hay claves para abrirlo).
//
// integrations.key_cleanup (integration.disconnected):
// - En una sola transacción con el mismo bloqueo: quita el secret_id solo si la
//   integración sigue desconectada y apunta al secreto del evento, y solo
//   entonces borra ese secreto exacto. Si la persona reconectó antes, no toca nada.
//
// Nunca registra la clave, el texto cifrado ni el detalle del proveedor: solo ids y desenlaces.

export const KEY_SUBMISSION_HANDLER_KEY = "integrations.key_submission";
export const KEY_SUBMISSION_WORKFLOW = "integrations.key_submission";
export const KEY_CLEANUP_HANDLER_KEY = "integrations.key_cleanup";
/** Lo que vive un envío sin procesar (ADR 0055 §2). */
export const SUBMISSION_TTL_MS = 15 * 60 * 1000;

/** Los proveedores con clave del cliente que sabe comprobar el worker. */
const SUPPORTED_PROVIDERS = new Set([KOIBOX_PROVIDER]);

/** Comprobar la clave contra el proveedor: un fallo pasajero (5xx, sin respuesta) se reintenta. */
const VERIFY_RETRY: StepRetry = { maxAttempts: 4, intervalSeconds: 2, backoffRate: 2 };

export function keySubmissionWorkflowId(submissionId: string): string {
  return `key-submission:${submissionId}`;
}

export type KeyCheck = "valid" | "invalid";

/** La comprobación de una clave contra su proveedor. Lanza si el fallo es pasajero. */
export type KeyVerifier = (provider: string, apiKey: string) => Promise<KeyCheck>;

export function createKoiboxVerifier(options: { apiBase: string; fetch?: typeof globalThis.fetch }): KeyVerifier {
  return async (provider, apiKey) => {
    if (provider !== KOIBOX_PROVIDER) throw new Error(`no se sabe comprobar una clave de ${provider}`);
    const reader = createKoiboxReader({ apiKey, timeZone: "UTC", apiBase: options.apiBase, ...(options.fetch ? { fetch: options.fetch } : {}) });
    try {
      await reader.verifyKey();
      return "valid";
    } catch (err) {
      if (err instanceof KoiboxError && !err.retryable) return "invalid";
      throw err;
    }
  };
}

export type SubmissionOutcome =
  | "applied" // la clave valía: secreto guardado o rotado, integración activa
  | "rejected" // la clave no valía: marca avanzada, y una pendiente en error
  | "already_processed" // el envío ya no estaba: lo aplicó otro workflow o un reintento
  | "stale" // había uno posterior ya aplicado o rechazado
  | "disconnected" // la persona desconectó mientras tanto
  | "unopenable" // no se pudo abrir (otra clave, otro contexto, sin claves): se borra al caducar
  | "refused"; // una guarda lo rechazó (42501): definitivo, sin reintentos

export interface KeySubmissionInput {
  organizationId: string;
  integrationId: string;
  submissionId: string;
  provider: string;
}

export interface KeySubmissionOptions {
  db: ServiceDb;
  logger: Logger;
  /** null: el worker no tiene claves de ingreso. Los envíos solo caducan. */
  keyring: IngressKeyring | null;
  /** null: el worker no tiene SecretVault. Los envíos solo caducan. */
  vault: SecretVault | null;
  verify: KeyVerifier;
  /** Solo para tests: cuánto vive un envío sin procesar. */
  ttlMs?: number;
}

interface SubmissionRow {
  key_ref: string;
  encrypted_data_key: string;
  ciphertext: string;
  created_at: Date;
}

interface IntegrationRow {
  id: string;
  status: string;
  secret_id: string | null;
  location_id: string | null;
  last_submission_at: Date | null;
  last_submission_id: string | null;
}

function isGuardRefusal(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "42501";
}

/** (a, idA) > (b, idB), como la comparación de filas de Postgres (uuid en texto, minúsculas). */
function after(at: Date, id: string, markAt: Date | null, markId: string | null): boolean {
  if (!markAt || !markId) return true;
  if (at.getTime() !== markAt.getTime()) return at.getTime() > markAt.getTime();
  return id > markId;
}

/**
 * La decisión y las escrituras, en una sola transacción que empieza bloqueando
 * la integración. `check` es el resultado de la comprobación (hecha antes y
 * fuera), o null si el envío no se pudo abrir.
 */
async function applyInTransaction(
  sql: TenantSql,
  input: KeySubmissionInput,
  sealedSecret: { keyRef: string; encryptedDataKey: string; ciphertext: string } | null,
  check: KeyCheck,
): Promise<SubmissionOutcome> {
  const org = input.organizationId;
  const [integration] = await sql.query<IntegrationRow>(
    `select id, status, secret_id, location_id, last_submission_at, last_submission_id
       from public.integrations
      where id = $1 and organization_id = $2 and kind = 'native' and provider = $3
      for update`,
    [input.integrationId, org, input.provider],
  );
  const [own] = await sql.query<{ created_at: Date }>(
    `delete from public.integration_secret_submissions where id = $1 and organization_id = $2 returning created_at`,
    [input.submissionId, org],
  );
  if (!own) return "already_processed";
  if (!integration || integration.status === "disconnected") return "disconnected";
  if (!after(own.created_at, input.submissionId, integration.last_submission_at, integration.last_submission_id)) return "stale";

  const mark = [own.created_at, input.submissionId] as const;
  if (check === "valid" && sealedSecret) {
    let secretId = integration.secret_id;
    if (secretId) {
      const rotated = await sql.query(
        `update public.integration_secrets set key_ref = $1, encrypted_data_key = $2, ciphertext = $3
          where id = $4 and organization_id = $5 and kind = 'integration' returning id`,
        [sealedSecret.keyRef, sealedSecret.encryptedDataKey, sealedSecret.ciphertext, secretId, org],
      );
      if (rotated.length === 0) secretId = null;
    }
    if (!secretId) {
      const [inserted] = await sql.query<{ id: string }>(
        `insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
         values ($1, 'integration', $2, $3, $4, $5) returning id`,
        [org, koiboxSecretName(integration.location_id), sealedSecret.keyRef, sealedSecret.encryptedDataKey, sealedSecret.ciphertext],
      );
      secretId = inserted?.id ?? null;
    }
    await sql.query(
      `update public.integrations set status = 'active', secret_id = $1, last_submission_at = $2, last_submission_id = $3,
            last_submission_result = 'applied'
        where id = $4 and organization_id = $5`,
      [secretId, mark[0], mark[1], input.integrationId, org],
    );
    return "applied";
  }

  if (integration.status === "pending") {
    await sql.query(
      `update public.integrations set status = 'error', secret_id = null, last_submission_at = $1, last_submission_id = $2,
            last_submission_result = 'rejected'
        where id = $3 and organization_id = $4`,
      [mark[0], mark[1], input.integrationId, org],
    );
    // La clave que la persona quiso quitar al desconectar (una reconexión antes de la limpieza).
    if (integration.secret_id) {
      await sql.query(`delete from public.integration_secrets where id = $1 and organization_id = $2 and kind = 'integration'`, [
        integration.secret_id,
        org,
      ]);
    }
  } else {
    await sql.query(
      `update public.integrations set last_submission_at = $1, last_submission_id = $2, last_submission_result = 'rejected'
        where id = $3 and organization_id = $4`,
      [mark[0], mark[1], input.integrationId, org],
    );
  }
  return "rejected";
}

/** Un envío, de principio a fin (sin DBOS: lo usa el paso «apply» y los tests). */
export async function applySubmission(
  options: Pick<KeySubmissionOptions, "db" | "keyring" | "vault" | "verify">,
  input: KeySubmissionInput,
): Promise<{ outcome: SubmissionOutcome; createdAt: string | null }> {
  const tenant = options.db.forOrganization(input.organizationId);
  const [row] = await tenant.transaction((sql) =>
    sql.query<SubmissionRow>(
      `select key_ref, encrypted_data_key, ciphertext, created_at
         from public.integration_secret_submissions
        where id = $1 and organization_id = $2 and integration_id = $3 and provider = $4`,
      [input.submissionId, input.organizationId, input.integrationId, input.provider],
    ),
  );
  if (!row) return { outcome: "already_processed", createdAt: null };
  const createdAt = row.created_at.toISOString();
  if (!options.keyring || !options.vault || !SUPPORTED_PROVIDERS.has(input.provider)) return { outcome: "unopenable", createdAt };

  const context: SubmissionContext = { ...input };
  let apiKey: string;
  try {
    apiKey = await openSubmission(options.keyring, context, {
      keyRef: row.key_ref,
      encryptedDataKey: row.encrypted_data_key,
      ciphertext: row.ciphertext,
    });
  } catch (err) {
    if (err instanceof SubmissionRejectedError) return { outcome: "unopenable", createdAt };
    throw err;
  }
  const check = await options.verify(input.provider, apiKey);
  const sealed = check === "valid" ? await options.vault.seal(input.organizationId, apiKey) : null;
  try {
    const outcome = await tenant.transaction((sql) => applyInTransaction(sql, input, sealed, check));
    return { outcome, createdAt };
  } catch (err) {
    if (isGuardRefusal(err)) return { outcome: "refused", createdAt };
    throw err;
  }
}

/** La limpieza al desconectar (ADR 0055 §5). Devuelve si borró el secreto. */
export async function cleanupDisconnected(
  tenant: Pick<TenantDb, "transaction">,
  input: { organizationId: string; integrationId: string; secretId: string },
): Promise<boolean> {
  return tenant.transaction(async (sql) => {
    await sql.query(`select id from public.integrations where id = $1 and organization_id = $2 for update`, [input.integrationId, input.organizationId]);
    const cleared = await sql.query(
      `update public.integrations set secret_id = null
        where id = $1 and organization_id = $2 and status = 'disconnected' and secret_id = $3 returning id`,
      [input.integrationId, input.organizationId, input.secretId],
    );
    if (cleared.length === 0) return false;
    await sql.query(`delete from public.integration_secrets where id = $1 and organization_id = $2 and kind = 'integration'`, [
      input.secretId,
      input.organizationId,
    ]);
    return true;
  });
}

function submissionInput(event: DomainEvent): KeySubmissionInput {
  return {
    organizationId: event.organizationId,
    integrationId: String(event.payload["integration_id"]),
    submissionId: String(event.payload["submission_id"]),
    provider: String(event.payload["provider"]),
  };
}

export function registerKeySubmissions(options: KeySubmissionOptions): EventHandler {
  const { db, logger } = options;
  const ttlMs = options.ttlMs ?? SUBMISSION_TTL_MS;
  const log = logger.child({ component: "integrations.key_submission" });

  async function processSubmission(input: KeySubmissionInput): Promise<void> {
    const fields = { organizationId: input.organizationId, integrationId: input.integrationId, submissionId: input.submissionId };
    const { outcome, createdAt } = await DBOS.runStep(() => applySubmission(options, input), {
      name: "apply",
      retriesAllowed: true,
      maxAttempts: VERIFY_RETRY.maxAttempts,
      intervalSeconds: VERIFY_RETRY.intervalSeconds,
      backoffRate: VERIFY_RETRY.backoffRate,
    }).catch((err: unknown) => {
      // Agotó los reintentos (el proveedor no contesta, la base de datos falla):
      // el envío se queda y lo borra la caducidad. Sin el detalle.
      log.warn({ ...fields, error: err instanceof Error ? err.name : "Error" }, "no se pudo procesar la clave enviada");
      return { outcome: null, createdAt: null } as const;
    });
    if (outcome) {
      const level = outcome === "refused" || outcome === "unopenable" ? "warn" : "info";
      log[level]({ ...fields, event: `integrations.key_${outcome}` }, "clave de integración procesada");
    }
    if (outcome === "applied" || outcome === "rejected" || outcome === "already_processed" || outcome === "stale" || outcome === "disconnected") {
      return;
    }
    // Lo que sigue ahí caduca: a los 15 minutos del envío, se borra.
    const expiresAt = (createdAt ? Date.parse(createdAt) : await DBOS.now()) + ttlMs;
    const now = await DBOS.now();
    if (expiresAt > now) await DBOS.sleep(expiresAt - now);
    const removed = await DBOS.runStep(
      () =>
        db
          .forOrganization(input.organizationId)
          .transaction((sql) =>
            sql.query(`delete from public.integration_secret_submissions where id = $1 and organization_id = $2 returning id`, [
              input.submissionId,
              input.organizationId,
            ]),
          ),
      { name: "expire", retriesAllowed: true, ...DB_STEP },
    );
    if (removed.length > 0) log.info({ ...fields, event: "integrations.key_expired" }, "envío de clave caducado y borrado");
  }

  const workflow = DBOS.registerWorkflow(processSubmission, { name: KEY_SUBMISSION_WORKFLOW });

  return {
    key: KEY_SUBMISSION_HANDLER_KEY,
    eventTypes: ["integration.key_submitted"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const input = submissionInput(event);
      await DBOS.startWorkflow(workflow, { workflowID: keySubmissionWorkflowId(input.submissionId) })(input);
      ctx.logger.info({ submissionId: input.submissionId, integrationId: input.integrationId }, "clave de integración en proceso");
    },
  };
}

export function createKeyCleanupHandler(): EventHandler {
  return {
    key: KEY_CLEANUP_HANDLER_KEY,
    eventTypes: ["integration.disconnected"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const input = {
        organizationId: event.organizationId,
        integrationId: String(event.payload["integration_id"]),
        secretId: String(event.payload["secret_id"]),
      };
      const removed = await ctx.step("cleanup", () => cleanupDisconnected(ctx.db, input), DB_STEP);
      ctx.logger.info(
        { integrationId: input.integrationId, event: removed ? "integrations.secret_removed" : "integrations.secret_kept" },
        removed ? "secreto de la integración desconectada borrado" : "la integración ya no estaba desconectada con ese secreto: no se toca",
      );
    },
  };
}
