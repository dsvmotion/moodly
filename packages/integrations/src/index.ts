// Capa de integraciones (MANUAL §7, ADR 0036). Por ahora, los conectores MCP:
// el catálogo de servidores revisados, la importación de herramientas como
// skills sin clasificar, la conexión gobernada y la skill que la usa. Las
// interfaces por tipo empiezan con las reservas (BookingProvider, paso 4b).
export { REVIEWED_MCP_SERVERS, UnreviewedMcpServerError, reviewedServer } from "./mcp/catalog.js";
export type { ReviewedMcpServer } from "./mcp/catalog.js";
export { UnsafeServerUrlError, assertSafeServerUrl, isPublicAddress } from "./mcp/server-url.js";
export type { ResolvedAddress, Resolver } from "./mcp/server-url.js";
export { toolHash } from "./mcp/pin.js";
export { closeObjects, toolInputSchema } from "./mcp/schema.js";
export type { ToolInput } from "./mcp/schema.js";
export { MCP_UNCLASSIFIED, importMcpTools, mcpSkillKey } from "./mcp/import.js";
export type { McpImport, McpSkillDraft } from "./mcp/import.js";
export { McpCallFailedError, McpToolDriftError, McpToolNotAllowedError, governMcpClient } from "./mcp/governed.js";
export type { GovernOptions, GovernedMcpConnection } from "./mcp/governed.js";
export { McpSkillError, mcpSkill } from "./mcp/skill.js";
export type { McpSkillRow } from "./mcp/skill.js";
export { createFakeMcpClient } from "./mcp/fake.js";
export type { FakeMcpClient } from "./mcp/fake.js";
export type { JsonSchema, McpCallResult, McpClient, McpContent, McpTool, UntrustedContent } from "./mcp/types.js";
export {
  AppointmentNotChangeableError,
  AppointmentNotFoundError,
  InvalidBookingError,
  SlotTakenError,
} from "./booking/types.js";
export type {
  Appointment,
  AppointmentStatus,
  BookRequest,
  BookingProvider,
  BookingSlot,
  CancelRequest,
  FindSlotsRequest,
  RescheduleRequest,
} from "./booking/types.js";
export { createFakeBookingProvider } from "./booking/fake.js";
export type { FakeBookingOptions, FakeBookingProvider } from "./booking/fake.js";
// Emails de aviso: plantillas puras; el envío lo hace el worker (M-02).
export { renderApprovalEmail } from "./email/approval.js";
export type { ApprovalEmailInput, EmailLocale, RenderedEmail } from "./email/approval.js";
