"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_REPLY_LENGTH } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { decideApproval, type DecideState } from "@/app/app/approvals/actions";

const initial: DecideState = { error: null };

/**
 * Aprobar o rechazar una aprobación. Quien decide lo dice la base de datos
 * (RLS). `approveDisabled`: una reserva cuya hora ya pasó (OA02); la acción lo
 * vuelve a comprobar en el servidor. `editableText`: el texto de una respuesta
 * del agente, que quien aprueba puede corregir antes de aprobarla (OA02); al
 * rechazar no cuenta.
 */
export function ApprovalActions({
  id,
  approveDisabled = false,
  editableText,
}: {
  id: string;
  approveDisabled?: boolean;
  editableText?: string | undefined;
}) {
  const t = useTranslations("approvalsPage");
  const [state, action, pending] = useActionState(decideApproval, initial);
  const [text, setText] = useState(editableText ?? "");
  const fieldId = useId();
  const edited = editableText !== undefined && text.trim() !== editableText.trim();

  return (
    <form action={action} className="flex w-full flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {editableText !== undefined ? (
        <div className="flex w-full flex-col gap-1">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {t("edit.label")}
          </label>
          <textarea
            id={fieldId}
            name="text"
            rows={5}
            maxLength={MAX_REPLY_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={pending}
            aria-describedby={`${fieldId}-help`}
            className="border-input bg-background w-full resize-y rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            data-testid="approval-edit-text"
          />
          <div id={`${fieldId}-help`} className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
            <span data-testid="approval-edit-status">{edited ? t("edit.edited") : t("edit.help")}</span>
            <span>{t("edit.count", { count: text.trim().length, max: MAX_REPLY_LENGTH })}</span>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="rejected" variant="outline" size="sm" disabled={pending} data-testid="approval-reject">
          {t("reject")}
        </Button>
        <Button type="submit" name="decision" value="approved" size="sm" disabled={pending || approveDisabled} data-testid="approval-approve">
          {edited ? t("edit.approveEdited") : t("approve")}
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
