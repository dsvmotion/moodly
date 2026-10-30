// Evals de los agentes (MANUAL §12.4). Hoy: el set de ataque determinista del
// runtime (ADR 0047 §4). Los sets con un modelo real llegan con el enrutador.
export { ATTACK_THRESHOLD, CATEGORIES, attacks, runAttack } from "./attacks.js";
export type { ApprovalAttack, Attack, AttackResult, Category, ProposalAttack } from "./attacks.js";
