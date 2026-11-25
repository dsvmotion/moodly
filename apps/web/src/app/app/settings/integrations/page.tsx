import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PLATFORM_INTEGRATIONS } from "@repo/integrations/platform";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { getConnectorPlatform } from "@/lib/integrations/platform";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";
import { displayStatus, type IntegrationStatus } from "@/lib/integrations/status";
import { getIngressPublicKey } from "@/lib/integrations/key-ingress";
import { KEY_INTEGRATIONS } from "@/lib/integrations/key-providers";
import { IntegrationCard } from "./integration-card";
import { KeyIntegrationCard } from "./key-integration-card";

// Ajustes → Integraciones (P6, MANUAL §9.4; O-02, ADR 0053): las cuentas del
// negocio que usan los agentes: los calendarios de Google y de Microsoft 365, a
// través de la plataforma de conectores, y las de clave del cliente, como
// Koibox (ADR 0055). Las ve y las conecta el org_admin con MFA (RLS lo exige
// igual); el resto del equipo ve que existen, sin su estado.

export default async function IntegrationsPage() {
  await requireUser();
  const t = await getTranslations("integrationsPage");
  const context = await getScopeContext();
  const isAdmin = context.role === "org_admin";
  const canAdminister = isAdmin && (await getSessionAal()) === "aal2";
  const available = getConnectorPlatform() !== null;
  const keyAvailable = getIngressPublicKey() !== null;

  const statuses = new Map<string, IntegrationStatus>();
  const keyRows = new Map<string, { status: IntegrationStatus; lastRejected: boolean }>();
  if (isAdmin && context.organization) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("integrations")
      .select("provider, kind, status, updated_at, last_submission_result")
      .eq("organization_id", context.organization.id)
      .in("kind", ["platform", "native"])
      .is("location_id", null);
    if (error) throw new Error("No se pudieron cargar las integraciones", { cause: error });
    const now = new Date();
    for (const row of data) {
      if (row.kind === "platform") {
        statuses.set(row.provider, displayStatus(row, now));
      } else if (KEY_INTEGRATIONS.includes(row.provider)) {
        // Una de clave del cliente no caduca: la pendiente espera al worker.
        const status = displayStatus({ ...row, updated_at: now.toISOString() }, now);
        keyRows.set(row.provider, { status, lastRejected: status === "active" && row.last_submission_result === "rejected" });
      }
    }
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
      ) : !available && !keyAvailable ? (
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
        {KEY_INTEGRATIONS.map((provider) => (
          <KeyIntegrationCard
            key={provider}
            provider={provider}
            status={isAdmin ? (keyRows.get(provider)?.status ?? "none") : null}
            lastRejected={keyRows.get(provider)?.lastRejected ?? false}
            canAdminister={canAdminister && keyAvailable}
          />
        ))}
      </ul>
    </div>
  );
}
