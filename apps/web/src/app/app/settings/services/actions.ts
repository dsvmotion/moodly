"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  createResourceSchema,
  createServiceSchema,
  setActiveSchema,
  updateResourceSchema,
  updateServiceSchema,
  type BusinessFormState,
} from "@/lib/business-setup/schema";
import { securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// Servicios, precios y equipo (OA04). La barrera es la base de datos
// (20261113140000_business_setup): RLS deja escribir solo al org_admin con
// aal2, los grants por columna dejan fijos la organización, el local y la
// referencia externa, y guard_synced no deja tocar lo que viene de una
// integración. Aquí solo se valida la forma y se traduce el error. Los eventos
// llevan ids y los nombres de los campos que cambian, nunca sus valores.

const PATH = "/app/settings/services";

type Failure = BusinessFormState["error"];

function failure(code: string | undefined): Failure {
  if (code === "23514" || code === "22P02" || code === "23503" || code === "23505") return "invalid";
  return "not_allowed";
}

const done = (): BusinessFormState => ({ error: null, savedAt: Date.now() });
const fail = (error: Failure): BusinessFormState => ({ error, savedAt: null });

/** Los campos que cambian, por nombre, para el evento. */
function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}

export async function createService(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    locationId: formData.get("locationId"),
  });
  if (!parsed.success) return fail("invalid");
  const { name, durationMinutes, price, currency, locationId } = parsed.data;
  // La organización es la activa de la sesión, no la que diga el formulario.
  const { organization } = await getScopeContext();
  if (!organization) return fail("not_allowed");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      organization_id: organization.id,
      location_id: locationId || null,
      name,
      duration_minutes: durationMinutes,
      price_cents: price,
      currency,
    })
    .select("id")
    .single();
  if (error) return fail(failure(error.code));

  securityEvent("business.service_created", {
    userId: user.id,
    organizationId: organization.id,
    serviceId: data.id,
    locationId: locationId || null,
  });
  revalidatePath(PATH);
  return done();
}

export async function updateService(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = updateServiceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return fail("invalid");
  const { id, name, durationMinutes, price, currency } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("services")
    .select("organization_id, name, duration_minutes, price_cents, currency, external_ref")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("not_allowed");
  if (current.external_ref !== null) return fail("synced");

  const next = { name, duration_minutes: durationMinutes, price_cents: price, currency };
  const fields = changedFields(current, next);
  if (fields.length === 0) return done();
  const { data, error } = await supabase.from("services").update(next).eq("id", id).select("id");
  if (error) return fail(failure(error.code));
  // Sin fila: no se puede cambiar (sin rol o sin aal2).
  if (!data[0]) return fail("not_allowed");

  securityEvent("business.service_updated", {
    userId: user.id,
    organizationId: current.organization_id,
    serviceId: id,
    fields: fields.join(","),
  });
  revalidatePath(PATH);
  return done();
}

export async function setServiceActive(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = setActiveSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return fail("invalid");
  const { id, active } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("services").update({ active }).eq("id", id).select("organization_id");
  if (error) return fail(error.code === "42501" ? "synced" : failure(error.code));
  const updated = data[0];
  if (!updated) return fail("not_allowed");

  securityEvent("business.service_updated", { userId: user.id, organizationId: updated.organization_id, serviceId: id, fields: "active" });
  revalidatePath(PATH);
  return done();
}

/**
 * Lo que hace un recurso, de una vez: public.set_resource_services lo cambia
 * en una sola transacción (o todo o nada), con RLS y las guardas de quien llama.
 */
async function setResourceServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
  serviceIds: string[],
): Promise<{ changed: boolean; error: Failure }> {
  const { data, error } = await supabase.rpc("set_resource_services", { p_resource_id: resourceId, p_service_ids: serviceIds });
  if (error) return { changed: false, error: error.code === "42501" ? "not_allowed" : failure(error.code) };
  return { changed: data > 0, error: null };
}

export async function createResource(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = createResourceSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    locationId: formData.get("locationId"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return fail("invalid");
  const { name, kind, locationId, serviceIds } = parsed.data;
  const { organization } = await getScopeContext();
  if (!organization) return fail("not_allowed");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_resources")
    .insert({ organization_id: organization.id, location_id: locationId, name, kind })
    .select("id")
    .single();
  if (error) return fail(failure(error.code));
  const links = await setResourceServices(supabase, data.id, serviceIds);

  securityEvent("business.resource_created", {
    userId: user.id,
    organizationId: organization.id,
    resourceId: data.id,
    locationId,
    services: serviceIds.length,
  });
  revalidatePath(PATH);
  return links.error ? fail(links.error) : done();
}

export async function updateResource(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = updateResourceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return fail("invalid");
  const { id, name, kind, serviceIds } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase.from("booking_resources").select("organization_id, name, kind, external_ref").eq("id", id).maybeSingle();
  if (!current) return fail("not_allowed");
  if (current.external_ref !== null) return fail("synced");

  const next = { name, kind };
  const fields = changedFields(current, next);
  if (fields.length > 0) {
    const { data, error } = await supabase.from("booking_resources").update(next).eq("id", id).select("id");
    if (error) return fail(failure(error.code));
    if (!data[0]) return fail("not_allowed");
  }
  const links = await setResourceServices(supabase, id, serviceIds);
  if (links.changed) fields.push("services");

  if (fields.length > 0) {
    securityEvent("business.resource_updated", { userId: user.id, organizationId: current.organization_id, resourceId: id, fields: fields.join(",") });
    revalidatePath(PATH);
  }
  return links.error ? fail(links.error) : done();
}

export async function setResourceActive(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = setActiveSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return fail("invalid");
  const { id, active } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_resources").update({ active }).eq("id", id).select("organization_id");
  if (error) return fail(error.code === "42501" ? "synced" : failure(error.code));
  const updated = data[0];
  if (!updated) return fail("not_allowed");

  securityEvent("business.resource_updated", { userId: user.id, organizationId: updated.organization_id, resourceId: id, fields: "active" });
  revalidatePath(PATH);
  return done();
}
