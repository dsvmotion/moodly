"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  CURRENCIES,
  DURATION_MAX,
  DURATION_MIN,
  NAME_MAX,
  RESOURCE_KINDS,
  priceInputValue,
  type BusinessFormState,
} from "@/lib/business-setup/schema";
import { createResource, createService, setResourceActive, setServiceActive, updateResource, updateService } from "./actions";
import type { ResourceRow, ServiceRow } from "./data";

// Formularios de Servicios y equipo (OA04). Solo se enseñan al org_admin con
// aal2 y nunca para lo sincronizado; lo que se puede guardar lo decide la base
// de datos.

const initial: BusinessFormState = { error: null, savedAt: null };
const fieldClass = "w-full rounded-md border border-input bg-background px-3 text-sm h-9";

export function FormError({ error }: { error: BusinessFormState["error"] }) {
  const t = useTranslations("servicesPage");
  if (!error) return null;
  return (
    <p role="alert" className="text-destructive text-sm" data-testid="business-error">
      {t(`errors.${error}`)}
    </p>
  );
}

function Saved({ state, pending }: { state: BusinessFormState; pending: boolean }) {
  const t = useTranslations("servicesPage");
  return state.savedAt && !pending && !state.error ? (
    <span role="status" className="text-muted-foreground text-sm" data-testid="business-saved">
      {t("saved")}
    </span>
  ) : null;
}

function ServiceFields({ service, disabled }: { service?: ServiceRow; disabled: boolean }) {
  const t = useTranslations("servicesPage");
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.name")}
        <Input name="name" required maxLength={NAME_MAX} defaultValue={service?.name} disabled={disabled} data-testid="service-name" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.duration")}
          <Input
            name="durationMinutes"
            type="number"
            required
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={5}
            defaultValue={service?.durationMinutes ?? 30}
            disabled={disabled}
            data-testid="service-duration"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.price")}
          <Input
            name="price"
            inputMode="decimal"
            placeholder={t("pricePlaceholder")}
            defaultValue={priceInputValue(service?.priceCents ?? null)}
            disabled={disabled}
            data-testid="service-price"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.currency")}
          <select name="currency" defaultValue={service?.currency ?? "EUR"} disabled={disabled} className={fieldClass} data-testid="service-currency">
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-muted-foreground text-xs">{t("priceHelp")}</p>
    </>
  );
}

/** Crear un servicio. Se cierra al guardar (onSaved). */
export function CreateServiceForm({ locations, onSaved }: { locations: { id: string; name: string }[]; onSaved: () => void }) {
  const t = useTranslations("servicesPage");
  const [state, action, pending] = useActionState(createService, initial);
  useEffect(() => {
    if (state.savedAt) onSaved();
  }, [state.savedAt, onSaved]);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="service-create-form">
      <ServiceFields disabled={pending} />
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.offeredAt")}
        <select name="locationId" defaultValue="" disabled={pending} className={fieldClass} data-testid="service-location">
          <option value="">{t("allLocations")}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="self-end" data-testid="service-create">
        {t("create")}
      </Button>
    </form>
  );
}

export function EditServiceForm({ service }: { service: ServiceRow }) {
  const t = useTranslations("servicesPage");
  const [state, action, pending] = useActionState(updateService, initial);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="service-edit-form">
      <input type="hidden" name="id" value={service.id} />
      <ServiceFields service={service} disabled={pending} />
      <FormError error={state.error} />
      <div className="flex items-center justify-end gap-3">
        <Saved state={state} pending={pending} />
        <Button type="submit" disabled={pending} data-testid="service-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Activar o desactivar (no se borran: las citas apuntan a ellos). */
export function ActiveToggle({ kind, id, active }: { kind: "service" | "resource"; id: string; active: boolean }) {
  const t = useTranslations("servicesPage");
  const [state, action, pending] = useActionState(kind === "service" ? setServiceActive : setResourceActive, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="outline" disabled={pending} data-testid={`${kind}-toggle-active`}>
        {active ? t("deactivate") : t("activate")}
      </Button>
      <FormError error={state.error} />
    </form>
  );
}

function ResourceFields({
  resource,
  services,
  disabled,
}: {
  resource?: ResourceRow;
  services: { id: string; name: string }[];
  disabled: boolean;
}) {
  const t = useTranslations("servicesPage");
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.name")}
          <Input name="name" required maxLength={NAME_MAX} defaultValue={resource?.name} disabled={disabled} data-testid="resource-name" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.kind")}
          <select name="kind" defaultValue={resource?.kind ?? "staff"} disabled={disabled} className={fieldClass} data-testid="resource-kind">
            {RESOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2 text-sm" disabled={disabled}>
        <legend className="mb-1">{t("fields.services")}</legend>
        {services.length === 0 ? <p className="text-muted-foreground text-xs">{t("noServicesYet")}</p> : null}
        {services.map((service) => (
          <label key={service.id} className="flex items-center gap-2" data-testid="resource-service">
            <input
              type="checkbox"
              name="serviceIds"
              value={service.id}
              defaultChecked={resource?.serviceIds.includes(service.id)}
              className="size-4"
            />
            {service.name}
          </label>
        ))}
      </fieldset>
    </>
  );
}

export function CreateResourceForm({
  locations,
  services,
  onSaved,
}: {
  locations: { id: string; name: string }[];
  services: { id: string; name: string; locationId: string | null }[];
  onSaved: () => void;
}) {
  const t = useTranslations("servicesPage");
  const [state, action, pending] = useActionState(createResource, initial);
  const [first] = locations;
  const [locationId, setLocationId] = useState(first?.id ?? "");
  // Solo los servicios que se ofrecen en ese local (en todos, o en ese).
  const offered = services.filter((service) => service.locationId === null || service.locationId === locationId);
  useEffect(() => {
    if (state.savedAt && !state.error) onSaved();
  }, [state.savedAt, state.error, onSaved]);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="resource-create-form">
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.location")}
        <select
          name="locationId"
          required
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          disabled={pending}
          className={fieldClass}
          data-testid="resource-location"
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-muted-foreground text-xs">{t("servicesHelp")}</p>
      <ResourceFields key={locationId} services={offered} disabled={pending} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending || !first} className="self-end" data-testid="resource-create">
        {t("create")}
      </Button>
    </form>
  );
}

export function EditResourceForm({ resource, services }: { resource: ResourceRow; services: { id: string; name: string }[] }) {
  const t = useTranslations("servicesPage");
  const [state, action, pending] = useActionState(updateResource, initial);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="resource-edit-form">
      <input type="hidden" name="id" value={resource.id} />
      <ResourceFields resource={resource} services={services} disabled={pending} />
      <FormError error={state.error} />
      <div className="flex items-center justify-end gap-3">
        <Saved state={state} pending={pending} />
        <Button type="submit" disabled={pending} data-testid="resource-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
