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
import type { ResourceRow, ServiceRow } from "./data";
import { ActiveToggle, CreateResourceForm, CreateServiceForm, EditResourceForm, EditServiceForm } from "./forms";

// Servicios y equipo (OA04): cada lista en una tabla (P2) y cada fila en el
// panel lateral (P4), editable para el org_admin con aal2 salvo lo que viene
// de una integración.

type Location = { id: string; name: string };

function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("servicesPage");
  return <Badge variant={active ? "outline" : "muted"}>{active ? t("active") : t("inactive")}</Badge>;
}

function SyncedNote() {
  const t = useTranslations("servicesPage");
  return (
    <p role="note" className="rounded-md border p-3 text-sm" data-testid="business-synced">
      {t("synced")}
    </p>
  );
}

function usePrice() {
  const t = useTranslations("servicesPage");
  const format = useFormatter();
  return useCallback(
    (service: ServiceRow) =>
      service.priceCents === null ? t("noPrice") : format.number(service.priceCents / 100, { style: "currency", currency: service.currency }),
    [format, t],
  );
}

export function ServicesList({ rows, canAdminister, locations }: { rows: ServiceRow[]; canAdminister: boolean; locations: Location[] }) {
  const t = useTranslations("servicesPage");
  const tRecords = useTranslations("records");
  const labels = useTableLabels();
  const price = usePrice();
  const { selected, open, close } = useRecordParam(rows);
  const [creating, setCreating] = useState(false);
  const closeCreate = useCallback(() => setCreating(false), []);
  const offeredAt = useCallback((row: ServiceRow) => row.location ?? t("allLocations"), [t]);

  const columns = useMemo<DataTableColumn<ServiceRow>[]>(
    () => [
      {
        id: "name",
        header: t("fields.name"),
        value: (row) => row.name,
        enableHiding: false,
        cell: (row) => (
          <span className="font-medium" data-testid="service-row-name">
            {row.name}
          </span>
        ),
      },
      { id: "duration", header: t("fields.duration"), value: (row) => row.durationMinutes, cell: (row) => t("minutes", { count: row.durationMinutes }) },
      { id: "price", header: t("fields.price"), value: (row) => row.priceCents ?? -1, cell: (row) => <span data-testid="service-row-price">{price(row)}</span> },
      { id: "offeredAt", header: t("fields.offeredAt"), value: (row) => offeredAt(row) },
      { id: "status", header: t("fields.status"), value: (row) => (row.active ? t("active") : t("inactive")), cell: (row) => <StatusBadge active={row.active} /> },
    ],
    [t, price, offeredAt],
  );

  const addButton = canAdminister ? (
    <Button onClick={() => setCreating(true)} data-testid="service-add">
      {t("addService")}
    </Button>
  ) : null;
  const editable = canAdminister && selected !== null && !selected.synced;

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          data-testid="services-empty"
          title={t("servicesEmptyTitle")}
          description={canAdminister ? t("servicesEmpty") : t("emptyReadOnly")}
          action={addButton}
        />
      ) : (
        <DataTable
          testId="services-table"
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowLabel={(row) => row.name}
          onRowOpen={open}
          enableSelection={false}
          labels={labels}
          toolbar={addButton}
        />
      )}

      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={selected?.name ?? ""}
        description={selected ? `${t("minutes", { count: selected.durationMinutes })} · ${price(selected)}` : undefined}
        closeLabel={tRecords("close")}
        footer={editable && selected ? <ActiveToggle key={selected.id} kind="service" id={selected.id} active={selected.active} /> : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <PreviewAttributes
              items={[
                { label: t("fields.offeredAt"), value: offeredAt(selected) },
                { label: t("fields.status"), value: <StatusBadge active={selected.active} /> },
              ]}
            />
            {selected.synced ? <SyncedNote /> : null}
            {editable ? <EditServiceForm key={selected.id} service={selected} /> : null}
          </div>
        ) : null}
      </PreviewDrawer>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent closeLabel={t("close")} data-testid="service-create-sheet">
          <SheetHeader>
            <SheetTitle>{t("newService")}</SheetTitle>
            <SheetDescription>{t("newServiceDescription")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateServiceForm locations={locations} onSaved={closeCreate} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ResourcesList({
  rows,
  services,
  canAdminister,
  locations,
}: {
  rows: ResourceRow[];
  services: ServiceRow[];
  canAdminister: boolean;
  locations: Location[];
}) {
  const t = useTranslations("servicesPage");
  const tRecords = useTranslations("records");
  const labels = useTableLabels();
  const { selected, open, close } = useRecordParam(rows);
  const [creating, setCreating] = useState(false);
  const closeCreate = useCallback(() => setCreating(false), []);
  const serviceNames = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const doesNames = useCallback(
    (row: ResourceRow) =>
      row.serviceIds
        .map((id) => serviceNames.get(id))
        .filter(Boolean)
        .join(", ") || t("noServices"),
    [serviceNames, t],
  );
  // Lo que se puede asignar: servicios activos, sin sincronizar, que se ofrecen en ese local.
  const assignable = useMemo(() => services.filter((service) => service.active && !service.synced), [services]);
  // Al editar, también los que ya hace (aunque estén desactivados): quitar una casilla que no se ve borraría el vínculo.
  const editableServices = (resource: ResourceRow) =>
    services.filter(
      (service) =>
        resource.serviceIds.includes(service.id) ||
        (service.active && !service.synced && (service.locationId === null || service.locationId === resource.locationId)),
    );

  const columns = useMemo<DataTableColumn<ResourceRow>[]>(
    () => [
      {
        id: "name",
        header: t("fields.name"),
        value: (row) => row.name,
        enableHiding: false,
        cell: (row) => (
          <span className="font-medium" data-testid="resource-row-name">
            {row.name}
          </span>
        ),
      },
      { id: "kind", header: t("fields.kind"), value: (row) => t(`kinds.${row.kind}`) },
      { id: "location", header: t("fields.location"), value: (row) => row.location },
      { id: "services", header: t("fields.services"), value: (row) => doesNames(row) },
      { id: "status", header: t("fields.status"), value: (row) => (row.active ? t("active") : t("inactive")), cell: (row) => <StatusBadge active={row.active} /> },
    ],
    [t, doesNames],
  );

  const addButton =
    canAdminister && locations.length > 0 ? (
      <Button onClick={() => setCreating(true)} data-testid="resource-add">
        {t("addResource")}
      </Button>
    ) : null;
  const editable = canAdminister && selected !== null && !selected.synced;

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          data-testid="resources-empty"
          title={t("resourcesEmptyTitle")}
          description={canAdminister ? t("resourcesEmpty") : t("emptyReadOnly")}
          action={addButton}
        />
      ) : (
        <DataTable
          testId="resources-table"
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowLabel={(row) => row.name}
          onRowOpen={open}
          enableSelection={false}
          labels={labels}
          toolbar={addButton}
        />
      )}

      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={selected?.name ?? ""}
        description={selected ? `${t(`kinds.${selected.kind}`)} · ${selected.location}` : undefined}
        closeLabel={tRecords("close")}
        footer={editable && selected ? <ActiveToggle key={selected.id} kind="resource" id={selected.id} active={selected.active} /> : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <PreviewAttributes
              items={[
                { label: t("fields.location"), value: selected.location },
                { label: t("fields.services"), value: doesNames(selected) },
                { label: t("fields.status"), value: <StatusBadge active={selected.active} /> },
              ]}
            />
            {selected.synced ? <SyncedNote /> : null}
            {editable ? <EditResourceForm key={selected.id} resource={selected} services={editableServices(selected)} /> : null}
          </div>
        ) : null}
      </PreviewDrawer>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent closeLabel={t("close")} data-testid="resource-create-sheet">
          <SheetHeader>
            <SheetTitle>{t("newResource")}</SheetTitle>
            <SheetDescription>{t("newResourceDescription")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateResourceForm locations={locations} services={assignable} onSaved={closeCreate} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
