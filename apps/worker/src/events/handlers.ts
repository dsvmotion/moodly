import type { TenantDb } from "@repo/db/service";
import type { Logger } from "pino";
import { isEventType, type EventType } from "./catalog.ts";

// Consumidores de eventos de dominio (ADR 0009). Cada suscripción es un
// workflow de entrega aparte (event:<id>:<key>), así que un consumidor que
// falla no frena a los demás y uno que se reanuda no repite lo que ya hizo.

export interface DomainEvent {
  id: string;
  type: EventType;
  /** De la fila del evento, nunca del payload (control 3.7). */
  organizationId: string;
  locationId: string | null;
  /** Validado con el esquema de su tipo (catalog.ts). */
  payload: Record<string, unknown>;
  sourceRunId: string | null;
  chainDepth: number;
  createdAt: string;
}

export interface EventContext {
  /** Los datos de la organización del evento: la de la fila. No hay otro acceso. */
  db: TenantDb;
  logger: Logger;
  /**
   * Un paso de la entrega (DBOS.runStep): su resultado se guarda y al reanudar
   * no se repite. Si se interrumpe a medias, se repite entero (regla 2): lo que
   * haga fuera de la base de datos tiene que ser idempotente.
   */
  step<T>(name: string, fn: () => Promise<T>, retry?: StepRetry): Promise<T>;
}

/**
 * Un paso con reintentos que siguió fallando en todos: lo lanza ctx.step en
 * lugar del error del motor, para que un consumidor distinga «agotó los
 * reintentos» de cualquier otro fallo sin depender de DBOS.
 */
export class StepRetriesExhaustedError extends Error {
  override readonly name = "StepRetriesExhaustedError";
}

/**
 * Las colas de entrega (ADR 0009). Cada consumidor va a una: la de eventos de
 * dominio, la de siempre, o la de avisos, para que lo que espera a un servicio
 * de fuera (un email con Resend caído) no ocupe los huecos de lo que contesta a
 * los clientes (message.received).
 */
export const DELIVERY_QUEUES = ["domain-events", "notifications"] as const;
export type DeliveryQueue = (typeof DELIVERY_QUEUES)[number];

/** Reintentos de un paso que lanza (DBOS): para lo que falla de forma pasajera, como un 5xx. */
export interface StepRetry {
  maxAttempts: number;
  intervalSeconds: number;
  backoffRate: number;
}

export interface EventHandler {
  /** Estable y único: forma parte del ID de cada entrega. Cambiarlo vuelve a entregar. */
  key: string;
  /** Los tipos que recibe, o "*" para todos. */
  eventTypes: readonly EventType[] | "*";
  /** La cola de sus entregas; "domain-events" si no se dice. */
  queue?: DeliveryQueue;
  /**
   * Corre dentro del workflow de entrega: entre paso y paso, solo lógica
   * determinista (lo mismo con las mismas entradas). Los efectos van en ctx.step.
   */
  handle(event: DomainEvent, ctx: EventContext): Promise<void>;
}

export interface EventRegistry {
  handlersFor(type: string): EventHandler[];
  get(key: string): EventHandler | undefined;
}

const HANDLER_KEY = /^[a-z][a-z0-9_.-]{0,62}$/;

export function createEventRegistry(handlers: readonly EventHandler[]): EventRegistry {
  const byKey = new Map<string, EventHandler>();
  for (const handler of handlers) {
    if (!HANDLER_KEY.test(handler.key)) throw new Error(`clave de consumidor no válida: ${handler.key}`);
    if (byKey.has(handler.key)) throw new Error(`consumidor repetido: ${handler.key}`);
    if (handler.queue !== undefined && !(DELIVERY_QUEUES as readonly string[]).includes(handler.queue)) {
      throw new Error(`el consumidor ${handler.key} usa una cola que no existe: ${handler.queue}`);
    }
    if (handler.eventTypes !== "*" && !handler.eventTypes.every(isEventType)) {
      throw new Error(`el consumidor ${handler.key} se suscribe a un tipo de evento que no está en el catálogo`);
    }
    byKey.set(handler.key, handler);
  }
  return {
    handlersFor: (type) =>
      [...byKey.values()].filter((handler) => handler.eventTypes === "*" || (handler.eventTypes as readonly string[]).includes(type)),
    get: (key) => byKey.get(key),
  };
}
