"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { daysFromForm, openingHoursSchema, toOpeningHours, type BusinessFormState } from "@/lib/business-setup/schema";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

// El horario de un local (OA04). La barrera es la base de datos: RLS de
// locations y guard_structure (el org_admin con aal2; los managers de ese
// local, que ya podían) y el CHECK locations_opening_hours_format. La pantalla
// solo lo ofrece al org_admin con aal2 (decisión de producto n.º 13). El
// evento lleva ids, nunca el horario.

export async function saveOpeningHours(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requireUser();
  const parsed = openingHoursSchema.safeParse({ locationId: formData.get("locationId"), days: daysFromForm(formData) });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { locationId, days } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ opening_hours: toOpeningHours(days) })
    .eq("id", locationId)
    .select("organization_id");
  if (error) return { error: error.code === "23514" ? "invalid" : "not_allowed", savedAt: null };
  const updated = data[0];
  if (!updated) return { error: "not_allowed", savedAt: null };

  securityEvent("business.opening_hours_updated", { userId: user.id, organizationId: updated.organization_id, locationId });
  revalidatePath("/app/settings/locations");
  return { error: null, savedAt: Date.now() };
}
