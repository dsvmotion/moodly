import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { CheckIcon, HomeIcon, ShieldIcon, UsersIcon } from "@repo/ui/lib/icons";
import { cn } from "@repo/ui/lib/utils";
import { hasVerifiedFactor, requireUser } from "@/lib/auth/session";
import { getOrgAgents } from "@/lib/agents-data";
import { settingsSection } from "@/lib/navigation";
import { getProfileName } from "@/lib/profile-data";
import { locationsInScope, withScope } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/user-display";

// Inicio (P1, MANUAL §9.4; auditoría del frontend, F-2): el destino tras el
// login. Solo con lo que existe de verdad: quién eres y dónde, lo que tienes
// pendiente (segundo factor, invitaciones), tus agentes y tu alcance. La bandeja
// del día llega con los agentes; hasta entonces lo dice.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  const user = await requireUser();
  const rawScope = (await searchParams).scope;
  const [{ scope, context }, name, t, tRoles, tAgentPage, tSections] = await Promise.all([
    resolveScope(rawScope),
    getProfileName(user.id),
    getTranslations("home"),
    getTranslations("records.roles"),
    getTranslations("agentPage"),
    getTranslations("sections.home"),
  ]);
  const scopeParam = typeof rawScope === "string" ? rawScope : null;
  const mfa = hasVerifiedFactor(user);
  const isAdmin = context.role === "org_admin";
  const locations = locationsInScope(scope, context.locations);
  const agents = await getOrgAgents(context.organization?.id ?? null);

  // Invitaciones pendientes: RLS solo se las enseña a un org_admin.
  let pendingInvitations = 0;
  if (isAdmin && context.organization) {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organization.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    if (error) throw new Error("No se pudieron contar las invitaciones pendientes", { cause: error });
    pendingInvitations = count ?? 0;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" data-testid="home-greeting">
          {t("greeting", { name: displayName(name, user.email ?? "") })}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="home-context">
          {context.organization && context.role
            ? `${context.organization.name} · ${tRoles(context.role)}`
            : t("noOrganization")}
        </p>
      </header>

      <section aria-labelledby="home-todo" className="flex flex-col gap-3">
        <h2 id="home-todo" className="font-semibold">
          {t("todo")}
        </h2>
        <ul className="flex flex-col divide-y rounded-lg border" data-testid="home-todo">
          <li className="flex items-center gap-3 px-4 py-3" data-testid="home-task-mfa" data-done={mfa}>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
                mfa ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {mfa ? <CheckIcon /> : <ShieldIcon />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{mfa ? t("mfaDone") : t("mfaTodo")}</span>
              {!mfa && isAdmin ? <span className="text-xs text-muted-foreground">{t("mfaRequired")}</span> : null}
            </span>
            {mfa ? null : (
              <Link href={withScope(settingsSection("security").href, scopeParam)} className="text-sm underline underline-offset-4">
                {t("mfaAction")}
              </Link>
            )}
          </li>
          {pendingInvitations > 0 ? (
            <li className="flex items-center gap-3 px-4 py-3" data-testid="home-task-invitations">
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
                <UsersIcon />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{t("invitations", { count: pendingInvitations })}</span>
              <Link href={withScope(settingsSection("organization").href, scopeParam)} className="text-sm underline underline-offset-4">
                {t("invitationsAction")}
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="home-agents" className="flex flex-col gap-3">
          <h2 id="home-agents" className="font-semibold">
            {t("agents")}
          </h2>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="home-agents-empty">
              {tAgentPage("noAgentsDescription")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="home-agents">
              {agents.map((agent) => (
                <li key={agent.key}>
                  <Link
                    href={withScope(agent.href, scopeParam)}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-accent"
                  >
                    <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", agent.dotClass)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{agent.label}</span>
                    <span className="text-xs text-muted-foreground">{tAgentPage(`status.${agent.status}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-scope" className="flex flex-col gap-3">
          <h2 id="home-scope" className="font-semibold">
            {t("scope")}
          </h2>
          <div className="flex flex-col gap-1 rounded-lg border px-4 py-3">
            <p className="text-sm" data-testid="home-locations">
              {t("locations", { count: locations.length })}
            </p>
            <Link href={withScope(settingsSection("locations").href, scopeParam)} className="text-sm underline underline-offset-4">
              {t("locationsAction")}
            </Link>
          </div>
        </section>
      </div>

      <section aria-labelledby="home-inbox" className="flex flex-col gap-3">
        <h2 id="home-inbox" className="font-semibold">
          {t("inbox")}
        </h2>
        <EmptyState data-testid="home-inbox-empty" icon={<HomeIcon />} title={t("inboxEmpty")} description={tSections("description")} />
      </section>
    </div>
  );
}
