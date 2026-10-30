import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { cn } from "@repo/ui/lib/utils";
import { getOrgAgent } from "@/lib/agents-data";
import { requireUser } from "@/lib/auth/session";
import { getScopeContext } from "@/lib/scope-data";

// Ventana de agente (P5, MANUAL §9.3) de un agente de la organización activa,
// del catálogo (ADR 0030). Un agente que la organización no tiene no existe
// (404). Hasta que trabaje, dice qué hará y su estado. Sin datos inventados.
export default async function AgentPage({ params }: { params: Promise<{ type: string }> }) {
  await requireUser();
  const [{ type }, { organization }, t] = await Promise.all([params, getScopeContext(), getTranslations("agentPage")]);
  const agent = await getOrgAgent(organization?.id ?? null, type);
  if (!agent) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("size-3 rounded-full", agent.dotClass)} />
        <h1 className="text-xl font-semibold">{agent.label}</h1>
        <span data-testid="agent-status" className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {t(`status.${agent.status}`)}
        </span>
      </header>
      <p data-testid="agent-description" className="max-w-3xl text-sm text-muted-foreground">
        {agent.description}
      </p>
      <EmptyState data-testid="agent-empty" title={t("emptyTitle")} description={t("emptyDescription")} />
    </div>
  );
}
