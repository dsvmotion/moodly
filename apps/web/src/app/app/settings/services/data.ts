import "server-only";
import type { Currency, ResourceKind } from "@/lib/business-setup/schema";
import { locationsInScope, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

// Servicios y equipo de la organización activa (OA04), con el JWT de la persona:
// RLS decide qué filas ve (los servicios de toda la organización y los de sus
// locales; los recursos de sus locales). El alcance elegido acota después.

export interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
  currency: Currency;
  active: boolean;
  locationId: string | null;
  location: string | null;
  /** Viene de una integración: no se cambia desde aquí. */
  synced: boolean;
}

export interface ResourceRow {
  id: string;
  name: string;
  kind: ResourceKind;
  active: boolean;
  locationId: string;
  location: string;
  serviceIds: string[];
  synced: boolean;
}

export async function loadBusinessSetup(scope: Scope, context: ScopeContext): Promise<{ services: ServiceRow[]; resources: ResourceRow[] }> {
  const organization = context.organization;
  if (!organization) return { services: [], resources: [] };
  const supabase = await createClient();
  const [services, resources, links] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, currency, active, location_id, external_ref")
        .eq("organization_id", organization.id)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("booking_resources")
        .select("id, name, kind, active, location_id, external_ref")
        .eq("organization_id", organization.id)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("resource_services").select("resource_id, service_id").eq("organization_id", organization.id).order("resource_id").order("service_id").range(from, to),
    ),
  ]);
  const error = services.error ?? resources.error ?? links.error;
  if (error) throw new Error("No se pudieron cargar los servicios y el equipo", { cause: error });

  const inScope = new Map(locationsInScope(scope, context.locations).map((location) => [location.id, location.name]));
  const names = new Map(context.locations.map((location) => [location.id, location.name]));
  const byResource = new Map<string, string[]>();
  for (const link of links.data) byResource.set(link.resource_id, [...(byResource.get(link.resource_id) ?? []), link.service_id]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

  return {
    services: services.data
      .filter((service) => service.location_id === null || inScope.has(service.location_id))
      .map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.duration_minutes,
        priceCents: service.price_cents,
        currency: service.currency as Currency,
        active: service.active,
        locationId: service.location_id,
        location: service.location_id ? (names.get(service.location_id) ?? null) : null,
        synced: service.external_ref !== null,
      }))
      .sort(byName),
    resources: resources.data
      .filter((resource) => inScope.has(resource.location_id))
      .map((resource) => ({
        id: resource.id,
        name: resource.name,
        kind: resource.kind as ResourceKind,
        active: resource.active,
        locationId: resource.location_id,
        location: names.get(resource.location_id) ?? "",
        serviceIds: byResource.get(resource.id) ?? [],
        synced: resource.external_ref !== null,
      }))
      .sort(byName),
  };
}
