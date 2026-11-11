import { z } from "zod";
import { GOAL_DIRECTIONS, GOAL_METRIC_KEYS, GOAL_PERIODS, GOAL_STATUSES, goalMetric, METRIC_KEY_PATTERN, parseTargetValue } from "../../../lib/goals";

// Formas de entrada de la pantalla de objetivos (OA19, MANUAL §6.3). Solo
// validan la forma: quién puede escribir lo decide la base de datos (RLS de
// goals) y sus límites son los de los CHECK de la tabla (título de 1 a 200,
// fecha límite solo con el periodo «una vez»).

export const TITLE_MAX = 200;
/** Un tope razonable para un objetivo; el de la columna (numeric) es mucho mayor. */
export const TARGET_MAX = 1_000_000_000;

const title = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(TITLE_MAX));

/** El número que se escribe, con punto o coma decimal. */
const targetNumber = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .pipe(z.string().regex(/^\d+(\.\d+)?$/))
  .transform(Number)
  .pipe(z.number().finite().min(0).max(TARGET_MAX));

const fields = {
  title,
  metricKey: z.enum(GOAL_METRIC_KEYS),
  direction: z.enum(GOAL_DIRECTIONS),
  targetValue: targetNumber,
  period: z.enum(GOAL_PERIODS),
  /** Solo con «una vez»; con un periodo recurrente se descarta. */
  dueDate: z.union([z.iso.date(), z.literal("")]),
};

type Parsed = { metricKey: string; targetValue: number; period: string; dueDate: string };

function checkGoal(goal: Parsed, ctx: z.RefinementCtx) {
  if (goal.period === "once" && goal.dueDate === "") {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "due_date_required" });
  }
  if (goalMetric(goal.metricKey).unit === "percent" && goal.targetValue > 100) {
    ctx.addIssue({ code: "custom", path: ["targetValue"], message: "percent_over_100" });
  }
}

const dueDateFor = <T extends { period: string; dueDate: string }>(goal: T) => ({
  ...goal,
  dueDate: goal.period === "once" ? goal.dueDate : null,
});

export const createGoalSchema = z
  .object({
    target: z.string().transform((value, ctx) => {
      const parsed = parseTargetValue(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "invalid_target" });
        return z.NEVER;
      }
      return parsed;
    }),
    ...fields,
  })
  .superRefine(checkGoal)
  .transform(dueDateFor);

/**
 * Al cambiar, la métrica puede ser una fuera del catálogo con la forma de
 * metric_key: la que el objetivo ya tenía. Que sea esa (y no otra cualquiera)
 * lo comprueba la acción con la fila guardada.
 */
export const updateGoalSchema = z
  .object({
    id: z.uuid(),
    ...fields,
    metricKey: z.union([z.enum(GOAL_METRIC_KEYS), z.string().regex(METRIC_KEY_PATTERN)]),
    status: z.enum(GOAL_STATUSES),
  })
  .superRefine(checkGoal)
  .transform(dueDateFor);

export const deleteGoalSchema = z.object({ id: z.uuid() });

export interface GoalFormState {
  error: "invalid" | "not_allowed" | null;
  /** Cuándo se guardó: el formulario se cierra o avisa al cambiar. */
  savedAt: number | null;
}
