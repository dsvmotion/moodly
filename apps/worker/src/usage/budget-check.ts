import type { TenantDb } from "@repo/db/service";
import type { Logger } from "pino";

// Los avisos del tope mensual (PL-ledger): después de anotar lo que costó un
// turno o una indexación, check_budget_thresholds mira si la organización acaba
// de pasar el 80 % o el 100 % del tope del mes y, una sola vez por mes y
// umbral, escribe el evento usage.budget_threshold (lo consume
// notify.budget_email). Es un aviso: si falla, se registra y no para nada.

/** Los umbrales de los que se acaba de avisar; [] si ninguno o si falló (registrado). */
export async function checkBudgetSafely(db: TenantDb, logger: Pick<Logger, "info" | "error">, fields: Record<string, unknown>): Promise<number[]> {
  try {
    const thresholds = await db.checkBudgetThresholds();
    if (thresholds.length > 0) logger.info({ ...fields, thresholds }, "tope del mes: umbral pasado, se avisa a los org_admin");
    return thresholds;
  } catch (err) {
    logger.error({ ...fields, error: err instanceof Error ? err.name : "Error" }, "no se pudo comprobar el tope del mes");
    return [];
  }
}
