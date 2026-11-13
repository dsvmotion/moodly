import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { LocationsTable } from "@/components/records/locations-table";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { loadLocationRows } from "@/lib/records-data";
import { resolveScope } from "@/lib/scope-data";

// Ajustes → Sedes (MANUAL §9.4): P2 + P4 sobre datos reales vía RLS. Cada rol ve
// los locales de su alcance.
export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("records.locations");
  const { scope, context } = await resolveScope((await searchParams).scope);
  const rows = await loadLocationRows(scope, context);
  // El horario lo cambia el org_admin con el segundo factor (OA04, decisión de producto n.º 13).
  const canEditHours = context.role === "org_admin" && (await getSessionAal()) === "aal2";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {rows.length > 0 ? <LocationsTable rows={rows} canEditHours={canEditHours} /> : <EmptyState data-testid="records-empty" title={t("empty")} />}
    </div>
  );
}
