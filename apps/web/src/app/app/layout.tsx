import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppSearchButton } from "@/components/app-command-center";
import { AppBrand } from "@/components/app-brand";
import { AppFrame } from "@/components/app-frame";
import { AppOrgSwitcher } from "@/components/app-org-switcher";
import { AppScopeSwitcher } from "@/components/app-scope-switcher";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { getOrgAgents } from "@/lib/agents-data";
import { requireUser } from "@/lib/auth/session";
import { parseSidebarCollapsed, parseTheme, SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/preferences";
import { getProfileName } from "@/lib/profile-data";
import { getScopeContext } from "@/lib/scope-data";
import { signOut } from "./actions";
import { setActiveOrganization } from "./organization-actions";

// App shell (MANUAL §9.2). El layout pinta la estructura; la comprobación que
// protege los datos está en cada página (requireUser, cerca de los datos):
// según la guía de Next.js, los layouts no se vuelven a renderizar al navegar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [cookieStore, scopeContext, name, tRoles] = await Promise.all([
    cookies(),
    // Sus organizaciones según RLS y la activa (active-org.ts).
    getScopeContext(),
    getProfileName(user.id),
    getTranslations("records.roles"),
  ]);
  const { options, organizations, organization, role } = scopeContext;
  // Del catálogo, con RLS (ADR 0030): la web no supone cuántos agentes hay.
  const agents = await getOrgAgents(organization?.id ?? null);

  return (
    <AppFrame
      agents={agents}
      topbar={<AppTopbar agents={agents} />}
      sidebar={
        <AppSidebar
          agents={agents}
          user={{
            name,
            email: user.email ?? "",
            context: organization && role ? `${tRoles(role)} · ${organization.name}` : null,
          }}
          signOutAction={signOut}
          theme={parseTheme(cookieStore.get(THEME_COOKIE)?.value)}
          defaultCollapsed={parseSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value)}
          header={
            <>
              <AppBrand />
              <AppOrgSwitcher organizations={organizations} activeId={organization?.id ?? null} action={setActiveOrganization} />
              <AppScopeSwitcher options={options} />
              <AppSearchButton />
            </>
          }
        />
      }
    >
      {children}
    </AppFrame>
  );
}
