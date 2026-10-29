import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { LocationsTable } from "@/components/records/locations-table";
import { requireUser } from "@/lib/auth/session";
import { loadLocationRows } from "@/lib/records-data";
import { resolveScope } from "@/lib/scope-data";

// Ajustes → Sedes (MANUAL §9.4): P2 + P4 sobre datos reales vía RLS. Cada rol ve
// los locales de su alcance.
export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("records.locations");
  const { scope, context } = await resolveScope((await searchParams).scope);
  const rows = await loadLocationRows(scope, context);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {rows.length > 0 ? <LocationsTable rows={rows} /> : <EmptyState data-testid="records-empty" title={t("empty")} />}
    </div>
  );
}
