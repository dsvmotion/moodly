import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { ApprovalsView } from "@/components/approvals/approvals-view";
import { loadApprovalDetail } from "@/lib/approval-detail-data";
import { loadPendingApprovals } from "@/lib/approvals-data";
import { requireUser } from "@/lib/auth/session";
import { RECORD_PARAM } from "@/lib/records";
import { resolveScope } from "@/lib/scope-data";

// Aprobaciones (paso 4d-3d, MANUAL §5.7 y §9): lo que el agente dejó esperando a
// una persona, del alcance elegido. Aprobar envía la respuesta o hace la
// reserva (lo ejecuta el worker); rechazar no ejecuta nada. Cada una se abre en
// el panel lateral con su detalle (OA02): solo se carga el de la abierta, y
// solo si está en la lista (alcance y rol ya filtrados).

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const t = await getTranslations("approvalsPage");
  const format = await getFormatter();
  const params = await searchParams;
  const { scope, context } = await resolveScope(params.scope);
  const { rows, truncated, total } = await loadPendingApprovals(scope, context);
  const requested = typeof params[RECORD_PARAM] === "string" ? params[RECORD_PARAM] : null;
  const detail = requested && rows.some((row) => row.id === requested) ? await loadApprovalDetail(requested, context) : null;
  const viewRows = rows.map((row) => ({ ...row, expiresLabel: t("expires", { time: format.relativeTime(new Date(row.expiresAt)) }) }));

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
        <ApprovalsView rows={viewRows} detail={detail} />
      )}
      {truncated ? (
        <p className="text-muted-foreground text-sm" data-testid="approvals-truncated">
          {t("truncated", { count: rows.length })}
        </p>
      ) : null}
    </div>
  );
}
