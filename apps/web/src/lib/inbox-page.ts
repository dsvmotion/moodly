import "server-only";
import { getOrgAgents } from "@/lib/agents-data";
import { parseInboxFilter, parseSearch, type InboxQuery } from "@/lib/inbox";
import { loadInboxConversations } from "@/lib/inbox-data";
import { scopeValue } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";

export interface InboxSearchParams {
  scope?: string | string[];
  status?: string | string[];
  q?: string | string[];
}

/** Lo que comparten la bandeja y una conversación abierta: el alcance, la pestaña, la lista y los nombres de los agentes. */
export async function loadInboxPage(params: InboxSearchParams) {
  const { scope, context } = await resolveScope(params.scope);
  const query: InboxQuery = {
    filter: parseInboxFilter(params.status),
    search: parseSearch(params.q),
    scope: scopeValue(scope),
  };
  const [conversations, agents] = await Promise.all([
    loadInboxConversations({
      scope,
      context,
      filter: query.filter,
      search: query.search,
    }),
    getOrgAgents(context.organization?.id ?? null),
  ]);
  const agentLabels = new Map(agents.map((agent) => [agent.key, agent.label]));
  return { scope, context, query, conversations, agentLabels };
}
