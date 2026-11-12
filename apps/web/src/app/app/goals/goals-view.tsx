"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableColumn } from "@repo/ui/components/data-table";
import { EmptyState } from "@repo/ui/components/empty-state";
import { PreviewAttributes, PreviewDrawer } from "@repo/ui/components/preview-drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { useRecordParam } from "@/components/records/use-record-param";
import { useTableLabels } from "@/components/records/use-table-labels";
import { goalMetric, type GoalStatus, type GoalTarget } from "@/lib/goals";
import type { GoalRow } from "./data";
import { CreateGoalForm, DeleteGoalButton, EditGoalForm } from "./goal-forms";

// Objetivos (OA19): en una tabla (P2), cada uno en el panel lateral (P4) con lo
// que mide y, para quien gestiona su alcance, cambiarlo y borrarlo. Crear, en
// una hoja lateral con los alcances que la persona gestiona.

export type GoalViewRow = GoalRow & {
  /** El nombre de la región o el local; null: toda la organización. */
  appliesTo: string | null;
  canManage: boolean;
};

function StatusBadge({ status }: { status: GoalStatus }) {
  const t = useTranslations("goalsPage");
  return (
    <Badge variant={status === "active" ? "outline" : "muted"} data-testid="goal-status">
      {t(`statuses.${status}`)}
    </Badge>
  );
}

/** «Al menos 40 citas al mes», «Como mucho 15 min a la semana», «Al menos 80 % antes del 31/12/26». */
function useTargetLabel() {
  const t = useTranslations("goalsPage");
  const format = useFormatter();
  return useCallback(
    (row: GoalRow) => {
      const value = t(`units.${goalMetric(row.metricKey).unit}`, { value: format.number(row.targetValue) });
      // La fecha límite es un día, no un instante: se escribe tal cual, sin cambiar de zona.
      const due = row.dueDate ? format.dateTime(new Date(`${row.dueDate}T00:00:00Z`), { dateStyle: "short", timeZone: "UTC" }) : "";
      return `${t(`directions.${row.direction}`)} ${value} ${t(`periodSuffix.${row.period}`, { date: due })}`;
    },
    [t, format],
  );
}

export function GoalsView({ rows, targets, defaultTarget }: { rows: GoalViewRow[]; targets: GoalTarget[]; defaultTarget: string }) {
  const t = useTranslations("goalsPage");
  const tRecords = useTranslations("records");
  const format = useFormatter();
  const labels = useTableLabels();
  const { selected, open, close } = useRecordParam(rows);
  const [creating, setCreating] = useState(false);
  const closeCreate = useCallback(() => setCreating(false), []);
  const targetLabel = useTargetLabel();

  const appliesTo = useCallback((row: GoalViewRow) => row.appliesTo ?? t("wholeOrganization"), [t]);
  const metricLabel = useCallback(
    (key: string) => {
      const metric = goalMetric(key);
      return metric.id ? t(`metrics.${metric.id}`) : key;
    },
    [t],
  );
  const day = useCallback(
    (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }),
    [format],
  );

  const columns = useMemo<DataTableColumn<GoalViewRow>[]>(
    () => [
      {
        id: "title",
        header: t("fields.title"),
        value: (row) => row.title,
        enableHiding: false,
        cell: (row) => (
          <span className="font-medium" data-testid="goal-row-title">
            {row.title}
          </span>
        ),
      },
      {
        id: "appliesTo",
        header: t("fields.appliesTo"),
        value: (row) => appliesTo(row),
        cell: (row) => <span data-testid="goal-row-applies-to">{appliesTo(row)}</span>,
      },
      { id: "metric", header: t("fields.metric"), value: (row) => metricLabel(row.metricKey) },
      {
        id: "target",
        header: t("fields.target"),
        value: (row) => targetLabel(row),
        cell: (row) => <span data-testid="goal-row-target">{targetLabel(row)}</span>,
      },
      { id: "status", header: t("fields.status"), value: (row) => t(`statuses.${row.status}`), cell: (row) => <StatusBadge status={row.status} /> },
    ],
    [t, appliesTo, metricLabel, targetLabel],
  );

  const addButton =
    targets.length > 0 ? (
      <Button onClick={() => setCreating(true)} data-testid="goal-add">
        {t("add")}
      </Button>
    ) : null;

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          data-testid="goals-empty"
          title={t("emptyTitle")}
          description={targets.length > 0 ? t("empty") : t("emptyReadOnly")}
          action={addButton}
        />
      ) : (
        <DataTable
          testId="goals-table"
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowLabel={(row) => row.title}
          onRowOpen={open}
          enableSelection={false}
          labels={labels}
          toolbar={addButton}
        />
      )}

      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={selected?.title ?? ""}
        description={selected ? `${metricLabel(selected.metricKey)} · ${appliesTo(selected)}` : undefined}
        closeLabel={tRecords("close")}
        footer={selected?.canManage ? <DeleteGoalButton key={selected.id} id={selected.id} /> : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <PreviewAttributes
              items={[
                { label: t("fields.target"), value: <span data-testid="goal-detail-target">{targetLabel(selected)}</span> },
                { label: t("fields.startsOn"), value: day(selected.startsOn) },
                { label: t("fields.status"), value: <StatusBadge status={selected.status} /> },
              ]}
            />
            <p className="text-muted-foreground text-sm" data-testid="goal-progress-help">
              {t("progressHelp")}
            </p>
            {selected.canManage ? (
              <EditGoalForm
                key={selected.id}
                id={selected.id}
                status={selected.status}
                values={{
                  title: selected.title,
                  metricKey: selected.metricKey,
                  direction: selected.direction,
                  targetValue: selected.targetValue,
                  period: selected.period,
                  dueDate: selected.dueDate,
                }}
              />
            ) : (
              <p className="text-muted-foreground text-sm" data-testid="goal-read-only">
                {t("readOnly")}
              </p>
            )}
          </div>
        ) : null}
      </PreviewDrawer>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent closeLabel={t("close")} data-testid="goal-create-sheet">
          <SheetHeader>
            <SheetTitle>{t("newTitle")}</SheetTitle>
            <SheetDescription>{t("newDescription")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateGoalForm targets={targets} defaultTarget={defaultTarget} onSaved={closeCreate} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
