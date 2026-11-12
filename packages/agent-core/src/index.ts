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
  policyAllows,
  resolveModelKey,
} from "./models/router.js";
export type {
  ConnectionMode,
  ModelCall,
  ModelMessage,
  ToolCall,
  ToolSpec,
  ModelPolicy,
  ModelRouter,
  ModelTransport,
  Residency,
  RouteOrigin,
  RoutedResult,
  Spend,
  TransportRequest,
  TransportResponse,
  Via,
} from "./models/router.js";
export { createFakeTransport } from "./models/transports/fake.js";
export { ModelOutputTruncatedError, ModelRefusalError, ModelResponseError, createGatewayTransport } from "./models/transports/gateway.js";
export { GatewayEmbeddingError, createGatewayEmbedder } from "./models/transports/gateway-embedder.js";
export type { GatewayEmbedder, GatewayEmbedderOptions } from "./models/transports/gateway-embedder.js";
export type { GatewayTransportOptions } from "./models/transports/gateway.js";
export type { FakeTransport, FakeTransportOptions } from "./models/transports/fake.js";
export { InvalidModelSettingsError, policyFromSettings } from "./models/settings.js";
export type { ModelSettingsRow } from "./models/settings.js";
export { CUSTOMER_MESSAGE_MARK, REPLY_SKILL_KEY, UsageRecordError, runAgentTurn } from "./runtime/turn.js";
export type {
  ExecutionStatus,
  HandOffReason,
  HistoryMessage,
  Step,
  TurnExecution,
  TurnModelCall,
  TurnParams,
  TurnResult,
  TurnStatus,
  TurnUsage,
} from "./runtime/turn.js";
export { PLATFORM_RULES, composeSystemPrompt, composeSystemPromptParts } from "./runtime/prompt.js";
export { RECENT_MESSAGES, SUMMARY_CALL_INDEX, SUMMARY_INSTRUCTIONS, SUMMARY_MARK, SUMMARY_MAX_CHARS, planSummary, summarizeConversation, summaryInput } from "./runtime/summary.js";
export type { SummarizeParams, SummarizeResult, SummaryMessage, SummaryPlan } from "./runtime/summary.js";
export type { BookableService, PromptContext, SystemPromptParts } from "./runtime/prompt.js";
