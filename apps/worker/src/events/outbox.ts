import { DBOS } from "@dbos-inc/dbos-sdk";
import type { ServiceDb, TenantDb } from "@repo/db/service";
import type { Logger } from "pino";
import { isEventType, parsePayload } from "./catalog.ts";
import type { DomainEvent, EventRegistry } from "./handlers.ts";

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

export const PUBLISH_WORKFLOW = "outbox.publish";
export const DELIVER_WORKFLOW = "outbox.deliver";
export const PUBLISH_SCHEDULE_NAME = "outbox.publish";
/** Cada 5 s (DBOS añade hasta medio segundo de margen): un evento sale en unos segundos. */
export const PUBLISH_SCHEDULE = "*/5 * * * * *";
export const EVENTS_QUEUE = "domain-events";
export const PRUNE_WORKFLOW = "outbox.prune";
export const PRUNE_SCHEDULE_NAME = "outbox.prune";
/** Cada hora, a los 7 minutos. */
export const PRUNE_SCHEDULE = "0 7 * * * *";
/** Las vueltas del publicador se guardan una hora, por si hay que mirar qué pasó. */
const PUBLISH_RETENTION_MS = 60 * 60 * 1000;
const PRUNE_PAGE = 1000;
const BATCH = 100;

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

// Lecturas de la base de datos: reintentos cortos, por si PostgREST falla un momento.
const DB_STEP = { retriesAllowed: true, maxAttempts: 4, intervalSeconds: 1, backoffRate: 2 } as const;

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
    const row = await DBOS.runStep(() => loadEvent(tenant, input.eventId), { name: "load", ...DB_STEP });
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
      step: (name, fn) => DBOS.runStep(fn, { name: `${handler.key}:${name}` }),
    });
    return "delivered";
  }

  const deliverWorkflow = DBOS.registerWorkflow(deliver, { name: DELIVER_WORKFLOW });

  // DBOS lo llama con la hora programada y un contexto; no usa ninguno de los dos.
  async function publish(): Promise<void> {
    const pending = await DBOS.runStep(() => db.outbox.pending(BATCH), { name: "pending", ...DB_STEP });
    if (pending.length === 0) return;
    let deliveries = 0;
    for (const event of pending) {
      for (const handler of registry.handlersFor(event.type)) {
        await DBOS.startWorkflow(deliverWorkflow, {
          workflowID: deliveryWorkflowId(event.id, handler.key),
          queueName: EVENTS_QUEUE,
          workflowIDReusePolicy: "return-existing",
        })({ eventId: event.id, organizationId: event.organizationId, handler: handler.key });
        deliveries += 1;
      }
    }
    const published = await DBOS.runStep(() => db.outbox.markPublished(pending.map((event) => event.id)), {
      name: "mark-published",
      ...DB_STEP,
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
      { name: "prune", ...DB_STEP },
    );
    if (deleted > 0) log.info({ deleted }, "vueltas terminadas del publicador borradas");
  }

  const pruneWorkflow = DBOS.registerWorkflow(prune, { name: PRUNE_WORKFLOW });
  return { deliver: deliverWorkflow, publish: publishWorkflow, prune: pruneWorkflow };
}

/** La cola de entregas y las programaciones viven en la base de datos: después de DBOS.launch(). */
export async function startOutbox(workflows: { publish: () => Promise<void>; prune: () => Promise<void> }): Promise<void> {
  await DBOS.registerQueue(EVENTS_QUEUE, { workerConcurrency: 4 });
  await DBOS.applySchedules([
    { scheduleName: PUBLISH_SCHEDULE_NAME, workflowFn: workflows.publish, schedule: PUBLISH_SCHEDULE },
    { scheduleName: PRUNE_SCHEDULE_NAME, workflowFn: workflows.prune, schedule: PRUNE_SCHEDULE },
  ]);
}
