import { DEFAULT_MODEL_BY_TASK, MODEL_KEYS, MODEL_TASKS } from "@repo/config";
import { z } from "zod";
import { PLATFORM_MODEL_POLICY } from "./router.js";
import type { ModelPolicy } from "./router.js";

// La política de una organización tal como la guarda public.org_model_settings
// (ADR 0034/0035), convertida en la ModelPolicy del enrutador. Sin fila, la de
// plataforma. Se valida otra vez aquí aunque la base de datos ya la valide: si
// algo no cuadra, el enrutador no adivina, falla.

const settingsRow = z.object({
  residency: z.enum(["any", "eu"]),
  allowed_providers: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,39}$/)).max(20),
  model_by_task: z.partialRecord(z.enum(MODEL_TASKS), z.enum(MODEL_KEYS)),
  connection: z.enum(["managed", "byok", "customer_cloud"]),
  // numeric de Postgres llega como texto por PostgREST.
  budget_per_run_eur: z.coerce.number().positive(),
  budget_per_day_eur: z.coerce.number().positive(),
});

export type ModelSettingsRow = z.input<typeof settingsRow>;

export class InvalidModelSettingsError extends Error {
  override name = "InvalidModelSettingsError";
}

export function policyFromSettings(row: unknown): ModelPolicy {
  if (row === null || row === undefined) return PLATFORM_MODEL_POLICY;
  const parsed = settingsRow.safeParse(row);
  if (!parsed.success) throw new InvalidModelSettingsError(`org_model_settings no válida: ${parsed.error.message}`);
  const settings = parsed.data;
  return {
    residency: settings.residency,
    allowedProviders: settings.allowed_providers,
    modelByTask: { ...DEFAULT_MODEL_BY_TASK, ...settings.model_by_task },
    connection: settings.connection,
    budget: { perRunEur: settings.budget_per_run_eur, perDayEur: settings.budget_per_day_eur },
  };
}
