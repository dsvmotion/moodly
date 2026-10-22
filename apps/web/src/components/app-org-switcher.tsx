"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface Organization {
  id: string;
  name: string;
}

/**
 * Organización activa en la barra lateral. Con una sola, solo su nombre; con
 * varias, un selector que la cambia en el servidor (la cookie se valida allí).
 */
export function AppOrgSwitcher({
  organizations,
  activeId,
  action,
}: {
  organizations: Organization[];
  activeId: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("orgSwitcher");
  const pathname = usePathname();

  if (organizations.length <= 1) {
    return (
      <div data-testid="org-name" className="truncate px-2 py-1.5 text-sm font-semibold">
        {organizations.find((organization) => organization.id === activeId)?.name ?? ""}
      </div>
    );
  }

  return (
    <form action={action} className="px-2 py-1">
      <input type="hidden" name="returnTo" value={pathname} />
      <label htmlFor="org-switcher" className="sr-only">
        {t("label")}
      </label>
      <select
        id="org-switcher"
        name="organizationId"
        data-testid="org-switcher"
        defaultValue={activeId ?? undefined}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full truncate rounded-md border bg-transparent px-1.5 py-1 text-sm font-semibold"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 rounded-md border px-2 py-0.5 text-sm">
          {t("change")}
        </button>
      </noscript>
    </form>
  );
}
