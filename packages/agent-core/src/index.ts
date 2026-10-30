// Runtime de agentes: contrato de skill, motor de políticas y hash de lo que se
// ejecuta (MANUAL §5.4–§5.6, ADR 0047).
export { AUTONOMY_LEVELS, EFFECT_CLASSES, EFFECT_CLASS_CEILING, autonomyRank, minAutonomy } from "./effects.js";
export type { AutonomyLevel, EffectClass } from "./effects.js";
export { CanonicalJsonError, canonicalHash, canonicalJson } from "./canonical.js";
export { SkillDefinitionError, defineSkill, inputSchemaProblems, isReservedKey, reservedPaths } from "./skill.js";
export type { AudienceContext, SkillContext, SkillDefinition, SkillPreview, Target } from "./skill.js";
export { EXECUTION_HASH_VERSION, decide, denyAllConsent, executionHash, resolveTarget } from "./policy.js";
export { verifyApproval } from "./approval.js";
export type { ApprovalCheck, ApprovalRecord, ExecutionRecord } from "./approval.js";
export type {
  ConsentChecker,
  DecideInput,
  Decision,
  ExecutionContent,
  Outcome,
  Proposal,
  RejectReason,
  RunScope,
  SkillSettings,
} from "./policy.js";
export {
  AllTransportsFailedError,
  BudgetExceededError,
  NoEligibleTransportError,
  PLATFORM_MODEL_POLICY,
  createModelRouter,
  eligibleTransports,
} from "./models/router.js";
export type {
  ConnectionMode,
  ModelCall,
  ModelMessage,
  ModelPolicy,
  ModelRouter,
  ModelTransport,
  Residency,
  RoutedResult,
  Spend,
  TransportRequest,
  TransportResponse,
  Via,
} from "./models/router.js";
export { createFakeTransport } from "./models/transports/fake.js";
export type { FakeTransport, FakeTransportOptions } from "./models/transports/fake.js";
