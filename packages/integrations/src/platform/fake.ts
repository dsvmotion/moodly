import {
  ConnectorPlatformError,
  type ConnectorPlatform,
  type ConnectSessionRequest,
  type PlatformConnection,
  type ProxyRequest,
} from "./types.js";

// Una plataforma de conectores en memoria para los tests (como el MCP falso):
// guarda las sesiones pedidas, las conexiones y las llamadas al proxy, y
// responde al proxy con lo que le dé el test.

export interface FakeConnectorPlatform extends ConnectorPlatform {
  readonly sessions: ConnectSessionRequest[];
  readonly deleted: { integrationKey: string; connectionId: string }[];
  readonly proxied: ProxyRequest[];
  /** Simula que la persona terminó de autorizar: crea la conexión con las etiquetas de la sesión. */
  addConnection(connection: PlatformConnection): void;
  /** La siguiente llamada a esa operación falla con este error. */
  failNext(operation: "createConnectSession" | "getConnection" | "deleteConnection" | "proxy", error?: Error): void;
}

export interface FakeConnectorPlatformOptions {
  /** La respuesta del proxy para cada llamada. */
  proxyResponse?: (request: ProxyRequest) => unknown;
  connectLinkBase?: string;
}

export function createFakeConnectorPlatform(options: FakeConnectorPlatformOptions = {}): FakeConnectorPlatform {
  const connections = new Map<string, PlatformConnection>();
  const failures = new Map<string, Error>();
  const sessions: ConnectSessionRequest[] = [];
  const deleted: { integrationKey: string; connectionId: string }[] = [];
  const proxied: ProxyRequest[] = [];
  const base = options.connectLinkBase ?? "https://connect.example.test/";

  function maybeFail(operation: string) {
    const error = failures.get(operation);
    if (error) {
      failures.delete(operation);
      throw error;
    }
  }

  return {
    sessions,
    deleted,
    proxied,
    addConnection(connection) {
      connections.set(connection.connectionId, connection);
    },
    failNext(operation, error = new ConnectorPlatformError(`falla simulada (${operation})`, 503, "transient")) {
      failures.set(operation, error);
    },
    async createConnectSession(request) {
      maybeFail("createConnectSession");
      sessions.push(request);
      return {
        connectLink: `${base}?session=${sessions.length}`,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      };
    },
    async getConnection(integrationKey, connectionId) {
      maybeFail("getConnection");
      const found = connections.get(connectionId);
      return found && found.integrationKey === integrationKey ? found : null;
    },
    async deleteConnection(integrationKey, connectionId) {
      maybeFail("deleteConnection");
      deleted.push({ integrationKey, connectionId });
      connections.delete(connectionId);
    },
    async proxy(request) {
      maybeFail("proxy");
      proxied.push(request);
      if (!connections.has(request.connectionId)) throw new ConnectorPlatformError("conexión desconocida", 404, "not_found");
      return options.proxyResponse ? options.proxyResponse(request) : {};
    },
  };
}
