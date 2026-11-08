import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { isKnownSkill } from "@/lib/skill-labels";
import type { TestChat as TestChatData, TestChatStep } from "@/lib/test-chat";
import { TestChatForm, TestChatRestart } from "./test-chat-form";
import { TestChatRefresh } from "./test-chat-refresh";

// El chat de pruebas de un agente (paso 4d-3e, MANUAL §5.1 y §9.6): la persona
// escribe como si fuera un cliente y ve, debajo de cada mensaje suyo, lo que
// hizo el agente. Lo que espera a una persona se aprueba o rechaza aquí mismo
// (o en Aprobaciones): es real, como en una conversación de un cliente.

const STEP_STATUSES = ["suggested", "drafted", "needs_approval", "approved", "rejected", "executed", "failed"] as const;
type StepStatus = (typeof STEP_STATUSES)[number];
const isStepStatus = (status: string): status is StepStatus => (STEP_STATUSES as readonly string[]).includes(status);

const REPLY_SKILL = "reply";

export interface TestChatLocation {
  id: string;
  name: string;
  href: string;
}

export async function TestChat({
  agentId,
  agentLabel,
  chat,
  location,
  locations,
}: {
  agentId: string;
  agentLabel: string;
  chat: TestChatData;
  location: TestChatLocation;
  locations: TestChatLocation[];
}) {
  const t = await getTranslations("testChat");
  const tSkills = await getTranslations("approvalsPage.skills");
  const runsByMessage = new Map(chat.runs.map((run) => [run.messageId, run]));

  return (
    <section aria-labelledby="test-chat-title" className="flex flex-col gap-4 rounded-lg border p-4" data-testid="test-chat">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="test-chat-title" className="text-base font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">{t("description")}</p>
        </div>
        {chat.conversationId ? <TestChatRestart conversationId={chat.conversationId} /> : null}
      </header>

      {locations.length > 1 ? (
        <nav aria-label={t("locationLabel")} className="flex flex-wrap gap-2 text-sm">
          {locations.map((candidate) => (
            <Link
              key={candidate.id}
              href={candidate.href}
              aria-current={candidate.id === location.id ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1",
                candidate.id === location.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent",
              )}
              data-testid="test-chat-location"
            >
              {candidate.name}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="text-muted-foreground text-sm" data-testid="test-chat-location">
          {t("inLocation", { location: location.name })}
        </p>
      )}

      <p className="bg-muted rounded-md px-3 py-2 text-sm" data-testid="test-chat-warning">
        {t("realWarning")}
      </p>

      {chat.messages.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="test-chat-empty">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="test-chat-messages" aria-live="polite">
          {chat.messages.map((message) => {
            const fromPerson = message.author === "contact";
            const run = fromPerson ? runsByMessage.get(message.id) : undefined;
            // La respuesta ya enviada se ve como mensaje del agente: no se repite como paso.
            const steps = run?.steps.filter((step) => !(step.skillKey === REPLY_SKILL && step.status === "executed")) ?? [];
            return (
              <li key={message.id} className={cn("flex flex-col gap-1", fromPerson ? "items-end" : "items-start")}>
                <span className="text-muted-foreground text-xs">{fromPerson ? t("you") : agentLabel}</span>
                <p
                  className={cn(
                    "max-w-prose rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap",
                    fromPerson ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                  data-testid={fromPerson ? "test-chat-mine" : "test-chat-agent"}
                >
                  {message.content}
                </p>
                {steps.length > 0 ? (
                  <ul className="flex w-full max-w-prose flex-col gap-2" data-testid="test-chat-steps">
                    {steps.map((step) => (
                      <Step key={step.id} step={step} skillLabel={isKnownSkill(step.skillKey) ? tSkills(step.skillKey) : step.skillKey} />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {chat.waiting ? (
        <p className="text-muted-foreground text-sm" role="status" data-testid="test-chat-waiting">
          {t("waiting", { agent: agentLabel })}
        </p>
      ) : null}
      <TestChatRefresh active={chat.waiting} />
      <TestChatForm agentId={agentId} locationId={location.id} disabled={false} />
    </section>
  );
}

async function Step({ step, skillLabel }: { step: TestChatStep; skillLabel: string }) {
  const t = await getTranslations("testChat");
  const pending = step.approval?.status === "pending";
  return (
    <li className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-start sm:justify-between" data-testid="test-chat-step">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge>{skillLabel}</Badge>
          <span className="text-muted-foreground" data-testid="test-chat-step-status">
            {pending ? t("steps.pending") : isStepStatus(step.status) ? t(`steps.${step.status}`) : step.status}
          </span>
        </div>
        {step.summary ? <p className="text-sm break-words">{step.summary}</p> : null}
      </div>
      {pending && step.approval ? <ApprovalActions id={step.approval.id} /> : null}
    </li>
  );
}
