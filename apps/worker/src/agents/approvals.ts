import { REPLY_SKILL_KEY, verifyApproval } from "@repo/agent-core";
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
// - Si quien aprobó corrigió el texto de una respuesta (OA02,
//   approvals.edited_input), el hash que se comprueba es el de lo que propuso
//   el agente, como siempre; lo que se ejecuta es la corrección, con la misma
//   clave de idempotencia, solo en los campos que se pueden editar y pasando
//   por el mismo esquema de la skill (approvedInput). Si no cuadra, no se
//   ejecuta nada.
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

/**
 * Lo que una persona puede corregir al aprobar, por skill (OA02): solo el
 * texto de una respuesta. La base de datos ya lo exige (guard_approval y
 * private.valid_reply_edit); aquí se vuelve a comprobar antes de ejecutar.
 */
export const EDITABLE_FIELDS: Readonly<Record<string, readonly string[]>> = { [REPLY_SKILL_KEY]: ["text"] };

export type ApprovedInput = { ok: true; input: unknown; edited: boolean } | { ok: false; reason: "not_editable" | "edit_fields" };

/**
 * Lo que se ejecuta: lo que propuso el agente o, si quien aprobó lo corrigió,
 * eso mismo con los campos corregidos. Una edición de una skill que no se
 * edita, o con campos que no se pueden editar, no se ejecuta. El esquema de la
 * skill (skill.input) se aplica después, igual que a la propuesta del agente.
 */
export function approvedInput(skillKey: string, original: unknown, edited: unknown): ApprovedInput {
  if (edited === null || edited === undefined) return { ok: true, input: original, edited: false };
  const fields = EDITABLE_FIELDS[skillKey];
  if (!fields) return { ok: false, reason: "not_editable" };
  if (typeof edited !== "object" || Array.isArray(edited) || typeof original !== "object" || original === null || Array.isArray(original)) {
    return { ok: false, reason: "edit_fields" };
  }
  const keys = Object.keys(edited);
  if (keys.length === 0 || keys.some((key) => !fields.includes(key))) return { ok: false, reason: "edit_fields" };
  return { ok: true, input: { ...original, ...edited }, edited: true };
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
      approval: {
        execution_id: string;
        organization_id: string;
        location_id: string | null;
        input_hash: string;
        status: string;
        expires_at: string;
        decided_at: string | null;
        decided_by?: string | null;
        /** La corrección de quien aprobó (OA02). Sin ella (o en una carga de antes de este cambio), lo del agente. */
        edited_input?: unknown;
      };
      contactId: string | null;
      conversationId: string | null;
    };

async function load(db: TenantDb, approvalId: string, executionId: string): Promise<Loaded> {
  // Como moodly_worker, bajo RLS (PL-T1 3c-4): todo lo que se lee, en una transacción.
  return db.transaction(async (sql): Promise<Loaded> => {
    const [approval] = await sql.query<Extract<Loaded, { kind: "decided" }>["approval"]>(
      `select execution_id, organization_id, location_id, input_hash, status,
              to_json(expires_at) #>> '{}' as expires_at, to_json(decided_at) #>> '{}' as decided_at,
              decided_by, edited_input
       from public.approvals where id = $1`,
      [approvalId],
    );
    if (!approval || approval.execution_id !== executionId) return { kind: "skip", reason: "approval_missing" };
    const [execution] = await sql.query<ExecutionRow>(
      `select id, run_id, organization_id, location_id, skill_key, skill_version, input, target, input_hash, status, idempotency_key, output
       from public.executions where id = $1`,
      [executionId],
    );
    if (!execution) return { kind: "skip", reason: "execution_missing" };
    // Ya decidida antes (la entrega se reanudó): no se vuelve a tocar.
    if (!AWAITING_PERSON.has(execution.status)) return { kind: "skip", reason: settledReason(execution.status, execution.output) };

    // El contacto y la conversación del run: los del mensaje que lo despertó.
    const [run] = await sql.query<{ trigger: string; trigger_ref: string | null }>("select trigger, trigger_ref from public.agent_runs where id = $1", [
      execution.run_id,
    ]);
    let contactId: string | null = null;
    let conversationId: string | null = null;
    if (run?.trigger === "inbound_message" && run.trigger_ref) {
      const [conversation] = await sql.query<{ id: string; contact_id: string | null }>(
        `select c.id, c.contact_id from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = $1`,
        [run.trigger_ref],
      );
      contactId = conversation?.contact_id ?? null;
      conversationId = conversation?.id ?? null;
    }
    return { kind: "decided", execution, approval, contactId, conversationId };
  });
}

async function settleExecution(db: TenantDb, executionId: string, status: "executed" | "failed" | "rejected", output?: unknown): Promise<void> {
  // «rejected» solo copia la decisión de una persona: guard_worker_execution
  // (20261112160000) lo deja solo si la aprobación de la ejecución está rechazada.
  await db.transaction((sql) =>
    sql.query(
      `update public.executions set status = $2, output = coalesce($3::jsonb, output)
       where id = $1 and status = any($4::text[])`,
      [executionId, status, output === undefined ? null : JSON.stringify(output), [...AWAITING_PERSON]],
    ),
  );
}

/** Cuando ya no queda nada esperando a una persona, el run que esperaba se cierra. */
async function settleRun(db: TenantDb, runId: string): Promise<void> {
  // De awaiting_approval a completed, solo el estado (guard_worker_agent_run, 20261112130000).
  await db.transaction(async (sql) => {
    const pending = await sql.query("select 1 from public.executions where run_id = $1 and status = any($2::text[]) limit 1", [
      runId,
      [...AWAITING_PERSON],
    ]);
    if (pending.length > 0) return;
    await sql.query("update public.agent_runs set status = 'completed' where id = $1 and status = 'awaiting_approval'", [runId]);
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
      // Lo aprobado: lo del agente o la corrección de quien aprobó (OA02).
      const approved = approvedInput(execution.skill_key, execution.input, approval.edited_input);
      if (!approved.ok) {
        await ctx.step("settle:refused", () => settleExecution(ctx.db, execution.id, "failed"));
        ctx.logger.warn(
          { approvalId, executionId, skillKey: execution.skill_key, reason: approved.reason, securityEvent: "approval.edit_refused" },
          "aprobación con una corrección que no se puede ejecutar: no se ejecuta",
        );
        await ctx.step("run:settle", () => settleRun(ctx.db, execution.run_id));
        return;
      }
      try {
        // El mismo esquema que a la propuesta del agente: una corrección que no lo pasa no se ejecuta.
        const input = skill.input.parse(approved.input);
        const output = await ctx.step(`execute:${execution.idempotency_key}`, () => skill.execute(skillCtx, input));
        // Quién corrigió lo que se ejecutó, en el resultado (sin el texto: ese ya está en el mensaje).
        const recorded = approved.edited && typeof output === "object" && output !== null ? { ...output, edited_by: approval.decided_by ?? null } : output;
        await ctx.step("settle:executed", () => settleExecution(ctx.db, execution.id, "executed", recorded));
        ctx.logger.info({ approvalId, executionId, skillKey: execution.skill_key, edited: approved.edited }, "aprobada y ejecutada");
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
