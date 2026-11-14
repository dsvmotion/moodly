import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/scope-data";
import { loadBusinessSetup } from "./data";
import { ResourcesList, ServicesList } from "./services-view";

// Ajustes → Servicios y equipo (OA04, MANUAL §9.4): lo que se reserva, cuánto
// dura y cuesta, y quién o qué lo hace en cada local. Lo ve el equipo de su
// alcance; lo cambia el org_admin con el segundo factor (decisión de producto
// n.º 13; RLS lo exige igual). La pestaña va en la URL (?tab=team).

const TABS = ["services", "team"] as const;
type Tab = (typeof TABS)[number];

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[]; tab?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("servicesPage");
  const params = await searchParams;
  const tab: Tab = params.tab === "team" ? "team" : "services";
  const { scope, context } = await resolveScope(params.scope);
  const isAdmin = context.role === "org_admin";
  const canAdminister = isAdmin && (await getSessionAal()) === "aal2";
  const { services, resources } = await loadBusinessSetup(scope, context);
  const locations = context.locations.map((location) => ({ id: location.id, name: location.name }));
  const href = (target: Tab) => {
    const query = new URLSearchParams();
    if (typeof params.scope === "string") query.set("scope", params.scope);
    if (target === "team") query.set("tab", "team");
    const search = query.toString();
    return search ? `/app/settings/services?${search}` : "/app/settings/services";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {isAdmin && !canAdminister ? (
        <p role="note" data-testid="mfa-required" className="rounded-md border p-3 text-sm">
          {t("mfaRequired")}{" "}
          <Link href="/app/settings/security" className="underline">
            {t("mfaLink")}
          </Link>
        </p>
      ) : null}
      <nav aria-label={t("tabsLabel")} className="flex gap-1 border-b">
        {TABS.map((target) => (
          <Link
            key={target}
            href={href(target)}
            aria-current={tab === target ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === target ? "border-foreground font-medium" : "text-muted-foreground border-transparent"}`}
            data-testid={`business-tab-${target}`}
          >
            {t(`tabs.${target}`)}
          </Link>
        ))}
      </nav>
      {tab === "services" ? (
        <ServicesList rows={services} canAdminister={canAdminister} locations={locations} />
      ) : (
        <ResourcesList rows={resources} services={services} canAdminister={canAdminister} locations={locations} />
      )}
    </div>
  );
}
