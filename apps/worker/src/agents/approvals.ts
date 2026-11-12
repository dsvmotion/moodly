import { verifyApproval } from "@repo/agent-core";
import type { EffectClass, ExecutionRecord, SkillContext, SkillDefinition, Target } from "@repo/agent-core";
import type { Json } from "@repo/db";
import type { TenantDb } from "@repo/db/service";
import type { DomainEvent, EventContext, EventHandler } from "../events/handlers.ts";
import { isNotAgentMode } from "./conversation-sender.ts";

// Las aprobaciones del agente (paso 4d-3d, ADR 0047 §3, MANUAL §5.7).
//
// - Lo que el agente deja en borrador, como sugerencia o pendiente de
//   aprobación nace con su aprobación: la decide una persona del equipo con
//   sesión (RLS, guard_approval y aal2 cuando toca), nunca el worker.
// - Al decidirse, approval.decided llega aquí. Si se aprobó, se relee la
//   ejecución y la aprobación, se comprueba el hash (verifyApproval) y se
//   ejecuta exactamente lo que se aprobó, con su clave de idempotencia: un
//   reintento no envía ni reserva dos veces. Si algo no cuadra, no se ejecuta.
// - Si se rechazó, no se ejecuta nada.
// - Un mensaje del agente aprobado con la conversación ya en manos de una
//   persona no sale (R-02): lo rechaza la base de datos al guardarlo, y la
//   ejecución queda como fallida, retenida (output.held).

export const APPROVAL_HANDLER_KEY = "agent.approval";

/** Cuánto espera una aprobación: un día, lo que dura la ventana de atención de WhatsApp (producto, 2026-11-03). */
export const APPROVAL_TTL_MS = 24 * 3_600_000;

/** Por qué un mensaje del agente no salió: la conversación ya la lleva una persona (R-02). */
export const HELD_NOT_AGENT_MODE = "conversation_not_agent_mode";

/** Las que esperan a una persona: nacen con su aprobación. */
export const AWAITING_PERSON = new Set(["drafted", "suggested", "needs_approval"]);

export type ApproverRole = "org_admin" | "region_manager" | "location_manager" | "staff";

/**
 * Quién puede decidir (producto, 2026-11-03): el equipo del local para lo de cada día
 * (responder, reservar, mover, cancelar), y quien dirige el local para enviar
 * a muchos, cobrar o borrar. Sin local, solo un org_admin (lo exige la tabla).
 */
export function requiredRoleFor(effectClass: EffectClass, locationId: string | null): ApproverRole {
  if (!locationId) return "org_admin";
  return effectClass === "external_outreach" || effectClass === "financial" || effectClass === "destructive" ? "location_manager" : "staff";
}

export interface ApprovalRequest {
  executionId: string;
  locationId: string | null;
  effectClass: EffectClass;
  inputHash: string;
  /** Lo que verá quien decide: la vista previa de la skill. */
  summary: string | null;
  now: Date;
}

/** La aprobación de una ejecución que espera a una persona. Una sola por ejecución. */
export async function requestApproval(db: TenantDb, request: ApprovalRequest): Promise<void> {
  const reason = request.summary?.trim() ? request.summary.trim().slice(0, 500) : null;
  const { error } = await db.from("approvals").insert({
    execution_id: request.executionId,
    location_id: request.locationId,
    effect_class: request.effectClass,
    input_hash: request.inputHash,
    required_role: requiredRoleFor(request.effectClass, request.locationId),
    reason,
    expires_at: new Date(request.now.getTime() + APPROVAL_TTL_MS).toISOString(),
  });
  // 23505: ya la tenía (la entrega se reanudó después de crearla).
  if (error && error.code !== "23505") throw new Error(`no se pudo pedir la aprobación (${error.code})`);
}

interface ExecutionRow extends ExecutionRecord {
  status: string;
  idempotency_key: string;
}

type Loaded =
  | { kind: "skip"; reason: string }
  | {
      kind: "decided";
      execution: ExecutionRow;
      approval: { execution_id: string; organization_id: string; location_id: string | null; input_hash: string; status: string; expires_at: string; decided_at: string | null };
      contactId: string | null;
      conversationId: string | null;
    };

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

async function load(db: TenantDb, approvalId: string, executionId: string): Promise<Loaded> {
  const approval = check(
    await db
      .from("approvals")
      .select("id, execution_id, organization_id, location_id, input_hash, status, expires_at, decided_at")
      .eq("id", approvalId)
      .maybeSingle(),
    "la aprobación",
  );
  if (!approval || approval.execution_id !== executionId) return { kind: "skip", reason: "approval_missing" };
  const execution = check(
    await db
      .from("executions")
      .select("id, run_id, organization_id, location_id, skill_key, skill_version, input, target, input_hash, status, idempotency_key")
      .eq("id", executionId)
      .maybeSingle(),
    "la ejecución",
  );
  if (!execution) return { kind: "skip", reason: "execution_missing" };
  // Ya decidida antes (la entrega se reanudó): no se vuelve a tocar.
  if (!AWAITING_PERSON.has(execution.status)) return { kind: "skip", reason: "already_settled" };

  // El contacto y la conversación del run: los del mensaje que lo despertó.
  const run = check(await db.from("agent_runs").select("trigger, trigger_ref").eq("id", execution.run_id).maybeSingle(), "el run");
  let contactId: string | null = null;
  let conversationId: string | null = null;
  if (run?.trigger === "inbound_message" && run.trigger_ref) {
    const message = check(await db.from("messages").select("conversation_id").eq("id", run.trigger_ref).maybeSingle(), "el mensaje del run");
    if (message) {
      const conversation = check(await db.from("conversations").select("id, contact_id").eq("id", message.conversation_id).maybeSingle(), "la conversación");
      contactId = conversation?.contact_id ?? null;
      conversationId = conversation?.id ?? null;
    }
  }
  return { kind: "decided", execution: execution as ExecutionRow, approval, contactId, conversationId };
}

async function settleExecution(db: TenantDb, executionId: string, status: "executed" | "failed" | "rejected", output?: unknown): Promise<void> {
  const { error } = await db
    .from("executions")
    .update({ status, ...(output === undefined ? {} : { output: output as Json }) })
    .eq("id", executionId)
    .in("status", [...AWAITING_PERSON]);
  if (error) throw new Error(`no se pudo cerrar la ejecución (${error.code})`);
}

/** Cuando ya no queda nada esperando a una persona, el run que esperaba se cierra. */
async function settleRun(db: TenantDb, runId: string): Promise<void> {
  const pending = check(
    await db.from("executions").select("id").eq("run_id", runId).in("status", [...AWAITING_PERSON]).limit(1),
    "lo que queda del run",
  );
  if ((pending ?? []).length > 0) return;
  const { error } = await db.from("agent_runs").update({ status: "completed" }).eq("id", runId).eq("status", "awaiting_approval");
  if (error) throw new Error(`no se pudo cerrar el run (${error.code})`);
}

export interface ApprovalHandlerOptions {
  /** Las skills de código que el worker sabe ejecutar, sobre los datos de la organización. */
  skills: (db: TenantDb) => ReadonlyMap<string, SkillDefinition<unknown>>;
}

export function createApprovalHandler({ skills }: ApprovalHandlerOptions): EventHandler {
  return {
    key: APPROVAL_HANDLER_KEY,
    eventTypes: ["approval.decided"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const approvalId = String(event.payload["approval_id"]);
      const executionId = String(event.payload["execution_id"]);
      const decision = String(event.payload["decision"]);
      const loaded = await ctx.step("load", () => load(ctx.db, approvalId, executionId));
      if (loaded.kind === "skip") {
        ctx.logger.info({ approvalId, reason: loaded.reason }, "aprobación sin nada que hacer");
        return;
      }
      const { execution, approval } = loaded;

      if (decision === "rejected") {
        await ctx.step("settle:rejected", () => settleExecution(ctx.db, execution.id, "rejected"));
        await ctx.step("run:settle", () => settleRun(ctx.db, execution.run_id));
        ctx.logger.info({ approvalId, executionId, skillKey: execution.skill_key }, "aprobación rechazada: no se ejecuta");
        return;
      }

      // Lo que se ejecuta es lo que se aprobó: mismo hash, aprobada y a tiempo.
      const verdict = verifyApproval(execution, approval);
      const skill = skills(ctx.db).get(execution.skill_key);
      if (!verdict.ok || !skill || skill.version !== execution.skill_version) {
        await ctx.step("settle:refused", () => settleExecution(ctx.db, execution.id, "failed"));
        ctx.logger.warn(
          { approvalId, executionId, skillKey: execution.skill_key, reason: verdict.ok ? "skill_unavailable" : verdict.reason, securityEvent: "approval.mismatch" },
          "aprobación que no cuadra con su ejecución: no se ejecuta",
        );
        return;
      }

      const skillCtx: SkillContext = {
        organizationId: execution.organization_id,
        locationId: execution.location_id,
        runId: execution.run_id,
        contactId: loaded.contactId,
        conversationId: loaded.conversationId,
        target: execution.target as Target,
        idempotencyKey: execution.idempotency_key,
      };
      try {
        const input = skill.input.parse(execution.input);
        const output = await ctx.step(`execute:${execution.idempotency_key}`, () => skill.execute(skillCtx, input));
        await ctx.step("settle:executed", () => settleExecution(ctx.db, execution.id, "executed", output));
        ctx.logger.info({ approvalId, executionId, skillKey: execution.skill_key }, "aprobada y ejecutada");
      } catch (error) {
        if (isNotAgentMode(error)) {
          await ctx.step("settle:held", () => settleExecution(ctx.db, execution.id, "failed", { held: HELD_NOT_AGENT_MODE }));
          ctx.logger.info(
            { approvalId, executionId, skillKey: execution.skill_key, reason: HELD_NOT_AGENT_MODE },
            "aprobada, pero la conversación la lleva una persona: el mensaje del agente no sale",
          );
        } else {
          await ctx.step("settle:failed", () => settleExecution(ctx.db, execution.id, "failed"));
          ctx.logger.warn({ approvalId, executionId, skillKey: execution.skill_key, error: (error as Error).name }, "aprobada, pero no se pudo ejecutar");
        }
      }
      await ctx.step("run:settle", () => settleRun(ctx.db, execution.run_id));
    },
  };
}
