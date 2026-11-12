// Evals de los agentes (MANUAL §12.4): el set de ataque determinista del
// runtime (ADR 0047 §4) y las conversaciones de prueba de los agentes, con el
// turno de verdad sobre proveedores falsos (modelo falso en pnpm test; el
// real, con `pnpm --filter @repo/evals eval:agents`).
export { ATTACK_THRESHOLD, CATEGORIES, attacks, runAttack } from "./attacks.js";
export type { ApprovalAttack, Attack, AttackResult, Category, ProposalAttack } from "./attacks.js";
export { conversationCases, customerCases, receptionCases } from "./conversations/cases.js";
export { BEHAVIOR_THRESHOLD, CATEGORIES as CONVERSATION_CATEGORIES, SAFETY_THRESHOLD, runCase, score } from "./conversations/runner.js";
export type { CaseCategory, CaseRun, ConversationCase, Score, ScriptStep, Severity } from "./conversations/runner.js";
export type { Check, Outcome } from "./conversations/checks.js";
export { CASA_LOLA, FISIO_RETIRO, INMOBILIARIA_SOL, SECTOR_BUSINESSES, TALLERES_RUIZ } from "./conversations/businesses.js";
export { sectorCases } from "./conversations/sectors.js";
export { AURORA } from "./conversations/world.js";
export type { Business } from "./conversations/world.js";
