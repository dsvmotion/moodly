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
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

export interface EventHandler {
  /** Estable y único: forma parte del ID de cada entrega. Cambiarlo vuelve a entregar. */
  key: string;
  /** Los tipos que recibe, o "*" para todos. */
  eventTypes: readonly EventType[] | "*";
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
