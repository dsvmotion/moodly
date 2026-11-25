"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { decideApproval, type DecideState } from "@/app/app/approvals/actions";

const initial: DecideState = { error: null };

/**
 * Aprobar o rechazar una aprobación. Quien decide lo dice la base de datos
 * (RLS). `approveDisabled`: una reserva cuya hora ya pasó (OA02); la acción lo
 * vuelve a comprobar en el servidor.
 */
export function ApprovalActions({ id, approveDisabled = false }: { id: string; approveDisabled?: boolean }) {
  const t = useTranslations("approvalsPage");
  const [state, action, pending] = useActionState(decideApproval, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="rejected" variant="outline" size="sm" disabled={pending} data-testid="approval-reject">
          {t("reject")}
        </Button>
        <Button type="submit" name="decision" value="approved" size="sm" disabled={pending || approveDisabled} data-testid="approval-approve">
          {t("approve")}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm" data-testid="approval-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}
