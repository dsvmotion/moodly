import { DBOS, type DLogger } from "@dbos-inc/dbos-sdk";
import { createServiceDb, type ServiceDb } from "@repo/db/service";
import type pg from "pg";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.ts";
import { createEventRegistry, type EventHandler } from "./events/handlers.ts";
import type { WorkerProbe, WorkerPhase } from "./health.ts";
import { registerOutboxWorkflows, startOutbox } from "./events/outbox.ts";
import { acquireExecutorLease, type ExecutorLease } from "./lease.ts";
import { redactConnectionStrings } from "./logger.ts";
import { registerSmokeQueue, registerSmokeWorkflow } from "./smoke.ts";
import { createSystemDatabasePool } from "./system-db-pool.ts";

// Arranque de DBOS con las reglas del ADR 0027. Los workflows se registran
// (DBOS.registerWorkflow) antes de start(): DBOS solo recupera los que conoce.

/** Nombre de la aplicación en el esquema dbos: acota sus workflows y colas. */
export const APPLICATION_NAME = "moodly-worker";

export interface Worker {
  /** Espera el lock de su executorID (regla 1) y arranca DBOS. */
  start(): Promise<void>;
  /** Para de aceptar trabajo y cierra las conexiones. Lo que quede a medias se reanuda al volver. */
  stop(): Promise<void>;
  /** Lo que mira el endpoint de salud (health.ts). */
  probe: WorkerProbe;
}

export interface WorkerOptions {
  /**
   * Se llama si se pierde el lock del executor con el worker en marcha. Quien
   * lo recibe debe parar el proceso enseguida: otro proceso con el mismo
   * executorID puede estar a punto de recuperar sus workflows.
   */
  onLeaseLost: (err: Error) => void;
  /** Cancela la espera del lock (SIGTERM antes de arrancar). */
  signal?: AbortSignal;
  /**
   * Los consumidores de eventos de dominio (ADR 0009). Todos los procesos de
   * una versión, los mismos. Como función, recibe el acceso a los datos del
   * worker: para los que registran workflows propios (los recordatorios).
   */
  eventHandlers: readonly EventHandler[] | ((services: WorkerServices) => readonly EventHandler[]);
}

/** Lo que el worker comparte con los consumidores que registran workflows propios. */
export interface WorkerServices {
  db: ServiceDb;
  logger: Logger;
}

// Los logs de DBOS salen por nuestro logger (ADR 0032), con la misma censura.
function dbosLogger(logger: Logger): DLogger {
  const child = logger.child({ component: "dbos" });
  const text = (entry: unknown) => redactConnectionStrings(typeof entry === "string" ? entry : String(entry));
  return {
    debug: (entry) => child.debug(text(entry)),
    info: (entry) => child.info(text(entry)),
    warn: (entry) => child.warn(text(entry)),
    error: (entry, metadata) => {
      const stack = metadata?.stack ? { stack: redactConnectionStrings(metadata.stack) } : {};
      child.error(stack, text(entry));
    },
  };
}

export function createWorker(config: WorkerConfig, logger: Logger, options: WorkerOptions): Worker {
  const db = createServiceDb({
    url: config.supabaseUrl,
    secretKey: config.supabaseSecretKey,
    workerDatabaseUrl: config.workerDatabaseUrl,
    // Solo el mensaje (redactado por si llevara la URL): nunca la conexión.
    onWorkerSqlError: (error) =>
      logger.warn({ reason: redactConnectionStrings(error.message) }, "error en una conexión libre de moodly_worker"),
  });
  // Antes de DBOS.launch(): un consumidor puede registrar aquí sus workflows.
  const handlers = typeof options.eventHandlers === "function" ? options.eventHandlers({ db, logger }) : options.eventHandlers;
  const registry = createEventRegistry(handlers);
  let lease: ExecutorLease | undefined;
  let pool: pg.Pool | undefined;
  let launched = false;
  let phase: WorkerPhase = "checking";
  return {
    probe: {
      phase: () => phase,
      async pingDatabase() {
        if (!pool) throw new Error("sin conexión a la base de datos de sistema");
        await pool.query("select 1");
      },
      oldestPendingEventAt: () => db.outbox.oldestPendingAt(),
    },
    async start() {
      // Antes del lock y de DBOS: sin moodly_worker, cada turno fallaría después
      // (ADR 0049). Si no entra, el worker no arranca y /health no dice «ok».
      try {
        await db.verifyWorkerConnection();
      } catch (err) {
        throw new Error(`WORKER_DATABASE_URL: no se pudo entrar como moodly_worker (${redactConnectionStrings((err as Error).message)})`, {
          cause: err,
        });
      }
      phase = "waiting-lease";
      lease = await acquireExecutorLease({
        connectionString: config.systemDatabaseUrl,
        executorId: config.executorId,
        logger,
        onLost: options.onLeaseLost,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      phase = "launching";
      registerSmokeWorkflow();
      const outbox = registerOutboxWorkflows({ db, registry, logger });
      // El pool es nuestro y no de DBOS por un fallo de DBOS 5.3.0 con pg 9
      // (system-db-pool.ts). La URL se le sigue pasando: DBOS la usa (sin
      // contraseña) en su log de arranque y en sus mensajes de error.
      pool = createSystemDatabasePool({
        connectionString: config.systemDatabaseUrl,
        applicationName: `dbos_transact_${config.executorId}_${config.applicationVersion}`,
        logger,
      });
      DBOS.setConfig({
        name: APPLICATION_NAME,
        systemDatabaseUrl: config.systemDatabaseUrl,
        systemDatabasePool: pool,
        systemDatabaseSchemaName: "dbos",
        // Regla 6: el esquema lo migra el CI. Si falta o está atrasado, DBOS no
        // arranca (DBOSInitializationError) en vez de intentar crearlo.
        runMigrations: false,
        // Reglas 1 y 7: explícitos, nunca los que DBOS deduce.
        executorID: config.executorId,
        applicationVersion: config.applicationVersion,
        logger: dbosLogger(logger),
        // Sin OTLP ni panel gestionado (Conductor): con datos de clientes no se
        // usa ningún servicio de DBOS (ADR 0027).
        enableOTLP: false,
      });
      await DBOS.launch();
      launched = true;
      // La versión desplegada es la vigente, también al volver a una anterior.
      // DBOS manda los workflows programados (el publicador del outbox) a la
      // última versión registrada y un worker de otra versión no los recoge: sin
      // esto, tras una vuelta atrás el outbox se pararía. Antes de las colas: su
      // configuración solo la actualiza la última versión.
      await DBOS.setLatestApplicationVersion(config.applicationVersion);
      await registerSmokeQueue();
      await startOutbox(outbox);
      phase = "running";
      logger.info(
        {
          executorId: config.executorId,
          applicationVersion: config.applicationVersion,
          gitCommit: config.gitCommit,
        },
        "worker arrancado",
      );
    },
    async stop() {
      phase = "stopping";
      // DBOS primero: el lock se suelta cuando ya no queda nada en marcha. Su
      // pool lo cerramos nosotros (DBOS no cierra uno que no ha creado).
      if (launched) await DBOS.shutdown();
      await pool?.end();
      await db.end();
      await lease?.release();
      logger.info({ executorId: config.executorId }, "worker parado");
    },
  };
}
