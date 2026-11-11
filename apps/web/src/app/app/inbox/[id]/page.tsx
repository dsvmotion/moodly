import { notFound } from "next/navigation";
import { ConversationList } from "@/components/inbox/conversation-list";
import { ConversationThread } from "@/components/inbox/conversation-thread";
import { InboxLayout } from "@/components/inbox/inbox-layout";
import { requireUser } from "@/lib/auth/session";
import { inboxHref } from "@/lib/inbox";
import { loadInboxThread } from "@/lib/inbox-data";
import { loadInboxPage, type InboxSearchParams } from "@/lib/inbox-page";

// Una conversación abierta en la bandeja (P3), con la lista al lado. Una
// conversación que no existe, que la persona no puede ver (RLS), que no entra
// en el alcance elegido o que es del chat de pruebas da 404: no se distingue
// entre «no existe» y «no es tuya».

export default async function InboxConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<InboxSearchParams>;
}) {
  await requireUser();
  const [{ id }, page] = await Promise.all([params, searchParams.then(loadInboxPage)]);
  const thread = await loadInboxThread({
    id,
    scope: page.scope,
    context: page.context,
  });
  if (!thread) notFound();

  const agentKey = thread.conversation.agentKey;
  return (
    <InboxLayout
      hasSelection
      list={
        <ConversationList
          conversations={page.conversations}
          older={page.older}
          query={page.query}
          selectedId={id}
          agentLabels={page.agentLabels}
        />
      }
      detail={
        <ConversationThread
          thread={thread}
          agentLabel={agentKey ? (page.agentLabels.get(agentKey) ?? null) : null}
          backHref={inboxHref(page.query)}
        />
      }
    />
  );
}
