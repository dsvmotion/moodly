import { canonicalHash } from "./canonical.js";
import { EFFECT_CLASS_CEILING, minAutonomy } from "./effects.js";
import type { AutonomyLevel } from "./effects.js";
import { reservedPaths } from "./skill.js";
import type { SkillDefinition, Target } from "./skill.js";

// Motor de políticas (MANUAL §5.4, ADR 0047). Toda llamada a una skill que
// propone el LLM pasa por aquí antes de ejecutarse. No confía en nada de lo que
// propone el LLM salvo los argumentos de la skill, y esos se validan con su
// esquema: el tenant, el local y el destino salen del run.

/** Lo que propone el LLM: el nombre de la skill y sus argumentos tal cual. */
export interface Proposal {
  skillKey: string;
  args: unknown;
}

/** Lo que sabe el runtime del run en curso. Nunca sale de los argumentos del LLM. */
export interface RunScope {
  organizationId: string;
  locationId: string | null;
  runId: string;
  /** La conversación en curso, si el run nació de un mensaje. */
  conversation: { id: string; contactId: string } | null;
}

/** Cómo tiene configurada la skill este agente (agent_skills, ya resuelto con su snapshot). */
export interface SkillSettings {
  enabled: boolean;
  autonomy: AutonomyLevel;
  /** Si la integración que necesita está rota, se baja a suggest (MANUAL §7). */
  integrationHealthy?: boolean;
}

/** Filtra los contactos que han consentido recibir este tipo de mensaje. */
export interface ConsentChecker {
  allowed(input: { organizationId: string; contactIds: readonly string[]; skillKey: string }): Promise<readonly string[]>;
}

/** Sin un comprobador de consentimientos configurado, no se contacta a nadie. */
export const denyAllConsent: ConsentChecker = {
  allowed: () => Promise.resolve([]),
};

export type RejectReason =
  | "unknown_skill"
  | "skill_disabled"
  | "reserved_field"
  | "invalid_input"
  | "no_conversation"
  | "no_recipients";

export type Outcome = "execute" | "suggest" | "draft" | "needs_approval";

export type Decision<I = unknown> =
  | { outcome: "reject"; reason: RejectReason; detail?: string }
  | {
      outcome: Outcome;
      skill: SkillDefinition<I>;
      input: I;
      target: Target;
      autonomy: AutonomyLevel;
      /** Lo que se aprueba y lo único que se puede ejecutar (ADR 0047 §3). */
      inputHash: string;
      /** Por qué pide aprobación aunque la autonomía permitiera ejecutar. */
      approvalReason?: string;
    };

export interface DecideInput {
  proposal: Proposal;
  scope: RunScope;
  /** Las skills que el runtime le ofreció al LLM, por clave. */
  skills: ReadonlyMap<string, SkillDefinition<unknown>>;
  settings: ReadonlyMap<string, SkillSettings>;
  consent?: ConsentChecker;
}

/** Versión del formato del hash. Si cambia lo que entra en él, sube y los hashes viejos dejan de coincidir. */
export const EXECUTION_HASH_VERSION = 1;

export interface ExecutionContent {
  organizationId: string;
  locationId: string | null;
  runId: string;
  skillKey: string;
  skillVersion: number;
  input: unknown;
  target: Target;
}

/** Hash de lo que se va a ejecutar: el que se guarda en la ejecución y en su aprobación. */
export function executionHash(content: ExecutionContent): string {
  return canonicalHash({ v: EXECUTION_HASH_VERSION, ...content });
}

export async function decide(params: DecideInput): Promise<Decision> {
  const { proposal, scope } = params;
  const skill = params.skills.get(proposal.skillKey);
  if (!skill) return { outcome: "reject", reason: "unknown_skill" };
  const settings = params.settings.get(proposal.skillKey);
  if (!settings?.enabled) return { outcome: "reject", reason: "skill_disabled" };

  // Antes de validar: el esquema descartaría estos campos sin avisar, y que el
  // LLM los proponga es en sí una señal (inyección o prompt mal hecho).
  const reserved = reservedPaths(proposal.args);
  if (reserved.length > 0) return { outcome: "reject", reason: "reserved_field", detail: reserved.join(", ") };

  const parsed = skill.input.safeParse(proposal.args);
  if (!parsed.success) return { outcome: "reject", reason: "invalid_input", detail: parsed.error.message };
  const input = parsed.data;

  const target = await resolveTarget(skill, input, scope, params.consent ?? denyAllConsent);
  if ("reject" in target) return { outcome: "reject", reason: target.reject };

  const autonomy = minAutonomy(
    settings.autonomy,
    EFFECT_CLASS_CEILING[skill.effectClass],
    settings.integrationHealthy === false ? "suggest" : "autonomous",
  );
  const inputHash = executionHash({
    organizationId: scope.organizationId,
    locationId: scope.locationId,
    runId: scope.runId,
    skillKey: skill.key,
    skillVersion: skill.version,
    input,
    target,
  });
  const base = { skill, input, target, autonomy, inputHash };

  if (autonomy === "suggest") return { outcome: "suggest", ...base };
  if (autonomy === "draft") return { outcome: "draft", ...base };
  const approvalReason = skill.requiresApproval?.(input) ?? null;
  if (approvalReason !== null) return { outcome: "needs_approval", ...base, approvalReason };
  return { outcome: "execute", ...base };
}

/** A quién va el efecto, según la clase de la skill (ADR 0047 §2). Nunca de la entrada. */
export async function resolveTarget<I>(
  skill: SkillDefinition<I>,
  input: I,
  scope: RunScope,
  consent: ConsentChecker,
): Promise<Target | { reject: RejectReason }> {
  switch (skill.effectClass) {
    case "external_message":
      if (!scope.conversation) return { reject: "no_conversation" };
      return { kind: "conversation", conversationId: scope.conversation.id, contactId: scope.conversation.contactId };
    case "external_outreach": {
      if (!skill.audience) return { reject: "no_recipients" };
      const candidates = [...new Set(await skill.audience({ organizationId: scope.organizationId, locationId: scope.locationId }, input))];
      const allowed = new Set(await consent.allowed({ organizationId: scope.organizationId, contactIds: candidates, skillKey: skill.key }));
      // Solo los que la skill propuso y además han consentido: el comprobador no puede añadir a nadie.
      const contactIds = candidates.filter((id) => allowed.has(id)).sort();
      if (contactIds.length === 0) return { reject: "no_recipients" };
      return { kind: "audience", contactIds };
    }
    default:
      return { kind: "none" };
  }
}
