import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { EmptyState } from "@repo/ui/components/empty-state";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { loadPendingApprovals } from "@/lib/approvals-data";
import { requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/scope-data";
import { isKnownSkill } from "@/lib/skill-labels";

// Aprobaciones (paso 4d-3d, MANUAL §5.7 y §9): lo que el agente dejó esperando a
// una persona, del alcance elegido. Aprobar envía la respuesta o hace la
// reserva (lo ejecuta el worker); rechazar no ejecuta nada.

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("approvalsPage");
  const format = await getFormatter();
  const { scope, context } = await resolveScope((await searchParams).scope);
  const { rows, truncated, total } = await loadPendingApprovals(scope, context);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          {total > 0 ? (
            <span className="text-muted-foreground text-sm" data-testid="approvals-count">
              {t("count", { count: total })}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState data-testid="approvals-empty" title={t("emptyTitle")} description={t("empty")} />
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border" data-testid="approvals-list">
          {rows.map((row) => (
            <li key={row.id} data-testid="approval" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium break-words" data-testid="approval-summary">
                  {row.summary}
                </p>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge>{isKnownSkill(row.skillKey) ? t(`skills.${row.skillKey}`) : row.skillKey}</Badge>
                  <span data-testid="approval-location">{row.location ?? t("wholeOrganization")}</span>
                  <span>·</span>
                  <span>{t("expires", { time: format.relativeTime(new Date(row.expiresAt)) })}</span>
                </div>
              </div>
              <ApprovalActions id={row.id} />
            </li>
          ))}
        </ul>
      )}
      {truncated ? (
        <p className="text-muted-foreground text-sm" data-testid="approvals-truncated">
          {t("truncated", { count: rows.length })}
        </p>
      ) : null}
    </div>
  );
}
