"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { createInvitation, type InviteState } from "@/app/app/invitations-actions";

interface Option {
  id: string;
  name: string;
}

const initialState: InviteState = { error: null, link: null };

// Formulario de invitación (solo lo ve un org_admin). El enlace se muestra una
// sola vez: en la base solo queda el hash del token.
export function InviteForm({ organizationId, regions, locations }: { organizationId: string; regions: Option[]; locations: Option[] }) {
  const t = useTranslations("invitations");
  const tRoles = useTranslations("records.roles");
  const [state, formAction, pending] = useActionState(createInvitation, initialState);
  const [role, setRole] = useState("staff");
  const [copied, setCopied] = useState(false);
  const scopeOptions = role === "region_manager" ? regions : role === "org_admin" ? [] : locations;
  const fullLink = state.link && typeof window !== "undefined" ? `${window.location.origin}${state.link}` : state.link;

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="flex flex-col gap-1 text-sm">
          {t("email")}
          <input type="email" name="email" required autoComplete="off" className="rounded-md border px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("role")}
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border px-2 py-1.5">
            {(["staff", "location_manager", "region_manager", "org_admin"] as const).map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("scope")}
          <select name="scopeId" disabled={role === "org_admin"} className="rounded-md border px-2 py-1.5">
            {role === "org_admin" ? <option value="">{t("allOrg")}</option> : null}
            {scopeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="rounded-md border px-3 py-1.5 text-sm font-medium">
          {t("send")}
        </button>
      </form>
      {state.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      {fullLink ? (
        <div className="flex flex-col gap-2 text-sm" data-testid="invitation-link">
          <p>{t("linkReady")}</p>
          <code className="break-all rounded-md border px-2 py-1.5" data-testid="invitation-url">
            {fullLink}
          </code>
          <button
            type="button"
            className="self-start rounded-md border px-3 py-1.5"
            onClick={() => void navigator.clipboard.writeText(fullLink).then(() => setCopied(true))}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
