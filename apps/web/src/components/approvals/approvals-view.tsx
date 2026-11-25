"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { PreviewAttributes, PreviewDrawer } from "@repo/ui/components/preview-drawer";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { LocalTime } from "@/components/local-time";
import { useRecordParam } from "@/components/records/use-record-param";
import type { ApprovalDetail, DetailMessage } from "@/lib/approval-detail-data";
import type { ApprovalRow } from "@/lib/approvals-data";
import { isKnownSkill } from "@/lib/skill-labels";

// La bandeja de aprobaciones (paso 4d-3d) con el detalle de cada una en el
// panel lateral (OA02, P4): lo que se aprueba, la conversación de la que salió
// y por qué. El detalle lo carga el servidor para la aprobación abierta
// (?record=<id>), con la sesión de quien mira.

const EXECUTION_STATUSES = ["suggested", "drafted", "needs_approval", "approved", "rejected", "executed", "failed"] as const;
const ROLES = ["org_admin", "region_manager", "location_manager", "staff"] as const;
const AUTHORS = ["contact", "agent", "user", "system"] as const;
const isOneOf = <T extends string>(values: readonly T[], value: string): value is T => (values as readonly string[]).includes(value);

/** La fila con la caducidad ya escrita en el servidor: así no cambia al hidratar. */
export type ApprovalViewRow = ApprovalRow & { expiresLabel: string };

function useSkillLabel() {
  const t = useTranslations("approvalsPage");
  return (key: string) => (isKnownSkill(key) ? t(`skills.${key}`) : key);
}

function When({ iso, detail }: { iso: string | null; detail: ApprovalDetail }) {
  const t = useTranslations("approvalsPage.detail");
  if (!iso) return <span className="text-muted-foreground">{t("unknown")}</span>;
  return <LocalTime iso={iso} timeZone={detail.timeZone} alwaysShowZone={detail.alwaysShowZone} />;
}

function What({ detail }: { detail: ApprovalDetail }) {
  const t = useTranslations("approvalsPage.detail");
  const what = detail.what;
  const unknown = <span className="text-muted-foreground">{t("unknown")}</span>;
  switch (what.kind) {
    case "reply":
      return (
        <blockquote className="bg-muted/40 rounded-md border px-3 py-2 text-sm break-words whitespace-pre-wrap" data-testid="approval-detail-text">
          {what.text}
        </blockquote>
      );
    case "booking":
      return (
        <PreviewAttributes
          items={[
            { label: t("service"), value: what.service ?? unknown },
            { label: t("resource"), value: what.resource ?? unknown },
            { label: t("startsAt"), value: <When iso={what.startsAt} detail={detail} /> },
          ]}
        />
      );
    case "reschedule":
      return (
        <PreviewAttributes
          items={[
            { label: t("service"), value: what.service ?? unknown },
            { label: t("resource"), value: what.resource ?? unknown },
            { label: t("from"), value: <When iso={what.from} detail={detail} /> },
            { label: t("to"), value: <When iso={what.startsAt} detail={detail} /> },
          ]}
        />
      );
    case "cancel":
      return (
        <PreviewAttributes
          items={[
            { label: t("service"), value: what.service ?? unknown },
            { label: t("startsAt"), value: <When iso={what.startsAt} detail={detail} /> },
          ]}
        />
      );
    default:
      return <p className="text-sm break-words">{detail.summary}</p>;
  }
}

function Message({ message, detail }: { message: DetailMessage; detail: ApprovalDetail }) {
  const t = useTranslations("approvalsPage.detail");
  const author = isOneOf(AUTHORS, message.author) ? t(`authors.${message.author}`) : message.author;
  return (
    <li className="flex flex-col gap-0.5" data-testid="approval-detail-message">
      <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
        <span className="font-medium">{author}</span>
        <LocalTime iso={message.createdAt} timeZone={detail.timeZone} alwaysShowZone={detail.alwaysShowZone} />
      </div>
      <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
    </li>
  );
}

function DetailBody({ detail }: { detail: ApprovalDetail }) {
  const t = useTranslations("approvalsPage.detail");
  const tRoles = useTranslations("records.roles");
  const format = useFormatter();
  const skillLabel = useSkillLabel();
  const role = isOneOf(ROLES, detail.requiredRole) ? tRoles(detail.requiredRole) : detail.requiredRole;
  const run = detail.run;

  return (
    <div className="flex flex-col gap-6" data-testid="approval-detail">
      <section className="flex flex-col gap-2" aria-labelledby="approval-detail-what">
        <h3 id="approval-detail-what" className="text-sm font-semibold">
          {t("what")}
        </h3>
        <What detail={detail} />
        {detail.slotPassed ? (
          <p role="alert" className="text-destructive text-sm" data-testid="approval-detail-slot-passed">
            {t("slotPassed")}
          </p>
        ) : null}
        <PreviewAttributes
          items={[
            { label: t("location"), value: detail.location ?? t("wholeOrganization") },
            { label: t("decides"), value: role },
            { label: t("requested"), value: <When iso={detail.createdAt} detail={detail} /> },
            { label: t("expires"), value: <When iso={detail.expiresAt} detail={detail} /> },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="approval-detail-conversation">
        <h3 id="approval-detail-conversation" className="text-sm font-semibold">
          {t("conversation")}
        </h3>
        {detail.conversation ? (
          <>
            <p className="text-muted-foreground text-sm" data-testid="approval-detail-contact">
              {detail.conversation.contact ?? t("unknownContact")}
            </p>
            {detail.conversation.messages.length > 0 ? (
              <ol className="flex flex-col gap-3" data-testid="approval-detail-messages">
                {detail.conversation.messages.map((message, index) => (
                  <Message key={`${message.createdAt}-${index}`} message={message} detail={detail} />
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noMessages")}</p>
            )}
            <Link
              href={`/app/inbox/${detail.conversation.id}`}
              className="text-sm font-medium underline underline-offset-4"
              data-testid="approval-detail-open-conversation"
            >
              {t("openConversation")}
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground text-sm" data-testid="approval-detail-no-conversation">
            {t("noConversation")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="approval-detail-why">
        <h3 id="approval-detail-why" className="text-sm font-semibold">
          {t("why")}
        </h3>
        {run ? (
          <>
            <PreviewAttributes
              items={[
                { label: t("agent"), value: run.agent ?? t("unknown") },
                { label: t("model"), value: run.model ?? t("unknown") },
                {
                  label: t("cost"),
                  value: run.costEur === null ? t("unknown") : format.number(run.costEur, { style: "currency", currency: "EUR", maximumFractionDigits: 4 }),
                },
                {
                  label: t("tokens"),
                  value: run.tokensIn === null && run.tokensOut === null ? t("unknown") : t("tokensValue", { in: run.tokensIn ?? 0, out: run.tokensOut ?? 0 }),
                },
              ]}
            />
            {run.others.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs">{t("others")}</p>
                <ul className="flex flex-col gap-1" data-testid="approval-detail-others">
                  {run.others.map((other, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{skillLabel(other.skillKey)}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {isOneOf(EXECUTION_STATUSES, other.status) ? t(`statuses.${other.status}`) : other.status}
                      </span>
                      {other.summary ? <span className="min-w-0 break-words">{other.summary}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t("unknown")}</p>
        )}
      </section>
    </div>
  );
}

export function ApprovalsView({ rows, detail }: { rows: ApprovalViewRow[]; detail: ApprovalDetail | null }) {
  const t = useTranslations("approvalsPage");
  const skillLabel = useSkillLabel();
  const { selected, open, close } = useRecordParam(rows);
  // El detalle es el de la aprobación abierta, y solo si sigue en la lista.
  const shown = selected && detail?.id === selected.id ? detail : null;

  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg border" data-testid="approvals-list">
        {rows.map((row) => (
          <li key={row.id} data-testid="approval" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium break-words" data-testid="approval-summary">
                {row.summary}
              </p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge>{skillLabel(row.skillKey)}</Badge>
                <span data-testid="approval-location">{row.location ?? t("wholeOrganization")}</span>
                <span>·</span>
                <span>{row.expiresLabel}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => open(row)} data-testid="approval-open">
                {t("openDetail")}
              </Button>
              <ApprovalActions id={row.id} />
            </div>
          </li>
        ))}
      </ul>
      <PreviewDrawer
        open={selected !== null}
        onOpenChange={(next) => (next ? undefined : close())}
        title={selected ? skillLabel(selected.skillKey) : ""}
        description={selected?.summary}
        closeLabel={t("close")}
        footer={
          selected ? (
            // key: al cambiar de aprobación o al llegar el detalle, el texto editable vuelve a ser el del agente.
            <ApprovalActions
              key={`${selected.id}:${shown ? "detail" : "loading"}`}
              id={selected.id}
              approveDisabled={shown?.slotPassed ?? false}
              editableText={shown?.what.kind === "reply" ? shown.what.text : undefined}
            />
          ) : null
        }
      >
        {shown ? <DetailBody detail={shown} /> : <p className="text-muted-foreground text-sm">{t("detail.loading")}</p>}
      </PreviewDrawer>
    </>
  );
}
