import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@repo/ui/lib/utils";
import { requireUser } from "@/lib/auth/session";
import { AGENTS_NAV } from "@/lib/navigation";
import { withScope } from "@/lib/scope";

// Agentes (P2, MANUAL §9.4): los 4 de serie (ADR 0023) con lo que hace cada uno.
// Los agentes de plantilla y propios llegan con el catálogo (ADR 0030, fase D).
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  // El alcance elegido viaja con la navegación (MANUAL §9.4), como en la barra lateral.
  const { scope } = await searchParams;
  const t = await getTranslations("agentPage");
  const tTypes = await getTranslations("nav.agentTypes");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="agent-cards">
        {AGENTS_NAV.map((agent) => (
          <li key={agent.key}>
            <Link
              href={withScope(agent.href, typeof scope === "string" ? scope : null)}
              className="flex h-full flex-col gap-2 rounded-lg border p-4 hover:bg-muted"
              data-testid={`agent-card-${agent.key}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", agent.dotClass)} />
                {tTypes(agent.key)}
              </span>
              <span className="text-sm text-muted-foreground">{t(`descriptions.${agent.key}`)}</span>
              <span className="mt-auto text-xs text-muted-foreground">{t("notConfigured")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
