import { verifyApproval } from "@repo/agent-core";
import type { EffectClass, ExecutionRecord, SkillContext, SkillDefinition, Target } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import type { BusySource, ConnectorPlatform } from "@repo/integrations";
import { busySourceFor, calendarFor } from "../booking/external-busy.ts";
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
  // Como moodly_worker, bajo RLS (PL-T1 3c-4, 20261112160000): solo la crea,
  // pendiente; no tiene privilegio para decidirla ni cambiarla.
  // on conflict: ya la tenía (la entrega se reanudó después de crearla; una por ejecución).
  await db.transaction((sql) =>
    sql.query(
      `insert into public.approvals (organization_id, execution_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict do nothing`,
      [
        db.organizationId,
        request.executionId,
        request.locationId,
        request.effectClass,
        request.inputHash,
        requiredRoleFor(request.effectClass, request.locationId),
        reason,
        new Date(request.now.getTime() + APPROVAL_TTL_MS).toISOString(),
      ],
    ),
  );
}

interface ExecutionRow extends ExecutionRecord {
  status: string;
  idempotency_key: string;
  output: unknown;
}

/**
 * Por qué una aprobación ya no tiene nada que hacer. «superseded»: una respuesta
 * más nueva del agente relevó a este borrador (gate M1) en el mismo instante en
 * que una persona lo aprobaba. La aprobación queda «approved» (ya la decidió una
 * persona), pero no se envía nada: el resultado de la ejecución lo dice
 * (failed, output.superseded) y el worker lo avisa en el log.
 */
export function settledReason(status: string, output: unknown): "superseded" | "already_settled" {
  const superseded = status === "failed" && typeof output === "object" && output !== null && "superseded" in output;
  return superseded ? "superseded" : "already_settled";
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

/** Exportada para el test que la prueba sin RLS (org-explicit.integration.ts). */
export async function load(db: TenantDb, approvalId: string, executionId: string): Promise<Loaded> {
  // Como moodly_worker, bajo RLS (PL-T1 3c-4): todo lo que se lee, en una
  // transacción. Y con la organización explícita en cada tabla, además de RLS
  // (CLAUDE.md, control 3.2): una política mal escrita no abre nada.
  const org = db.organizationId;
  return db.transaction(async (sql): Promise<Loaded> => {
    const [approval] = await sql.query<Extract<Loaded, { kind: "decided" }>["approval"]>(
      `select execution_id, organization_id, location_id, input_hash, status,
              to_json(expires_at) #>> '{}' as expires_at, to_json(decided_at) #>> '{}' as decided_at
       from public.approvals where organization_id = $2 and id = $1`,
      [approvalId, org],
    );
    if (!approval || approval.execution_id !== executionId) return { kind: "skip", reason: "approval_missing" };
    const [execution] = await sql.query<ExecutionRow>(
      `select id, run_id, organization_id, location_id, skill_key, skill_version, input, target, input_hash, status, idempotency_key, output
       from public.executions where organization_id = $2 and id = $1`,
      [executionId, org],
    );
    if (!execution) return { kind: "skip", reason: "execution_missing" };
    // Ya decidida antes (la entrega se reanudó): no se vuelve a tocar.
    if (!AWAITING_PERSON.has(execution.status)) return { kind: "skip", reason: settledReason(execution.status, execution.output) };

    // El contacto y la conversación del run: los del mensaje que lo despertó.
    const [run] = await sql.query<{ trigger: string; trigger_ref: string | null }>(
      "select trigger, trigger_ref from public.agent_runs where organization_id = $2 and id = $1",
      [execution.run_id, org],
    );
    let contactId: string | null = null;
    let conversationId: string | null = null;
    if (run?.trigger === "inbound_message" && run.trigger_ref) {
      const [conversation] = await sql.query<{ id: string; contact_id: string | null }>(
        `select c.id, c.contact_id from public.messages m join public.conversations c on c.id = m.conversation_id
         where m.organization_id = $2 and c.organization_id = $2 and m.id = $1`,
        [run.trigger_ref, org],
      );
      contactId = conversation?.contact_id ?? null;
      conversationId = conversation?.id ?? null;
    }
    return { kind: "decided", execution, approval, contactId, conversationId };
  });
}

/** Exportada para el test que la prueba sin RLS. */
export async function settleExecution(db: TenantDb, executionId: string, status: "executed" | "failed" | "rejected", output?: unknown): Promise<void> {
  // «rejected» solo copia la decisión de una persona: guard_worker_execution
  // (20261112160000) lo deja solo si la aprobación de la ejecución está rechazada.
  await db.transaction((sql) =>
    sql.query(
      `update public.executions set status = $2, output = coalesce($3::jsonb, output)
       where organization_id = $5 and id = $1 and status = any($4::text[])`,
      [executionId, status, output === undefined ? null : JSON.stringify(output), [...AWAITING_PERSON], db.organizationId],
    ),
  );
}

/** Cuando ya no queda nada esperando a una persona, el run que esperaba se cierra. */
/** Exportada para el test que la prueba sin RLS. */
export async function settleRun(db: TenantDb, runId: string): Promise<void> {
  // De awaiting_approval a completed, solo el estado (guard_worker_agent_run, 20261112130000).
  await db.transaction(async (sql) => {
    const pending = await sql.query("select 1 from public.executions where organization_id = $3 and run_id = $1 and status = any($2::text[]) limit 1", [
      runId,
      [...AWAITING_PERSON],
      db.organizationId,
    ]);
    if (pending.length > 0) return;
    await sql.query("update public.agent_runs set status = 'completed' where organization_id = $2 and id = $1 and status = 'awaiting_approval'", [
      runId,
      db.organizationId,
    ]);
  });
}

export interface ApprovalHandlerOptions {
  /** Las skills de código que el worker sabe ejecutar, sobre los datos de la organización. */
  skills: (db: TenantDb, options?: { externalBusy?: BusySource | null }) => ReadonlyMap<string, SkillDefinition<unknown>>;
  /**
   * La plataforma de conectores (Nango). Con ella, una reserva aprobada se
   * comprueba contra el calendario conectado del local antes de escribirse
   * (O-02): entre el borrador y la aprobación, la hora pudo ocuparse fuera.
   */
  platform?: ConnectorPlatform;
}

export function createApprovalHandler({ skills, platform }: ApprovalHandlerOptions): EventHandler {
  return {
    key: APPROVAL_HANDLER_KEY,
    eventTypes: ["approval.decided"],
    async handle(event: DomainEvent, ctx: EventContext) {
      const approvalId = String(event.payload["approval_id"]);
      const executionId = String(event.payload["execution_id"]);
      const decision = String(event.payload["decision"]);
      // El calendario conectado del local de la ejecución (O-02), dentro del mismo
      // paso «load»: una aprobación a medias de antes de este cambio no trae
      // `calendar` y sigue sin él (calendarFor explica por qué no es un paso nuevo).
      const loaded = await ctx.step("load", async () => {
        const found = await load(ctx.db, approvalId, executionId);
        return found.kind === "skip" ? found : { ...found, calendar: await calendarFor(ctx.db, platform, found.execution.location_id) };
      });
      if (loaded.kind === "skip") {
        if (loaded.reason === "superseded") {
          ctx.logger.warn(
            { approvalId, executionId, decision, reason: loaded.reason },
            "aprobación de un borrador que ya relevó una respuesta más nueva: no se envía nada",
          );
        } else ctx.logger.info({ approvalId, reason: loaded.reason }, "aprobación sin nada que hacer");
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
      // El calendario del local de la ejecución (su fila guardada, nunca lo que dijo el modelo).
      const externalBusy = busySourceFor(platform, "calendar" in loaded ? loaded.calendar : null, ctx.logger);
      const skill = skills(ctx.db, externalBusy ? { externalBusy } : {}).get(execution.skill_key);
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
