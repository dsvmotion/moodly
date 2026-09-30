"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@repo/ui/components/badge";
import { DataTable, type DataTableColumn } from "@repo/ui/components/data-table";
import { PreviewAttributes, PreviewDrawer } from "@repo/ui/components/preview-drawer";
import { summarizeOpeningHours } from "@/lib/records";
import { useRecordParam } from "./use-record-param";
import { useTableLabels } from "./use-table-labels";

export interface LocationRow {
  id: string;
  name: string;
  region: string | null;
  status: string;
  timezone: string;
  address: string | null;
  openingHours: unknown;
  people: string[];
}

/** Registros → Locales (P2) con vista previa lateral (P4). */
export function LocationsTable({ rows }: { rows: LocationRow[] }) {
  const t = useTranslations("records");
  const labels = useTableLabels();
  const { selected, open, close } = useRecordParam(rows);
  const status = (value: string) => (value === "active" || value === "inactive" ? t(`status.${value}`) : value);

  const columns = useMemo<DataTableColumn<LocationRow>[]>(
    () => [
      { id: "name", header: t("locations.name"), value: (row) => row.name, enableHiding: false, cell: (row) => <span className="font-medium">{row.name}</span> },
      { id: "region", header: t("locations.region"), value: (row) => row.region ?? t("locations.noRegion") },
      {
        id: "status",
        header: t("locations.status"),
        value: (row) => status(row.status),
        cell: (row) => <Badge variant={row.status === "active" ? "outline" : "muted"}>{status(row.status)}</Badge>,
      },
      { id: "timezone", header: t("locations.timezone"), value: (row) => row.timezone },
      { id: "address", header: t("locations.address"), value: (row) => row.address ?? "" },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t y status son estables por idioma
    [t],
  );

  return (
    <>
      <DataTable
        testId="locations-table"
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        rowLabel={(row) => row.name}
        onRowOpen={open}
        labels={labels}
      />
      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={selected?.name ?? ""}
        description={selected?.region ?? t("locations.noRegion")}
        closeLabel={t("close")}
      >
        {selected ? (
          <PreviewAttributes
            items={[
              { label: t("locations.region"), value: selected.region ?? t("locations.noRegion") },
              { label: t("locations.status"), value: status(selected.status) },
              { label: t("locations.timezone"), value: selected.timezone },
              { label: t("locations.address"), value: selected.address ?? t("locations.noAddress") },
              {
                label: t("locations.openingHours"),
                value:
                  summarizeOpeningHours(selected.openingHours, {
                    mon: t("days.mon"),
                    tue: t("days.tue"),
                    wed: t("days.wed"),
                    thu: t("days.thu"),
                    fri: t("days.fri"),
                    sat: t("days.sat"),
                    sun: t("days.sun"),
                  }) ?? t("locations.noHours"),
              },
              {
                label: t("locations.people"),
                value: (
                  <ul data-testid="preview-people">
                    {selected.people.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        ) : null}
      </PreviewDrawer>
    </>
  );
}
