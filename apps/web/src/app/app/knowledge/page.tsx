import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/scope-data";
import { loadKnowledgeSources } from "./data";
import { KnowledgeView } from "./knowledge-view";

// Conocimiento (paso B20-3, MANUAL §6.1 y §9.4, ADR 0048): lo que el negocio ha
// escrito para que los agentes contesten con ello. Lo ve todo el equipo de su
// alcance; lo escribe el org_admin con el segundo factor (RLS lo exige igual).

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("knowledgePage");
  const { scope, context } = await resolveScope((await searchParams).scope);
  const isAdmin = context.role === "org_admin";
  const canAdminister = isAdmin && (await getSessionAal()) === "aal2";
  const format = await getFormatter();
  const now = new Date();
  const rows = (await loadKnowledgeSources(scope, context)).map((row) => ({
    ...row,
    updatedLabel: format.relativeTime(new Date(row.updatedAt), now),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {isAdmin ? (
          <p className="text-muted-foreground text-sm" data-testid="knowledge-privacy">
            {t("privacy")}
          </p>
        ) : null}
      </div>
      {isAdmin && !canAdminister ? (
        <p role="note" data-testid="mfa-required" className="rounded-md border p-3 text-sm">
          {t("mfaRequired")}{" "}
          <Link href="/app/settings/security" className="underline">
            {t("mfaLink")}
          </Link>
        </p>
      ) : null}
      <KnowledgeView
        rows={rows}
        canAdminister={canAdminister}
        locations={context.locations.map((location) => ({ id: location.id, name: location.name }))}
      />
    </div>
  );
}
