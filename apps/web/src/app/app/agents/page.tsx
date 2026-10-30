import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { cn } from "@repo/ui/lib/utils";
import { getOrgAgents } from "@/lib/agents-data";
import { requireUser } from "@/lib/auth/session";
import { withScope } from "@/lib/scope";
import { getScopeContext } from "@/lib/scope-data";

// Agentes (P2, MANUAL §9.4): los de la organización activa, del catálogo (ADR
// 0030): hoy los 4 de serie; los de plantilla y los propios saldrán aquí solos.
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  // El alcance elegido viaja con la navegación (MANUAL §9.4), como en la barra lateral.
  const { scope } = await searchParams;
  const [{ organization }, t] = await Promise.all([getScopeContext(), getTranslations("agentPage")]);
  const agents = await getOrgAgents(organization?.id ?? null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">{t("intro")}</p>
      {agents.length === 0 ? (
        <EmptyState data-testid="agents-empty" title={t("noAgentsTitle")} description={t("noAgentsDescription")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="agent-cards">
          {agents.map((agent) => (
            <li key={agent.key}>
              <Link
                href={withScope(agent.href, typeof scope === "string" ? scope : null)}
                className="flex h-full flex-col gap-2 rounded-lg border p-4 hover:bg-muted"
                data-testid={`agent-card-${agent.key}`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden="true" className={cn("size-2.5 rounded-full", agent.dotClass)} />
                  {agent.label}
                </span>
                <span className="text-sm text-muted-foreground">{agent.description}</span>
                <span className="mt-auto text-xs text-muted-foreground">{t(`status.${agent.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
