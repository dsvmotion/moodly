import { DBOS, type DLogger } from "@dbos-inc/dbos-sdk";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.ts";
import { redactConnectionStrings } from "./logger.ts";

// Arranque de DBOS con las reglas del ADR 0027. Los workflows se registran
// (DBOS.registerWorkflow) antes de start(): DBOS solo recupera los que conoce.

/** Nombre de la aplicación en el esquema dbos: acota sus workflows y colas. */
export const APPLICATION_NAME = "moodly-worker";

export interface Worker {
  start(): Promise<void>;
  /** Para de aceptar trabajo y cierra las conexiones. Lo que quede a medias se reanuda al volver. */
  stop(): Promise<void>;
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

export function createWorker(config: WorkerConfig, logger: Logger): Worker {
  return {
    async start() {
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
      logger.info(
        { executorId: config.executorId, applicationVersion: config.applicationVersion },
        "worker arrancado",
      );
    },
    async stop() {
      await DBOS.shutdown();
      logger.info({ executorId: config.executorId }, "worker parado");
    },
  };
}
