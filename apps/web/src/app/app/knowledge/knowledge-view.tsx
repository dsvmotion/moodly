"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableColumn } from "@repo/ui/components/data-table";
import { EmptyState } from "@repo/ui/components/empty-state";
import { PreviewAttributes, PreviewDrawer } from "@repo/ui/components/preview-drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { useRecordParam } from "@/components/records/use-record-param";
import { useTableLabels } from "@/components/records/use-table-labels";
import type { KnowledgeSourceRow, SourceStatus } from "./data";

/** Con la fecha ya escrita en el servidor («hace 5 minutos»): así no cambia al hidratar. */
export type KnowledgeViewRow = KnowledgeSourceRow & { updatedLabel: string };
import { CreateSourceForm, DeleteSourceButton, EditSourceForm } from "./source-forms";

// Conocimiento (B20-3): las fuentes en una tabla (P2), cada una en el panel
// lateral (P4) con su texto y, para el org_admin con aal2, editar y borrar.

const KNOWN_TYPES = ["faq", "pricing", "policy", "catalog", "document", "website", "human_answer"] as const;
const isKnownType = (value: string): value is (typeof KNOWN_TYPES)[number] => (KNOWN_TYPES as readonly string[]).includes(value);

const REFRESH_MS = 3000;
const REFRESH_TRIES = 40;

/** Mientras alguna fuente se indexa, vuelve a pedir la página (2 minutos como mucho): lo hace el worker. */
function IndexingRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > REFRESH_TRIES) clearInterval(timer);
      else router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const t = useTranslations("knowledgePage");
  return (
    <Badge
      variant={status === "ready" ? "outline" : "muted"}
      className={status === "error" ? "text-destructive" : undefined}
      data-testid="knowledge-status"
    >
      {t(`status.${status}`)}
    </Badge>
  );
}

export function KnowledgeView({
  rows,
  canAdminister,
  locations,
}: {
  rows: KnowledgeViewRow[];
  canAdminister: boolean;
  locations: { id: string; name: string }[];
}) {
  const t = useTranslations("knowledgePage");
  const tRecords = useTranslations("records");
  const labels = useTableLabels();
  const { selected, open, close } = useRecordParam(rows);
  const [creating, setCreating] = useState(false);
  const closeCreate = useCallback(() => setCreating(false), []);

  const typeLabel = useCallback((type: string) => (isKnownType(type) ? t(`types.${type}`) : type), [t]);
  const appliesTo = useCallback((row: KnowledgeViewRow) => row.location ?? t("wholeOrganization"), [t]);

  const columns = useMemo<DataTableColumn<KnowledgeViewRow>[]>(
    () => [
      {
        id: "title",
        header: t("fields.title"),
        value: (row) => row.title,
        enableHiding: false,
        cell: (row) => (
          <span className="font-medium" data-testid="knowledge-row-title">
            {row.title}
          </span>
        ),
      },
      { id: "type", header: t("fields.type"), value: (row) => typeLabel(row.type) },
      {
        id: "appliesTo",
        header: t("fields.appliesTo"),
        value: (row) => appliesTo(row),
        cell: (row) => <span data-testid="knowledge-row-location">{appliesTo(row)}</span>,
      },
      { id: "status", header: t("fields.status"), value: (row) => t(`status.${row.status}`), cell: (row) => <StatusBadge status={row.status} /> },
      { id: "updated", header: t("fields.updated"), value: (row) => row.updatedAt, cell: (row) => row.updatedLabel },
    ],
    [t, typeLabel, appliesTo],
  );

  const addButton = canAdminister ? (
    <Button onClick={() => setCreating(true)} data-testid="knowledge-add">
      {t("add")}
    </Button>
  ) : null;

  return (
    <>
      <IndexingRefresh active={rows.some((row) => row.status === "pending" || row.status === "processing")} />
      {rows.length === 0 ? (
        <EmptyState
          data-testid="knowledge-empty"
          title={t("emptyTitle")}
          description={canAdminister ? t("empty") : t("emptyReadOnly")}
          action={addButton}
        />
      ) : (
        <DataTable
          testId="knowledge-table"
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
        description={selected ? `${typeLabel(selected.type)} · ${appliesTo(selected)}` : undefined}
        closeLabel={tRecords("close")}
        footer={canAdminister && selected ? <DeleteSourceButton key={selected.id} id={selected.id} /> : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <PreviewAttributes
              items={[
                { label: t("fields.status"), value: <StatusBadge status={selected.status} /> },
                { label: t("fields.updated"), value: selected.updatedLabel },
              ]}
            />
            <p className="text-muted-foreground text-sm" data-testid="knowledge-status-help">
              {t(`statusHelp.${selected.status}`)}
            </p>
            {canAdminister ? (
              <EditSourceForm key={selected.id} id={selected.id} title={selected.title} body={selected.body ?? ""} />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words" data-testid="knowledge-body-text">
                {selected.body}
              </p>
            )}
          </div>
        ) : null}
      </PreviewDrawer>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent closeLabel={t("close")} data-testid="knowledge-create-sheet">
          <SheetHeader>
            <SheetTitle>{t("newTitle")}</SheetTitle>
            <SheetDescription>{t("newDescription")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateSourceForm locations={locations} onSaved={closeCreate} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
