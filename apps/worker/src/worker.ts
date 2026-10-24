import { DBOS, type DLogger } from "@dbos-inc/dbos-sdk";
import { createServiceDb } from "@repo/db/service";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.ts";
import { createEventRegistry, type EventHandler } from "./events/handlers.ts";
import { registerOutboxWorkflows, startOutbox } from "./events/outbox.ts";
import { acquireExecutorLease, type ExecutorLease } from "./lease.ts";
import { redactConnectionStrings } from "./logger.ts";
import { registerSmokeQueue, registerSmokeWorkflow } from "./smoke.ts";

// Arranque de DBOS con las reglas del ADR 0027. Los workflows se registran
// (DBOS.registerWorkflow) antes de start(): DBOS solo recupera los que conoce.

/** Nombre de la aplicación en el esquema dbos: acota sus workflows y colas. */
export const APPLICATION_NAME = "moodly-worker";

export interface Worker {
  /** Espera el lock de su executorID (regla 1) y arranca DBOS. */
  start(): Promise<void>;
  /** Para de aceptar trabajo y cierra las conexiones. Lo que quede a medias se reanuda al volver. */
  stop(): Promise<void>;
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
  /** Los consumidores de eventos de dominio (ADR 0009). Todos los procesos de una versión, los mismos. */
  eventHandlers: readonly EventHandler[];
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
  const registry = createEventRegistry(options.eventHandlers);
  const db = createServiceDb({ url: config.supabaseUrl, secretKey: config.supabaseSecretKey });
  let lease: ExecutorLease | undefined;
  let launched = false;
  return {
    async start() {
      lease = await acquireExecutorLease({
        connectionString: config.systemDatabaseUrl,
        executorId: config.executorId,
        logger,
        onLost: options.onLeaseLost,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      registerSmokeWorkflow();
      const outbox = registerOutboxWorkflows({ db, registry, logger });
      DBOS.setConfig({
        name: APPLICATION_NAME,
        systemDatabaseUrl: config.systemDatabaseUrl,
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
      // DBOS primero: el lock se suelta cuando ya no queda nada en marcha.
      if (launched) await DBOS.shutdown();
      await lease?.release();
      logger.info({ executorId: config.executorId }, "worker parado");
    },
  };
}
