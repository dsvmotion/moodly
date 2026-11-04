import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { cn } from "@repo/ui/lib/utils";
import { TestChat } from "@/components/test-chat/test-chat";
import { getOrgAgent } from "@/lib/agents-data";
import { requireUser } from "@/lib/auth/session";
import { locationsInScope, scopeValue, withScope } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";
import { findAgentId, loadTestChat } from "@/lib/test-chat-data";

// Ventana de agente (P5, MANUAL §9.3) de un agente de la organización activa,
// del catálogo (ADR 0030). Un agente que la organización no tiene no existe
// (404). Hasta que trabaje, dice qué hará y su estado, y se puede probar en un
// local del alcance con el chat de pruebas (paso 4d-3e), salvo en pausa.
export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ scope?: string | string[]; location?: string | string[] }>;
}) {
  const user = await requireUser();
  const [{ type }, query, t] = await Promise.all([params, searchParams, getTranslations("agentPage")]);
  const { scope, context } = await resolveScope(query.scope);
  const organization = context.organization;
  const agent = await getOrgAgent(organization?.id ?? null, type);
  if (!agent) notFound();

  // El chat de pruebas va en un local: el pedido, si está en el alcance; si no, el primero.
  const locations = locationsInScope(scope, context.locations);
  const wanted = typeof query.location === "string" ? query.location : null;
  const location = locations.find((candidate) => candidate.id === wanted) ?? locations[0] ?? null;
  const agentId = organization && location && agent.status !== "paused" ? await findAgentId(organization.id, type) : null;
  const chat =
    organization && location && agentId
      ? await loadTestChat({ organizationId: organization.id, agentId, locationId: location.id, userId: user.id })
      : null;
  const linkTo = (locationId: string) => withScope(`${agent.href}?location=${locationId}`, scopeValue(scope));

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
      {chat && agentId && location ? (
        <TestChat
          agentId={agentId}
          agentLabel={agent.label}
          chat={chat}
          location={{ id: location.id, name: location.name, href: linkTo(location.id) }}
          locations={locations.map((candidate) => ({ id: candidate.id, name: candidate.name, href: linkTo(candidate.id) }))}
        />
      ) : null}
      <EmptyState data-testid="agent-empty" title={t("emptyTitle")} description={t("emptyDescription")} />
    </div>
  );
}
