"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE } from "@/lib/active-org";
import { safeNextPath } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { appCookieOptions, isHttpsRequest } from "@/lib/cookie-options";
import { securityEvent } from "@/lib/observability/logger";
import { getOrgContext } from "@/lib/scope-data";

// Cambia la organización activa (active-org.ts). Solo se guarda una organización
// en la que la persona tiene membership; RLS sigue decidiendo qué datos ve.
export async function setActiveOrganization(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requested = formData.get("organizationId");
  const { memberships } = await getOrgContext();
  const target = memberships.find((m) => m.organizationId === requested);
  if (target) {
    (await cookies()).set(ACTIVE_ORG_COOKIE, target.organizationId, appCookieOptions(isHttpsRequest(await headers())));
    securityEvent("org.active_changed", { userId: user.id, organizationId: target.organizationId });
  }
  revalidatePath("/app", "layout");
  // El alcance (?scope=) era de la otra organización: se vuelve a la página sin él.
  redirect(safeNextPath(formData.get("returnTo")).split("?")[0] ?? "/app");
}
