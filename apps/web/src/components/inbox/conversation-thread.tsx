import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { messageSide, THREAD_LIMIT } from "@/lib/inbox";
import type { InboxMessage, InboxThread } from "@/lib/inbox-data";

// Una conversación de la bandeja (P3): quién es, por dónde escribe, en qué local
// y quién la lleva (el agente, el equipo o nadie, si está cerrada), y el hilo:
// el cliente a un lado, el negocio (agente o equipo) al otro y los avisos del
// sistema en medio. Solo lectura: «tomar el control» llega con sus funciones.

export async function ConversationThread({
  thread,
  agentLabel,
  backHref,
}: {
  thread: InboxThread;
  agentLabel: string | null;
  backHref: string;
}) {
  const t = await getTranslations("inboxPage");
  const format = await getFormatter();
  const { conversation, messages } = thread;
  const contactName = conversation.contactName ?? t("unknownContact");

  return (
    <section aria-labelledby="inbox-thread-title" className="flex min-w-0 flex-col gap-4" data-testid="inbox-thread">
      <Link href={backHref} className="text-muted-foreground hover:text-foreground text-sm lg:hidden" data-testid="inbox-back">
        ← {t("back")}
      </Link>
      <header className="flex flex-col gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="inbox-thread-title" className="text-lg font-semibold break-words" data-testid="inbox-thread-contact">
            {contactName}
          </h2>
          <Badge variant={conversation.mode === "human" ? "default" : "muted"} data-testid="inbox-thread-mode">
            {t(`handledBy.${conversation.mode}`)}
          </Badge>
        </div>
        <p className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          <span data-testid="inbox-thread-location">{conversation.location ?? t("wholeOrganization")}</span>
          {conversation.channel ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{t(`channels.${conversation.channel}`)}</span>
            </>
          ) : null}
          {agentLabel ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{agentLabel}</span>
            </>
          ) : null}
        </p>
      </header>

      {thread.truncated ? (
        <p className="text-muted-foreground text-center text-xs" data-testid="inbox-thread-truncated">
          {t("truncated", { count: THREAD_LIMIT })}
        </p>
      ) : null}

      {messages.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="inbox-thread-empty">
          {t("noMessages")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="inbox-messages" aria-live="polite">
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              agentLabel={agentLabel}
              time={format.dateTime(new Date(message.createdAt), {
                dateStyle: "short",
                timeStyle: "short",
              })}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

async function Message({ message, agentLabel, time }: { message: InboxMessage; agentLabel: string | null; time: string }) {
  const t = await getTranslations("inboxPage");
  const side = messageSide(message.author);
  if (side === "center") {
    return (
      <li className="flex justify-center" data-testid="inbox-message" data-author={message.author}>
        <p className="bg-muted text-muted-foreground max-w-prose rounded-full px-3 py-1 text-center text-xs break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </li>
    );
  }
  const who = message.author === "agent" && agentLabel ? agentLabel : t(`author.${message.author}`);
  const problem = message.status === "failed" ? "failed" : message.status === "pending" ? "pending" : null;
  return (
    <li
      className={cn("flex flex-col gap-1", side === "start" ? "items-start" : "items-end")}
      data-testid="inbox-message"
      data-author={message.author}
    >
      <span className="text-muted-foreground text-xs">
        {who} · {time}
      </span>
      <p
        className={cn(
          "max-w-prose rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap",
          message.author === "contact" && "bg-muted",
          message.author === "agent" && "bg-primary text-primary-foreground",
          message.author === "user" && "bg-background border",
        )}
      >
        {message.content}
      </p>
      {problem ? (
        <span
          className={cn("text-xs", problem === "failed" ? "text-destructive" : "text-muted-foreground")}
          data-testid="inbox-message-status"
        >
          {t(`status.${problem}`)}
        </span>
      ) : null}
    </li>
  );
}
