"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import {
  GOAL_DIRECTIONS,
  GOAL_METRICS,
  GOAL_PERIODS,
  GOAL_STATUSES,
  goalMetric,
  targetValue,
  type GoalDirection,
  type GoalPeriod,
  type GoalStatus,
  type GoalTarget,
} from "@/lib/goals";
import { createGoal, deleteGoal, updateGoal } from "./actions";
import { TARGET_MAX, TITLE_MAX, type GoalFormState } from "./schema";

// Formularios de la pantalla de objetivos (OA19). Solo se enseñan a quien
// gestiona el alcance del objetivo; lo que se puede guardar lo decide la base
// de datos.

const initial: GoalFormState = { error: null, savedAt: null };
const fieldClass = "w-full rounded-md border border-input bg-background px-3 text-sm h-9";

function FormError({ error }: { error: GoalFormState["error"] }) {
  const t = useTranslations("goalsPage");
  if (!error) return null;
  return (
    <p role="alert" className="text-destructive text-sm" data-testid="goal-error">
      {t(`errors.${error}`)}
    </p>
  );
}

export interface GoalFieldValues {
  title: string;
  metricKey: string;
  direction: GoalDirection;
  targetValue: number | null;
  period: GoalPeriod;
  dueDate: string | null;
}

/** Título, métrica, meta, periodo y fecha límite (esta, solo con «una vez»). */
function GoalFields({ values, disabled }: { values?: GoalFieldValues; disabled: boolean }) {
  const t = useTranslations("goalsPage");
  const firstMetric = GOAL_METRICS[0];
  const [metricKey, setMetricKey] = useState(values?.metricKey ?? firstMetric.key);
  const [direction, setDirection] = useState<GoalDirection>(values?.direction ?? firstMetric.direction);
  const [period, setPeriod] = useState<GoalPeriod>(values?.period ?? "month");
  const unit = goalMetric(metricKey).unit;

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.title")}
        <Input name="title" required maxLength={TITLE_MAX} defaultValue={values?.title} disabled={disabled} data-testid="goal-title" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.metric")}
        <select
          name="metricKey"
          value={metricKey}
          onChange={(event) => {
            setMetricKey(event.target.value);
            // Cada métrica propone su sentido (citas: al menos; tiempo de respuesta: como mucho).
            setDirection(goalMetric(event.target.value).direction);
          }}
          disabled={disabled}
          className={fieldClass}
          data-testid="goal-metric"
        >
          {GOAL_METRICS.map((metric) => (
            <option key={metric.key} value={metric.key}>
              {t(`metrics.${metric.id}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.direction")}
          <select
            name="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as GoalDirection)}
            disabled={disabled}
            className={fieldClass}
            data-testid="goal-direction"
          >
            {GOAL_DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`directions.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t(`targetLabel.${unit}`)}
          <Input
            name="targetValue"
            required
            inputMode="decimal"
            pattern="\d+([.,]\d+)?"
            maxLength={String(TARGET_MAX).length + 4}
            defaultValue={values?.targetValue ?? undefined}
            disabled={disabled}
            data-testid="goal-target-value"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.period")}
          <select
            name="period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as GoalPeriod)}
            disabled={disabled}
            className={fieldClass}
            data-testid="goal-period"
          >
            {GOAL_PERIODS.map((value) => (
              <option key={value} value={value}>
                {t(`periods.${value}`)}
              </option>
            ))}
          </select>
        </label>
        {period === "once" ? (
          <label className="flex flex-col gap-1 text-sm">
            {t("fields.dueDate")}
            <Input type="date" name="dueDate" required defaultValue={values?.dueDate ?? undefined} disabled={disabled} data-testid="goal-due-date" />
          </label>
        ) : null}
      </div>
    </>
  );
}

/** Crear un objetivo en uno de los alcances que la persona gestiona. Se cierra al guardar (onSaved). */
export function CreateGoalForm({
  targets,
  defaultTarget,
  onSaved,
}: {
  targets: GoalTarget[];
  defaultTarget: string;
  onSaved: () => void;
}) {
  const t = useTranslations("goalsPage");
  const [state, action, pending] = useActionState(createGoal, initial);
  useEffect(() => {
    if (state.savedAt) onSaved();
  }, [state.savedAt, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-3" data-testid="goal-create-form">
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.appliesTo")}
        <select name="target" defaultValue={defaultTarget} disabled={pending} className={fieldClass} data-testid="goal-target">
          {targets.map((target) => (
            <option key={targetValue(target)} value={targetValue(target)}>
              {target.name ?? t("wholeOrganization")}
            </option>
          ))}
        </select>
      </label>
      <GoalFields disabled={pending} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="self-end" data-testid="goal-create">
        {t("create")}
      </Button>
    </form>
  );
}

/** Cambiar un objetivo. El alcance no cambia: para otro alcance se crea otro objetivo. */
export function EditGoalForm({ id, values, status }: { id: string; values: GoalFieldValues; status: GoalStatus }) {
  const t = useTranslations("goalsPage");
  const [state, action, pending] = useActionState(updateGoal, initial);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="goal-edit-form">
      <input type="hidden" name="id" value={id} />
      <GoalFields values={values} disabled={pending} />
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.status")}
        <select name="status" defaultValue={status} disabled={pending} className={fieldClass} data-testid="goal-status-select">
          {GOAL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`statuses.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <FormError error={state.error} />
      <div className="flex items-center justify-end gap-3">
        {state.savedAt && !pending ? (
          <span role="status" className="text-muted-foreground text-sm" data-testid="goal-saved">
            {t("saved")}
          </span>
        ) : null}
        <Button type="submit" disabled={pending} data-testid="goal-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Borrar, después de confirmarlo. */
export function DeleteGoalButton({ id }: { id: string }) {
  const t = useTranslations("goalsPage");
  const [state, action, pending] = useActionState(deleteGoal, initial);
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        trigger={
          <Button type="button" variant="outline" disabled={pending} data-testid="goal-delete">
            {t("delete")}
          </Button>
        }
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        variant="destructive"
        onConfirm={() => form.current?.requestSubmit()}
      />
      <FormError error={state.error} />
    </form>
  );
}
