import type { ModelKey } from "@repo/config";
import type { ConnectionMode, ModelTransport, TransportRequest, TransportResponse, Via } from "../router.js";

// Transporte falso para los tests (MANUAL §13: los tests unitarios nunca llaman
// a un proveedor real). Responde lo que se le diga y apunta cada petición.

export interface FakeTransportOptions {
  provider: string;
  region?: "eu" | "other";
  via?: Via;
  connection?: ConnectionMode;
  serves?: readonly ModelKey[];
  estimateEur?: number;
  /** Lo que responde; si lanza, el transporte «falla». */
  respond?: (request: TransportRequest) => TransportResponse;
}

export interface FakeTransport extends ModelTransport {
  readonly calls: TransportRequest[];
}

export function createFakeTransport(options: FakeTransportOptions): FakeTransport {
  const calls: TransportRequest[] = [];
  return {
    provider: options.provider,
    region: options.region ?? "eu",
    via: options.via ?? "gateway",
    connection: options.connection ?? "managed",
    serves: options.serves ?? ["fast", "smart", "embedding"],
    calls,
    estimateEur: () => options.estimateEur ?? 0.001,
    generate(request) {
      calls.push(request);
      const respond =
        options.respond ??
        (() => ({ text: `respuesta de ${options.provider}`, model: `${options.provider}/${request.modelKey}`, tokensIn: 10, tokensOut: 5, costEur: 0.0005 }));
      return Promise.resolve().then(() => respond(request));
    },
  };
}
