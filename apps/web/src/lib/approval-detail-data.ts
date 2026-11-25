import { parseApprovalInput, slotHasPassed, type ApprovalInput } from "@/lib/approval-input";
import type { ScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, needsZoneLabel } from "@/lib/time-zone";

// El detalle de una aprobación (OA02): lo que se aprueba, por skill; la
// conversación de la que salió; y por qué (el run del agente). Todo con la
// sesión de quien mira: RLS decide qué puede ver, y lo que no ve sale vacío,
// nunca con otra llave. Solo se pide para una aprobación de la lista (que ya
// filtró el alcance y el rol): la página no carga el detalle de ninguna otra.

/** Cuántos mensajes de la conversación se enseñan: los últimos. */
export const DETAIL_MESSAGES = 10;

export interface DetailMessage {
  author: "contact" | "agent" | "user" | "system";
  content: string;
  createdAt: string;
}

export type ApprovalWhat =
  | { kind: "reply"; text: string }
  | { kind: "booking"; service: string | null; resource: string | null; startsAt: string }
  | { kind: "reschedule"; service: string | null; resource: string | null; from: string | null; startsAt: string }
  | { kind: "cancel"; service: string | null; startsAt: string | null }
  | { kind: "other" };

export interface ApprovalDetail {
  id: string;
  summary: string;
  skillKey: string;
  requiredRole: string;
  location: string | null;
  /** La zona horaria del local (o la de por defecto): las horas se enseñan en ella. */
  timeZone: string;
  /** La organización tiene locales en más de una zona: las horas llevan la suya. */
  alwaysShowZone: boolean;
  createdAt: string;
  expiresAt: string;
  what: ApprovalWhat;
  /** Una reserva o un cambio cuya hora ya pasó: no se puede aprobar. */
  slotPassed: boolean;
  conversation: { id: string; contact: string | null; messages: DetailMessage[] } | null;
  run: {
    agent: string | null;
    model: string | null;
    costEur: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    /** Lo demás que hizo el agente en ese turno (sin esta ejecución). */
    others: { skillKey: string; status: string; summary: string | null }[];
  } | null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

const summaryOf = (preview: unknown): string | null => {
  if (typeof preview !== "object" || preview === null) return null;
  const summary = (preview as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : null;
};

async function nameOf(supabase: Supabase, table: "services" | "booking_resources", id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from(table).select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

async function appointmentOf(supabase: Supabase, id: string): Promise<{ startsAt: string; service: string | null; resourceId: string } | null> {
  const { data } = await supabase.from("appointments").select("starts_at, resource_id, service:services(name)").eq("id", id).maybeSingle();
  if (!data) return null;
  return { startsAt: data.starts_at, service: data.service?.name ?? null, resourceId: data.resource_id };
}

async function whatOf(supabase: Supabase, input: ApprovalInput): Promise<ApprovalWhat> {
  switch (input.kind) {
    case "reply":
      return input;
    case "booking": {
      const [service, resource] = await Promise.all([nameOf(supabase, "services", input.serviceId), nameOf(supabase, "booking_resources", input.resourceId)]);
      return { kind: "booking", service, resource, startsAt: input.startsAt };
    }
    case "reschedule": {
      const current = await appointmentOf(supabase, input.appointmentId);
      const resource = await nameOf(supabase, "booking_resources", input.resourceId ?? current?.resourceId ?? null);
      return { kind: "reschedule", service: current?.service ?? null, resource, from: current?.startsAt ?? null, startsAt: input.startsAt };
    }
    case "cancel": {
      const current = await appointmentOf(supabase, input.appointmentId);
      return { kind: "cancel", service: current?.service ?? null, startsAt: current?.startsAt ?? null };
    }
    default:
      return { kind: "other" };
  }
}

async function conversationOf(supabase: Supabase, trigger: string, triggerRef: string | null): Promise<ApprovalDetail["conversation"]> {
  if (trigger !== "inbound_message" || !triggerRef) return null;
  const { data: message } = await supabase.from("messages").select("conversation_id").eq("id", triggerRef).maybeSingle();
  if (!message) return null;
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id, contact:contacts(display_name)").eq("id", message.conversation_id).maybeSingle(),
    supabase
      .from("messages")
      .select("author, content, created_at")
      .eq("conversation_id", message.conversation_id)
      .order("created_at", { ascending: false })
      .limit(DETAIL_MESSAGES),
  ]);
  if (!conversation) return null;
  return {
    id: conversation.id,
    contact: conversation.contact?.display_name ?? null,
    messages: [...(messages ?? [])].reverse().map((row) => ({ author: row.author as DetailMessage["author"], content: row.content, createdAt: row.created_at })),
  };
}

export async function loadApprovalDetail(approvalId: string, context: ScopeContext, now = new Date()): Promise<ApprovalDetail | null> {
  const organization = context.organization;
  if (!organization) return null;
  const supabase = await createClient();
  const { data: approval } = await supabase
    .from("approvals")
    .select("id, reason, required_role, location_id, created_at, expires_at, execution:executions(id, skill_key, input, run_id)")
    .eq("organization_id", organization.id)
    .eq("id", approvalId)
    .eq("status", "pending")
    .maybeSingle();
  const execution = approval?.execution;
  if (!approval || !execution) return null;

  const input = parseApprovalInput(execution.skill_key, execution.input);
  const location = approval.location_id ? (context.locations.find((row) => row.id === approval.location_id) ?? null) : null;

  const [{ data: run }, { data: others }, what] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("trigger, trigger_ref, model, cost_eur, tokens_in, tokens_out, agent:agents(display_name, type:agent_types(name))")
      .eq("id", execution.run_id)
      .maybeSingle(),
    supabase.from("executions").select("skill_key, status, preview").eq("run_id", execution.run_id).neq("id", execution.id).order("created_at"),
    whatOf(supabase, input),
  ]);
  const conversation = run ? await conversationOf(supabase, run.trigger, run.trigger_ref) : null;

  return {
    id: approval.id,
    summary: approval.reason ?? "",
    skillKey: execution.skill_key,
    requiredRole: approval.required_role,
    location: location?.name ?? null,
    timeZone: location?.timeZone ?? DEFAULT_TIME_ZONE,
    alwaysShowZone: needsZoneLabel(context.locations),
    createdAt: approval.created_at,
    expiresAt: approval.expires_at,
    what,
    slotPassed: slotHasPassed(input, now),
    conversation,
    run: run
      ? {
          agent: run.agent?.display_name ?? run.agent?.type?.name ?? null,
          model: run.model,
          costEur: run.cost_eur === null ? null : Number(run.cost_eur),
          tokensIn: run.tokens_in,
          tokensOut: run.tokens_out,
          others: (others ?? []).map((row) => ({ skillKey: row.skill_key, status: row.status, summary: summaryOf(row.preview) })),
        }
      : null,
  };
}
