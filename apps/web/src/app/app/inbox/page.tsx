import { getTranslations } from "next-intl/server";
import { ConversationList } from "@/components/inbox/conversation-list";
import { InboxLayout } from "@/components/inbox/inbox-layout";
import { requireUser } from "@/lib/auth/session";
import { loadInboxPage, type InboxSearchParams } from "@/lib/inbox-page";

// Bandeja de conversaciones (MANUAL §9.4, P2 + P3): las conversaciones del
// alcance de cada persona, con su último mensaje. Solo lectura: «tomar el
// control» y responder como equipo llegan con sus funciones en la base de datos.

export default async function InboxPage({ searchParams }: { searchParams: Promise<InboxSearchParams> }) {
  await requireUser();
  const [{ query, conversations, agentLabels }, t] = await Promise.all([
    searchParams.then(loadInboxPage),
    getTranslations("inboxPage"),
  ]);
  return (
    <InboxLayout
      hasSelection={false}
      list={<ConversationList conversations={conversations} query={query} agentLabels={agentLabels} />}
      detail={
        <p className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm" data-testid="inbox-choose">
          {t("choose")}
        </p>
      }
    />
  );
}
