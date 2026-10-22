import "server-only";
import { logSecurityEvent, type SecurityEvent, type SecurityEventFields } from "./events-core";
import { createLogger } from "./logger-core";

/** Logger de la app (servidor). JSON a stdout; ver logger-core.ts. */
export const logger = createLogger();

export function securityEvent(event: SecurityEvent, fields?: SecurityEventFields): void {
  logSecurityEvent(logger, event, fields);
}
