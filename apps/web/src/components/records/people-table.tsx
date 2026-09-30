"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@repo/ui/components/badge";
import { DataTable, type DataTableColumn } from "@repo/ui/components/data-table";
import { PreviewAttributes, PreviewDrawer } from "@repo/ui/components/preview-drawer";
import { useRecordParam } from "./use-record-param";
import { useTableLabels } from "./use-table-labels";

export interface PersonRow {
  id: string;
  name: string | null;
  role: string;
  /** Nombres de regiones y locales de su alcance que el usuario puede ver. */
  scope: string[];
}

const ROLE_KEYS = ["org_admin", "region_manager", "location_manager", "staff"] as const;

/** Registros → Personas (P2) con vista previa lateral (P4). */
export function PeopleTable({ rows }: { rows: PersonRow[] }) {
  const t = useTranslations("records");
  const labels = useTableLabels();
  const { selected, open, close } = useRecordParam(rows);
  const role = (value: string) => ((ROLE_KEYS as readonly string[]).includes(value) ? t(`roles.${value}`) : value);
  const name = (row: PersonRow) => row.name ?? t("people.noName");
  const scope = (row: PersonRow) => (row.role === "org_admin" ? t("people.wholeOrganization") : row.scope.join(", "));

  const columns = useMemo<DataTableColumn<PersonRow>[]>(
    () => [
      { id: "name", header: t("people.name"), value: name, enableHiding: false, cell: (row) => <span className="font-medium">{name(row)}</span> },
      { id: "role", header: t("people.role"), value: (row) => role(row.role), cell: (row) => <Badge variant="outline">{role(row.role)}</Badge> },
      { id: "scope", header: t("people.scope"), value: scope },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t y los formateadores son estables por idioma
    [t],
  );

  return (
    <>
      <DataTable
        testId="people-table"
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        rowLabel={name}
        onRowOpen={open}
        labels={labels}
      />
      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={selected ? name(selected) : ""}
        description={selected ? role(selected.role) : undefined}
        closeLabel={t("close")}
      >
        {selected ? (
          <PreviewAttributes
            items={[
              { label: t("people.role"), value: role(selected.role) },
              { label: t("people.scope"), value: scope(selected) },
            ]}
          />
        ) : null}
      </PreviewDrawer>
    </>
  );
}
