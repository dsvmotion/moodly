import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import {
  DEFAULT_INBOX_FILTER,
  inboxHref,
  INBOX_FILTERS,
  SEARCH_MAX_LENGTH,
  SEARCH_PARAM,
  STATUS_PARAM,
  type InboxQuery,
} from "@/lib/inbox";
import type { InboxConversation } from "@/lib/inbox-data";
import { SCOPE_PARAM } from "@/lib/scope";

// La lista de la bandeja (P2): pestañas por estado, búsqueda por nombre y una
// fila por conversación con su último mensaje. Todo vive en la URL (MANUAL
// §9.4): filtro, búsqueda, alcance, página y conversación abierta. Cambiar de
// pestaña o buscar vuelve a la primera página.

export async function ConversationList({
  conversations,
  older,
  query,
  selectedId,
  agentLabels,
}: {
  conversations: InboxConversation[];
  /** El cursor de la página anterior en el tiempo, o null si no hay más. */
  older: string | null;
  query: InboxQuery;
  selectedId?: string | undefined;
  agentLabels: ReadonlyMap<string, string>;
}) {
  const t = await getTranslations("inboxPage");
  const format = await getFormatter();

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="inbox-list-panel">
      <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2 text-sm">
        {INBOX_FILTERS.map((filter) => (
          <Link
            key={filter}
            href={inboxHref({ ...query, filter, before: null })}
            aria-current={filter === query.filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1",
              filter === query.filter ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent",
            )}
            data-testid="inbox-filter"
          >
            {t(`filters.${filter}`)}
          </Link>
        ))}
      </nav>

      <form role="search" action="/app/inbox" className="flex gap-2" aria-label={t("searchLabel")}>
        {query.filter !== DEFAULT_INBOX_FILTER ? <input type="hidden" name={STATUS_PARAM} value={query.filter} /> : null}
        {query.scope && query.scope !== "all" ? <input type="hidden" name={SCOPE_PARAM} value={query.scope} /> : null}
        <label htmlFor="inbox-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <Input
          id="inbox-search"
          type="search"
          name={SEARCH_PARAM}
          defaultValue={query.search}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder={t("searchPlaceholder")}
          data-testid="inbox-search"
        />
        <Button type="submit" variant="outline">
          {t("search")}
        </Button>
      </form>

      {query.before ? (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href={inboxHref({ ...query, before: null })} data-testid="inbox-newest">
            {t("newest")}
          </Link>
        </Button>
      ) : null}

      {conversations.length === 0 ? (
        <EmptyState
          data-testid="inbox-empty"
          title={query.search ? t("noResultsTitle") : t(`emptyTitle.${query.filter}`)}
          description={query.search ? t("noResults", { search: query.search }) : t(`empty.${query.filter}`)}
        />
      ) : (
        <ul className="flex flex-col gap-1" data-testid="inbox-list">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedId;
            return (
              <li key={conversation.id}>
                <Link
                  href={inboxHref(query, conversation.id)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm",
                    selected ? "bg-accent border-border" : "hover:bg-accent border-transparent",
                  )}
                  data-testid="inbox-conversation"
                  data-conversation-id={conversation.id}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium" data-testid="inbox-contact">
                      {conversation.contactName ?? t("unknownContact")}
                    </span>
                    {conversation.lastMessageAt ? (
                      <time dateTime={conversation.lastMessageAt} className="text-muted-foreground shrink-0 text-xs">
                        {format.relativeTime(new Date(conversation.lastMessageAt))}
                      </time>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground line-clamp-2 break-words" data-testid="inbox-preview">
                    {conversation.preview
                      ? `${conversation.preview.author === "contact" ? "" : `${t(`author.${conversation.preview.author}`)}: `}${conversation.preview.text}`
                      : t("noMessages")}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <span data-testid="inbox-mode">{t(`mode.${conversation.mode}`)}</span>
                    <span aria-hidden="true">·</span>
                    <span data-testid="inbox-location">{conversation.location ?? t("wholeOrganization")}</span>
                    {conversation.channel ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t(`channels.${conversation.channel}`)}</span>
                      </>
                    ) : null}
                    {conversation.agentKey && agentLabels.has(conversation.agentKey) ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{agentLabels.get(conversation.agentKey)}</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {older ? (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href={inboxHref({ ...query, before: older })} data-testid="inbox-older">
            {t("older")}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
