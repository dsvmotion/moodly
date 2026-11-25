import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Logger } from "pino";

// Salud del worker para el healthcheck de Railway y para la alerta de staging
// (PL-health). Barato y sin secretos. El endpoint puede ser público, así que el
// cuerpo lleva solo `status`; el detalle (fase, comprobaciones, edad del outbox)
// va al log, donde ya están la versión y el commit.
//
// «starting» (esperando el lock del executor o arrancando DBOS) responde 200, y
// no por descuido: durante un despliegue, el contenedor nuevo espera a que el
// viejo suelte el lock (lease.ts), y Railway no para el viejo hasta que el nuevo
// está sano. Si «starting» diera 503, el despliegue nunca terminaría. El 200 de
// «ok» solo llega con DBOS lanzado.
//
// Antes, «checking» (comprobar que entra como moodly_worker, ADR 0049) responde
// 503 «starting»: si esa comprobación falla, el proceso sale y Railway no da por
// sano el contenedor nuevo, así que no para el viejo. Dura lo que una conexión.

export type WorkerPhase = "checking" | "waiting-lease" | "launching" | "running" | "stopping";

export interface WorkerProbe {
  phase(): WorkerPhase;
  /** Una consulta trivial a la base de datos de sistema de DBOS. Lanza si no responde. */
  pingDatabase(): Promise<void>;
  /** Hora de creación del evento del outbox más antiguo sin publicar, o null. */
  oldestPendingEventAt(): Promise<Date | null>;
  /**
   * Cuántos rellenos del outbox (W3) están aparcados ahora (CANCELLED o
   * MAX_RECOVERY_ATTEMPTS_EXCEEDED): no se reintentan solos y lo que tenían que
   * entregar no llega hasta que una persona los reanude. Sin él, no se mira.
   */
  parkedBackfills?(): Promise<number>;
}

export interface HealthOptions {
  probe: WorkerProbe;
  /** Por encima de esta edad, el publicador del outbox se da por atascado. */
  maxOutboxAgeMs?: number;
  /** Tope de cada comprobación contra la base de datos. */
  probeTimeoutMs?: number;
  /** El resultado se reutiliza este tiempo: un sondeo frecuente no multiplica las consultas. */
  cacheMs?: number;
  now?: () => number;
}

type Check = "ok" | "fail";

export interface HealthReport {
  status: "ok" | "starting" | "degraded" | "stopping";
}

/** Lo que va al log, nunca a la respuesta. */
export interface HealthDetail {
  phase: WorkerPhase;
  checks?: { database: Check; dbos: Check; outbox: Check; backfill?: Check };
  /** Edad del evento sin publicar más antiguo, en segundos (0 si no hay). */
  outboxOldestPendingSeconds?: number;
  /** Rellenos del outbox aparcados (solo si el probe los mira y se pudieron leer). */
  parkedBackfills?: number;
}

export interface HealthResult {
  httpStatus: 200 | 503;
  body: HealthReport;
  detail: HealthDetail;
}

export const DEFAULT_MAX_OUTBOX_AGE_MS = 120_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tiempo agotado")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error("fallo"));
      },
    );
  });
}

export async function evaluateHealth(options: HealthOptions): Promise<HealthResult> {
  const { probe } = options;
  const maxAge = options.maxOutboxAgeMs ?? DEFAULT_MAX_OUTBOX_AGE_MS;
  const timeout = options.probeTimeoutMs ?? 3_000;
  const now = options.now ?? Date.now;
  const phase = probe.phase();
  if (phase === "stopping") return { httpStatus: 503, body: { status: "stopping" }, detail: { phase } };
  if (phase === "checking") return { httpStatus: 503, body: { status: "starting" }, detail: { phase } };
  if (phase !== "running") return { httpStatus: 200, body: { status: "starting" }, detail: { phase } };

  const watchesBackfills = probe.parkedBackfills !== undefined;
  const [database, outbox, parked] = await Promise.allSettled([
    withTimeout(probe.pingDatabase(), timeout),
    withTimeout(probe.oldestPendingEventAt(), timeout),
    probe.parkedBackfills ? withTimeout(probe.parkedBackfills(), timeout) : Promise.resolve(null),
  ]);
  const oldest = outbox.status === "fulfilled" ? outbox.value : null;
  const ageMs = oldest ? Math.max(0, now() - oldest.getTime()) : 0;
  const checks = {
    database: database.status === "fulfilled" ? "ok" : "fail",
    // La fase «running» es DBOS lanzado; no se vuelve a «running» sin lanzarlo.
    dbos: "ok",
    outbox: outbox.status === "fulfilled" && ageMs <= maxAge ? "ok" : "fail",
    // Un relleno aparcado no se arregla solo: degraded hasta que lo reanuden.
    ...(watchesBackfills ? { backfill: (parked.status === "fulfilled" && parked.value === 0 ? "ok" : "fail") as Check } : {}),
  } as const;
  const healthy = checks.database === "ok" && checks.dbos === "ok" && checks.outbox === "ok" && checks.backfill !== "fail";
  return {
    httpStatus: healthy ? 200 : 503,
    body: { status: healthy ? "ok" : "degraded" },
    detail: {
      phase,
      checks,
      ...(outbox.status === "fulfilled" ? { outboxOldestPendingSeconds: Math.floor(ageMs / 1000) } : {}),
      ...(watchesBackfills && parked.status === "fulfilled" && parked.value !== null ? { parkedBackfills: parked.value } : {}),
    },
  };
}

/** El prefijo de la entrada de canales (ADR 0052 §2), que comparte este puerto. */
export const CHANNELS_PREFIX = "/channels/";
/** El prefijo de los webhooks de las plataformas (O-02: /webhooks/nango), con el mismo esquema que los canales. */
export const WEBHOOKS_PREFIX = "/webhooks/";

type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

/**
 * Servidor HTTP mínimo: GET/HEAD /health y, si se dan, la entrada de canales
 * bajo /channels/ y los webhooks bajo /webhooks/ (Railway publica un solo
 * puerto por servicio). Cualquier otra ruta, 404. /health no cambia por
 * llevarlos: solo {status}.
 */
export function createHealthServer(
  options: HealthOptions & { logger: Logger; channels?: RequestHandler; webhooks?: RequestHandler },
): Server {
  const cacheMs = options.cacheMs ?? 10_000;
  const now = options.now ?? Date.now;
  let cached: { at: number; result: Promise<HealthResult> } | undefined;

  function current(): Promise<HealthResult> {
    // Las fases «no running» son baratas y cambian rápido: no se guardan.
    if (options.probe.phase() !== "running") return evaluateHealth(options);
    if (!cached || now() - cached.at >= cacheMs) {
      cached = { at: now(), result: evaluateHealth(options) };
    }
    return cached.result;
  }

  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://worker.internal");
    if (options.channels && url.pathname.startsWith(CHANNELS_PREFIX)) {
      options.channels(req, res);
      return;
    }
    if (options.webhooks && url.pathname.startsWith(WEBHOOKS_PREFIX)) {
      options.webhooks(req, res);
      return;
    }
    if ((req.method !== "GET" && req.method !== "HEAD") || url.pathname !== "/health") {
      res.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" }).end('{"error":"not_found"}');
      return;
    }
    current().then(
      ({ httpStatus, body, detail }) => {
        // El detalle de un fallo, al log: la respuesta no lo lleva.
        if (body.status === "degraded") options.logger.warn({ ...detail }, "salud del worker degradada");
        res
          .writeHead(httpStatus, { "content-type": "application/json", "cache-control": "no-store" })
          .end(req.method === "HEAD" ? undefined : JSON.stringify(body));
      },
      (err: unknown) => {
        options.logger.error({ err }, "la comprobación de salud falló");
        res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" }).end('{"status":"degraded"}');
      },
    );
  });
}
