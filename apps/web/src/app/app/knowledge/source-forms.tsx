"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { createKnowledgeSource, deleteKnowledgeSource, updateKnowledgeSource } from "./actions";
import { BODY_MAX, TEXT_SOURCE_TYPES, TITLE_MAX, type KnowledgeFormState } from "./schema";

// Formularios de la pantalla de conocimiento (B20-3). Solo se enseñan al
// org_admin con aal2; lo que se puede guardar lo decide la base de datos.

const initial: KnowledgeFormState = { error: null, savedAt: null };
const fieldClass = "w-full rounded-md border border-input bg-background px-3 text-sm";

function FormError({ error }: { error: KnowledgeFormState["error"] }) {
  const t = useTranslations("knowledgePage");
  if (!error) return null;
  return (
    <p role="alert" className="text-destructive text-sm" data-testid="knowledge-error">
      {t(`errors.${error}`)}
    </p>
  );
}

function TitleAndBody({ title, body, disabled }: { title?: string; body?: string; disabled: boolean }) {
  const t = useTranslations("knowledgePage");
  const helpId = useId();
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.title")}
        <Input name="title" required maxLength={TITLE_MAX} defaultValue={title} disabled={disabled} data-testid="knowledge-title" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("fields.body")}
        <textarea
          name="body"
          required
          maxLength={BODY_MAX}
          rows={12}
          defaultValue={body}
          disabled={disabled}
          aria-describedby={helpId}
          className={`${fieldClass} py-2`}
          data-testid="knowledge-body"
        />
        <span id={helpId} className="text-muted-foreground text-xs">
          {t("bodyHelp")}
        </span>
      </label>
    </>
  );
}

/** Crear una fuente de texto. Se cierra al guardar (onSaved). */
export function CreateSourceForm({ locations, onSaved }: { locations: { id: string; name: string }[]; onSaved: () => void }) {
  const t = useTranslations("knowledgePage");
  const [state, action, pending] = useActionState(createKnowledgeSource, initial);
  useEffect(() => {
    if (state.savedAt) onSaved();
  }, [state.savedAt, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-3" data-testid="knowledge-create-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.type")}
          <select name="type" defaultValue="faq" disabled={pending} className={`${fieldClass} h-9`} data-testid="knowledge-type">
            {TEXT_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("fields.appliesTo")}
          <select name="locationId" defaultValue="" disabled={pending} className={`${fieldClass} h-9`} data-testid="knowledge-location">
            <option value="">{t("wholeOrganization")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TitleAndBody disabled={pending} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="self-end" data-testid="knowledge-create">
        {t("create")}
      </Button>
    </form>
  );
}

/** Cambiar el título o el texto. Cambiar el texto la vuelve a indexar. */
export function EditSourceForm({ id, title, body }: { id: string; title: string; body: string }) {
  const t = useTranslations("knowledgePage");
  const [state, action, pending] = useActionState(updateKnowledgeSource, initial);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="knowledge-edit-form">
      <input type="hidden" name="id" value={id} />
      <TitleAndBody title={title} body={body} disabled={pending} />
      <FormError error={state.error} />
      <div className="flex items-center justify-end gap-3">
        {state.savedAt && !pending ? (
          <span role="status" className="text-muted-foreground text-sm" data-testid="knowledge-saved">
            {t("saved")}
          </span>
        ) : null}
        <Button type="submit" disabled={pending} data-testid="knowledge-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Borrar, después de confirmarlo. */
export function DeleteSourceButton({ id }: { id: string }) {
  const t = useTranslations("knowledgePage");
  const [state, action, pending] = useActionState(deleteKnowledgeSource, initial);
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        trigger={
          <Button type="button" variant="outline" disabled={pending} data-testid="knowledge-delete">
            {t("delete")}
          </Button>
        }
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        variant="destructive"
        onConfirm={() => form.current?.requestSubmit()}
      />
      <FormError error={state.error} />
    </form>
  );
}
