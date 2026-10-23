import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { cn } from "@repo/ui/lib/utils";
import { requireUser } from "@/lib/auth/session";
import { AGENTS_NAV, isAgentKey } from "@/lib/navigation";

// Ventana de agente (P5, MANUAL §9.3) de uno de los 4 de serie (ADR 0023). Hasta
// que exista el catálogo de agentes (fase D: agent_types, agents, skills) dice
// qué hará el agente y que aún no está configurado. Sin datos inventados.
export default async function AgentPage({ params }: { params: Promise<{ tipo: string }> }) {
  await requireUser();
  const { tipo } = await params;
  if (!isAgentKey(tipo)) notFound();
  const agent = AGENTS_NAV.find((entry) => entry.key === tipo);
  const t = await getTranslations("agentPage");
  const tTypes = await getTranslations("nav.agentTypes");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("size-3 rounded-full", agent?.dotClass)} />
        <h1 className="text-xl font-semibold">{tTypes(tipo)}</h1>
        <span data-testid="agent-status" className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {t("notConfigured")}
        </span>
      </header>
      <p data-testid="agent-description" className="max-w-3xl text-sm text-muted-foreground">
        {t(`descriptions.${tipo}`)}
      </p>
      <EmptyState data-testid="agent-empty" title={t("emptyTitle")} description={t("emptyDescription")} />
    </div>
  );
}
