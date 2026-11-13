import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PLATFORM_INTEGRATIONS } from "@repo/integrations/platform";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { getConnectorPlatform } from "@/lib/integrations/platform";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";
import { IntegrationCard, type IntegrationStatus } from "./integration-card";

// Ajustes → Integraciones (P6, MANUAL §9.4; O-02, ADR 0053): las cuentas del
// negocio que usan los agentes. Empieza por Google Calendar, a través de la
// plataforma de conectores. Las ve y las conecta el org_admin con MFA (RLS lo
// exige igual); el resto del equipo ve que existen, sin su estado.

export default async function IntegrationsPage() {
  await requireUser();
  const t = await getTranslations("integrationsPage");
  const context = await getScopeContext();
  const isAdmin = context.role === "org_admin";
  const canAdminister = isAdmin && (await getSessionAal()) === "aal2";
  const available = getConnectorPlatform() !== null;

  const statuses = new Map<string, IntegrationStatus>();
  if (isAdmin && context.organization) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("integrations")
      .select("provider, status")
      .eq("organization_id", context.organization.id)
      .eq("kind", "platform")
      .is("location_id", null);
    if (error) throw new Error("No se pudieron cargar las integraciones", { cause: error });
    for (const row of data) statuses.set(row.provider, row.status as IntegrationStatus);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {!isAdmin ? (
        <p role="note" data-testid="integrations-admin-only" className="rounded-md border p-3 text-sm">
          {t("adminOnly")}
        </p>
      ) : !canAdminister ? (
        <p role="note" data-testid="mfa-required" className="rounded-md border p-3 text-sm">
          {t("mfaRequired")}{" "}
          <Link href="/app/settings/security" className="underline">
            {t("mfaLink")}
          </Link>
        </p>
      ) : !available ? (
        <p role="note" data-testid="integrations-unavailable" className="rounded-md border p-3 text-sm">
          {t("unavailable")}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y rounded-lg border" data-testid="integrations-list">
        {PLATFORM_INTEGRATIONS.map((entry) => (
          <IntegrationCard
            key={entry.provider}
            provider={entry.provider}
            status={isAdmin ? (statuses.get(entry.provider) ?? "none") : null}
            canAdminister={canAdminister && available}
          />
        ))}
      </ul>
    </div>
  );
}
