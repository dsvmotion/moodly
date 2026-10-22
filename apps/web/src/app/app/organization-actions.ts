"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE } from "@/lib/active-org";
import { safeNextPath } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { PREFERENCE_COOKIE_MAX_AGE } from "@/lib/preferences";
import { getOrgContext } from "@/lib/scope-data";

// Cambia la organización activa (active-org.ts). Solo se guarda una organización
// en la que la persona tiene membership; RLS sigue decidiendo qué datos ve.
export async function setActiveOrganization(formData: FormData): Promise<void> {
  await requireUser();
  const requested = formData.get("organizationId");
  const { memberships } = await getOrgContext();
  const target = memberships.find((m) => m.organizationId === requested);
  if (target) {
    (await cookies()).set(ACTIVE_ORG_COOKIE, target.organizationId, {
      path: "/",
      maxAge: PREFERENCE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  revalidatePath("/app", "layout");
  // El alcance (?scope=) era de la otra organización: se vuelve a la página sin él.
  redirect(safeNextPath(formData.get("returnTo")).split("?")[0] ?? "/app");
}
