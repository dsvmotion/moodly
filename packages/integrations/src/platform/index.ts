// La entrada de la plataforma de conectores para la web (@repo/integrations/platform):
// solo esto, sin MCP ni el runtime de agentes (O-02, ADR 0053).
export { ConnectorPlatformError } from "./types.js";
export type {
  ConnectSession,
  ConnectSessionRequest,
  ConnectionTags,
  ConnectorPlatform,
  ConnectorPlatformErrorKind,
  PlatformConnection,
  ProxyRequest,
} from "./types.js";
export { PLATFORM_INTEGRATIONS, platformIntegration, platformIntegrationByKey, platformIntegrationsIn } from "./catalog.js";
export type { PlatformCategory, PlatformIntegration } from "./catalog.js";
export { NANGO_DEFAULT_HOST, createNangoPlatform, parseNangoHost } from "./transports/nango.js";
export type { NangoPlatformOptions } from "./transports/nango.js";
