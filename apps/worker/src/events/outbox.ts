import { DBOS, Error as DBOSErrors } from "@dbos-inc/dbos-sdk";
import type { PublishedCursor, PublishedDomainEvent, ServiceDb, TenantDb } from "@repo/db/service";
import type { Logger } from "pino";
import { isEventType, parsePayload } from "./catalog.ts";
import { isParked, isResumable } from "../workflow-status.ts";
import {
  DB_STEP,
  StepRetriesExhaustedError,
  type DeliveryQueue,
  type DomainEvent,
  type EventHandler,
  type EventRegistry,
} from "./handlers.ts";

// Las lecturas del outbox con DBOS.runStep directo: los reintentos de DB_STEP.
const DB_RUN_STEP = { retriesAllowed: true, ...DB_STEP } as const;

// Publicador y entregas del outbox (MANUAL §5.8, ADR 0009, ADR 0027):
//
//   1. «outbox.publish», un workflow programado cada pocos segundos, lee los
//      eventos pendientes (solo id, organización y tipo) y encola una entrega
//      por cada consumidor suscrito; después los marca como publicados.
//   2. «outbox.deliver», una por evento y consumidor, con ID determinista
//      (event:<evento>:<consumidor>): si el publicador se interrumpe y vuelve a
//      encolar, DBOS devuelve la entrega que ya existe en vez de crear otra.
//   3. La entrega lee su evento con forOrganization(la organización de la
//      fila) y se lo da al consumidor con ese mismo acceso: el tenant sale de
//      la fila, nunca del payload (control 3.7).
//   4. «outbox.prune», cada hora, borra del esquema dbos las vueltas del
//      publicador ya terminadas (unas 17.000 al día). Las entregas se quedan.
//   5. «outbox.backfill» (W3): el publicador solo conoce a los consumidores
//      que hay al publicar, así que uno que llega después no recibiría nunca
//      lo anterior. Un consumidor con `backfill` lo recibe: al arrancar, una
//      vez por consumidor y tipo (ID backfill:<consumidor>:<tipo>), se le
//      encolan los eventos de ese tipo ya publicados en su ventana, con el
//      mismo ID de entrega: lo que ya tenía no se le vuelve a entregar.

export const PUBLISH_WORKFLOW = "outbox.publish";
export const DELIVER_WORKFLOW = "outbox.deliver";
export const PUBLISH_SCHEDULE_NAME = "outbox.publish";
/** Cada 5 s (DBOS añade hasta medio segundo de margen): un evento sale en unos segundos. */
export const PUBLISH_SCHEDULE = "*/5 * * * * *";
export const EVENTS_QUEUE = "domain-events" satisfies DeliveryQueue;
/** La de los avisos (emails…): lo que espera a un servicio de fuera no frena a las demás entregas. */
export const NOTIFICATIONS_QUEUE = "notifications" satisfies DeliveryQueue;
export const PRUNE_WORKFLOW = "outbox.prune";
export const BACKFILL_WORKFLOW = "outbox.backfill";
export const PRUNE_SCHEDULE_NAME = "outbox.prune";
/** Cada hora, a los 7 minutos. */
export const PRUNE_SCHEDULE = "0 7 * * * *";
/** Las vueltas del publicador se guardan una hora, por si hay que mirar qué pasó. */
const PUBLISH_RETENTION_MS = 60 * 60 * 1000;
const PRUNE_PAGE = 1000;
const BATCH = 100;

/** El ID del relleno de un consumidor para un tipo: corre una vez en la vida de ese par. */
export function backfillWorkflowId(handlerKey: string, eventType: string, attempt = 1): string {
  const base = `backfill:${handlerKey}:${eventType}`;
  return attempt === 1 ? base : `${base}:intento-${attempt}`;
}

/** Cuántas veces se lanza como mucho el relleno de un par: el primero y dos más si terminan en error. */
export const MAX_BACKFILL_ATTEMPTS = 3;

/**
 * Qué intento de relleno toca, según el estado de los anteriores (null si no
 * existe): el primero que no exista, si todos los de antes terminaron en
 * ERROR. Ninguno si alguno terminó bien o sigue en marcha, si está aparcado
 * (CANCELLED o MAX_RECOVERY_ATTEMPTS_EXCEEDED: lo miran las personas, el mismo
 * criterio que la entrada de canales, workflow-status.ts) o si ya se agotaron.
 */
export function nextBackfillAttempt(statuses: readonly (string | null)[]): number | null {
  for (let i = 0; i < MAX_BACKFILL_ATTEMPTS; i += 1) {
    const status = statuses[i] ?? null;
    if (status === null) return i + 1;
    if (!isResumable(status)) return null;
  }
  return null;
}

/** Desde cuándo rellenaba el primer intento: los siguientes rellenan la misma ventana, no una más corta. */
async function firstAttemptSince(workflowID: string): Promise<string | null> {
  const [first] = await DBOS.listWorkflows({ workflowIDs: [workflowID], loadInput: true, loadOutput: false });
  const since = (first?.input?.[0] as Partial<BackfillInput> | undefined)?.since;
  return typeof since === "string" && !Number.isNaN(Date.parse(since)) ? since : null;
}

export interface BackfillInput {
  handler: string;
  type: string;
  /** Desde cuándo (ISO): fijado al lanzarlo, así una reanudación rellena la misma ventana. */
  since: string;
}

/** El ID de la entrega de un evento a un consumidor: el mismo cada vez que se encola. */
export function deliveryWorkflowId(eventId: string, handlerKey: string): string {
  return `event:${eventId}:${handlerKey}`;
}

export interface DeliveryInput {
  eventId: string;
  /** La organización de la fila del evento, tal como la leyó el publicador. */
  organizationId: string;
  handler: string;
}

export type DeliveryResult = "delivered" | "missing" | "unknown-handler" | "unknown-type";

export interface OutboxOptions {
  db: ServiceDb;
  registry: EventRegistry;
  logger: Logger;
}


interface EventRow {
  id: string;
  organization_id: string;
  location_id: string | null;
  type: string;
  payload: unknown;
  source_run_id: string | null;
  chain_depth: number;
  created_at: string;
}

async function loadEvent(tenant: TenantDb, eventId: string): Promise<EventRow | null> {
  const { data, error } = await tenant
    .from("domain_events")
    .select("id, organization_id, location_id, type, payload, source_run_id, chain_depth, created_at")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`no se pudo leer el evento (${error.code})`);
  return data;
}

/** Registra los dos workflows. Antes de DBOS.launch(): DBOS solo recupera lo que conoce. */
export function registerOutboxWorkflows({ db, registry, logger }: OutboxOptions) {
  const log = logger.child({ component: "outbox" });

  async function deliver(input: DeliveryInput): Promise<DeliveryResult> {
    const handler = registry.get(input.handler);
    if (!handler) {
      // Un consumidor que ya no existe en esta versión: no hay a quién entregar.
      log.error({ eventId: input.eventId, handler: input.handler }, "entrega a un consumidor que no existe");
      return "unknown-handler";
    }
    const tenant = db.forOrganization(input.organizationId);
    const row = await DBOS.runStep(() => loadEvent(tenant, input.eventId), { name: "load", ...DB_RUN_STEP });
    if (!row) {
      log.warn({ eventId: input.eventId, organizationId: input.organizationId }, "el evento no está en su organización");
      return "missing";
    }
    if (!isEventType(row.type)) {
      log.error({ eventId: row.id, type: row.type }, "evento de un tipo que no está en el catálogo");
      return "unknown-type";
    }
    const event: DomainEvent = {
      id: row.id,
      type: row.type,
      organizationId: row.organization_id,
      locationId: row.location_id,
      payload: parsePayload(row.type, row.payload),
      sourceRunId: row.source_run_id,
      chainDepth: row.chain_depth,
      createdAt: row.created_at,
    };
    await handler.handle(event, {
      db: tenant,
      logger: log.child({ eventId: event.id, type: event.type, organizationId: event.organizationId, handler: handler.key }),
      step: async (name, fn, retry) => {
        try {
          return await DBOS.runStep(fn, { name: `${handler.key}:${name}`, ...(retry ? { retriesAllowed: true, ...retry } : {}) });
        } catch (err) {
          if (err instanceof DBOSErrors.DBOSMaxStepRetriesError) throw new StepRetriesExhaustedError(`el paso ${name} agotó sus reintentos`, { cause: err });
          throw err;
        }
      },
    });
    return "delivered";
  }

  const deliverWorkflow = DBOS.registerWorkflow(deliver, { name: DELIVER_WORKFLOW });

  /**
   * Encola una entrega por consumidor suscrito, con el id determinista: si ya
   * estaba encolada (por el publicador o por la entrada de canales), DBOS
   * devuelve la que existe. Devuelve cuántas.
   */
  async function enqueueDelivery(event: { id: string; organizationId: string }, handler: EventHandler): Promise<void> {
    await DBOS.startWorkflow(deliverWorkflow, {
      workflowID: deliveryWorkflowId(event.id, handler.key),
      queueName: handler.queue ?? EVENTS_QUEUE,
      workflowIDReusePolicy: "return-existing",
    })({ eventId: event.id, organizationId: event.organizationId, handler: handler.key });
  }

  async function enqueueDeliveries(event: { id: string; organizationId: string; type: string }): Promise<number> {
    let deliveries = 0;
    for (const handler of registry.handlersFor(event.type)) {
      await enqueueDelivery(event, handler);
      deliveries += 1;
    }
    return deliveries;
  }

  // DBOS lo llama con la hora programada y un contexto; no usa ninguno de los dos.
  async function publish(): Promise<void> {
    const pending = await DBOS.runStep(() => db.outbox.pending(BATCH), { name: "pending", ...DB_RUN_STEP });
    if (pending.length === 0) return;
    let deliveries = 0;
    for (const event of pending) deliveries += await enqueueDeliveries(event);
    const published = await DBOS.runStep(() => db.outbox.markPublished(pending.map((event) => event.id)), {
      name: "mark-published",
      ...DB_RUN_STEP,
    });
    log.info({ events: pending.length, deliveries, published }, "eventos publicados");
  }

  const publishWorkflow = DBOS.registerWorkflow(publish, { name: PUBLISH_WORKFLOW });

  // Solo las vueltas que terminaron bien (las que fallan se quedan para
  // investigarlas) y sin sus hijas: las entregas no se borran.
  async function prune(): Promise<void> {
    const deleted = await DBOS.runStep(
      async () => {
        const completedBefore = new Date(Date.now() - PUBLISH_RETENTION_MS).toISOString();
        let total = 0;
        for (;;) {
          const old = await DBOS.listWorkflows({
            workflowName: [PUBLISH_WORKFLOW, PRUNE_WORKFLOW],
            status: "SUCCESS",
            completedBefore,
            limit: PRUNE_PAGE,
            loadInput: false,
            loadOutput: false,
          });
          if (old.length === 0) return total;
          await DBOS.deleteWorkflows(old.map((workflow) => workflow.workflowID));
          total += old.length;
          if (old.length < PRUNE_PAGE) return total;
        }
      },
      { name: "prune", ...DB_RUN_STEP },
    );
    if (deleted > 0) log.info({ deleted }, "vueltas terminadas del publicador borradas");
  }

  const pruneWorkflow = DBOS.registerWorkflow(prune, { name: PRUNE_WORKFLOW });

  // Solo a este consumidor (no a todos los del tipo): otro que llegó también
  // después pero no pidió relleno no recibe nada viejo. Devuelve cuántos encoló.
  async function backfill(input: BackfillInput): Promise<number> {
    const handler = registry.get(input.handler);
    if (!handler?.backfill) return 0;
    const since = new Date(input.since);
    let cursor: PublishedCursor | null = null;
    let enqueued = 0;
    for (let page = 0; ; page += 1) {
      const after: PublishedCursor | null = cursor;
      const events: PublishedDomainEvent[] = await DBOS.runStep(() => db.outbox.published(input.type, since, after, BATCH), { name: `page:${page}`, ...DB_RUN_STEP });
      for (const event of events) await enqueueDelivery(event, handler);
      enqueued += events.length;
      const last = events.at(-1);
      if (!last || events.length < BATCH) return enqueued;
      cursor = { createdAt: last.createdAt, id: last.id };
    }
  }

  const backfillWorkflow = DBOS.registerWorkflow(backfill, { name: BACKFILL_WORKFLOW });

  /**
   * Lanza los rellenos que falten, sin esperarlos: el worker arranca igual y
   * cada uno deja en el log cuántos encoló. Un par (consumidor, tipo) que ya
   * tiene su workflow, terminado o a medias (DBOS lo reanuda), no se repite.
   */
  async function startBackfills(now: Date = new Date()): Promise<void> {
    for (const handler of registry.all()) {
      if (!handler.backfill || handler.eventTypes === "*") continue;
      for (const type of handler.eventTypes) {
        // Un relleno que terminó en error se vuelve a lanzar con otro ID (hasta
        // MAX_BACKFILL_ATTEMPTS) y la misma ventana que el primero: lo ya
        // entregado no se repite, por el ID de entrega.
        const statuses: (string | null)[] = [];
        for (let i = 1; i <= MAX_BACKFILL_ATTEMPTS; i += 1) {
          const status = (await DBOS.getWorkflowStatus(backfillWorkflowId(handler.key, type, i)))?.status ?? null;
          statuses.push(status);
          if (status === null || !isResumable(status)) break;
        }
        const attempt = nextBackfillAttempt(statuses);
        if (attempt === null) {
          const last = statuses.at(-1);
          if (last && isParked(last)) {
            log.error({ handler: handler.key, type, status: last, attempt: statuses.length }, "backfill: aparcado, no se reintenta");
          } else if (last && isResumable(last)) {
            log.error({ handler: handler.key, type, attempts: MAX_BACKFILL_ATTEMPTS }, "backfill: agotó sus intentos");
          }
          continue;
        }
        const workflowID = backfillWorkflowId(handler.key, type, attempt);
        const since =
          (attempt > 1 ? await firstAttemptSince(backfillWorkflowId(handler.key, type, 1)) : null) ??
          new Date(now.getTime() - handler.backfill.maxAgeHours * 3_600_000).toISOString();
        if (attempt > 1) log.warn({ handler: handler.key, type, attempt }, "backfill: el anterior terminó en error, se vuelve a lanzar");
        const handle = await DBOS.startWorkflow(backfillWorkflow, { workflowID })({ handler: handler.key, type, since });
        void handle.getResult().then(
          (enqueued) => log.info({ handler: handler.key, type, enqueued }, `backfill: ${enqueued} eventos encolados`),
          (err: unknown) => log.error({ handler: handler.key, type, err }, "backfill: falló"),
        );
      }
    }
  }

  return { deliver: deliverWorkflow, publish: publishWorkflow, prune: pruneWorkflow, backfill: backfillWorkflow, enqueueDeliveries, startBackfills };
}

/** La cola de entregas y las programaciones viven en la base de datos: después de DBOS.launch(). */
export async function startOutbox(
  workflows: { publish: () => Promise<void>; prune: () => Promise<void> },
  /** Solo para tests: la programación del publicador (por defecto, PUBLISH_SCHEDULE). */
  publishSchedule: string = PUBLISH_SCHEDULE,
): Promise<void> {
  await DBOS.registerQueue(EVENTS_QUEUE, { workerConcurrency: 4 });
  await DBOS.registerQueue(NOTIFICATIONS_QUEUE, { workerConcurrency: 2 });
  await DBOS.applySchedules([
    { scheduleName: PUBLISH_SCHEDULE_NAME, workflowFn: workflows.publish, schedule: publishSchedule },
    { scheduleName: PRUNE_SCHEDULE_NAME, workflowFn: workflows.prune, schedule: PRUNE_SCHEDULE },
  ]);
}
