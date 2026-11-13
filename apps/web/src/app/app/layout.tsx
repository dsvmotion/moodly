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
import { loadNeedsYouCounts } from "@/lib/needs-you-data";
import { getProfileName } from "@/lib/profile-data";
import { getScopeContext } from "@/lib/scope-data";
import { signOut } from "./actions";
import { setActiveOrganization } from "./organization-actions";
import { Toaster } from "@repo/ui/components/toast";

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
  const tCommon = await getTranslations("common");
  const { options, organizations, organization, role } = scopeContext;
  // Del catálogo, con RLS (ADR 0030): la web no supone cuántos agentes hay.
  // Los contadores de la barra (M-02) cuentan todo lo que ve la persona, no el
  // alcance elegido: un layout no recibe los parámetros de la URL.
  const [agents, needsYou] = await Promise.all([
    getOrgAgents(organization?.id ?? null),
    loadNeedsYouCounts(organization?.id ?? null, role, { kind: "any" }),
  ]);

  return (
    <AppFrame
      agents={agents}
      topbar={<AppTopbar agents={agents} />}
      sidebar={
        <AppSidebar
          agents={agents}
          counts={{ approvals: needsYou.approvals, inbox: needsYou.humanConversations }}
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
      {/* Los avisos de la app (auditoría M-10: el componente existía, pero nadie lo montaba). */}
      <Toaster label={tCommon("notifications", { hotkey: "F8" })} closeLabel={tCommon("closeNotification")} />
    </AppFrame>
  );
}
