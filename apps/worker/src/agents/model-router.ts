import { createGatewayTransport, createModelRouter } from "@repo/agent-core";
import type { ModelRouter, ModelTransport } from "@repo/agent-core";
import type { WorkerConfig } from "../config.ts";

// Las vías de modelo del worker (ADR 0033 §7): hoy, Vercel AI Gateway si hay
// clave. Sin ninguna, el enrutador no llama a nadie y el turno pasa la
// conversación a una persona (NoEligibleTransportError → handed_off): con el
// cliente nunca hay silencio (MANUAL §15.1).

export interface WorkerModels {
  router: ModelRouter;
  /** Las vías activas (sin la clave): para el log de arranque y los tests. */
  transports: readonly ModelTransport[];
}

export function createWorkerModels(
  config: Pick<WorkerConfig, "aiGatewayApiKey">,
  gateway: (apiKey: string) => ModelTransport = (apiKey) => createGatewayTransport({ apiKey }),
): WorkerModels {
  const transports = config.aiGatewayApiKey ? [gateway(config.aiGatewayApiKey)] : [];
  return { router: createModelRouter(transports), transports };
}
