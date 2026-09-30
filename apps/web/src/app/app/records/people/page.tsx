import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { PeopleTable } from "@/components/records/people-table";
import { requireUser } from "@/lib/auth/session";
import { loadPersonRows } from "@/lib/records-data";
import { resolveScope } from "@/lib/scope-data";

// Registros → Personas: P2 + P4 sobre datos reales vía RLS.
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("records.people");
  const { scope, context } = await resolveScope((await searchParams).scope);
  const rows = await loadPersonRows(scope, context);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {rows.length > 0 ? <PeopleTable rows={rows} /> : <EmptyState data-testid="records-empty" title={t("empty")} />}
    </div>
  );
}
