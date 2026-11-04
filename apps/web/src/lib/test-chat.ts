// El chat de pruebas de un agente (paso 4d-3e): lo que pinta la pantalla y
// cuándo espera al agente. Sin acceso a datos: lo carga test-chat-data.ts.

/** Cuánto se espera al agente antes de dejar de refrescar (la pantalla lo dice). */
export const WAIT_LIMIT_MS = 120_000;
const AWAITING_PERSON = new Set(["drafted", "suggested", "needs_approval"]);

export interface TestChatMessage {
  id: string;
  author: "contact" | "agent" | "user" | "system";
  content: string;
  createdAt: string;
}

export interface TestChatStep {
  id: string;
  skillKey: string;
  status: string;
  summary: string | null;
  approval: { id: string; status: string } | null;
}

export interface TestChatRun {
  id: string;
  /** El mensaje de la persona que lo despertó. */
  messageId: string;
  status: string;
  steps: TestChatStep[];
}

export interface TestChat {
  conversationId: string | null;
  messages: TestChatMessage[];
  runs: TestChatRun[];
  /** El agente está trabajando: la pantalla se refresca hasta que acabe. */
  waiting: boolean;
}

/**
 * Si el agente sigue trabajando: el último mensaje de la persona aún no tiene
 * run terminado, o algo recién aprobado aún no se ha ejecutado. Con un límite:
 * si el worker no contesta, la pantalla deja de esperar.
 */
export function isWaiting(messages: readonly TestChatMessage[], runs: readonly TestChatRun[], now: Date): boolean {
  const last = [...messages].reverse().find((message) => message.author === "contact");
  if (last && now.getTime() - new Date(last.createdAt).getTime() < WAIT_LIMIT_MS) {
    const run = runs.find((candidate) => candidate.messageId === last.id);
    if (!run || run.status === "running") return true;
  }
  return runs.some((run) => run.steps.some((step) => step.approval?.status === "approved" && AWAITING_PERSON.has(step.status)));
}

export type TestChatError = "invalid" | "not_allowed" | "paused" | "too_many" | "failed";

/**
 * El error de la base de datos que entiende la pantalla. Fuera de alcance y no
 * encontrado son lo mismo para quien prueba: no puede probar ese agente ahí.
 */
export function testChatErrorFor(code: string | undefined): TestChatError {
  switch (code) {
    case "22023":
      return "invalid";
    case "42501":
    case "P0002":
      return "not_allowed";
    case "55000":
      return "paused";
    case "54000":
      return "too_many";
    default:
      return "failed";
  }
}
