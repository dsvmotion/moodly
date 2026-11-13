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
  CalendarUnavailableError,
  InvalidBookingError,
  SlotTakenError,
  SlotUnavailableError,
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
export { BUSY_TIMEOUT_MS, busySourceFromReader, withExternalBusy } from "./booking/external-busy.js";
export type { BusySource, BusySourceOptions } from "./booking/external-busy.js";
// Emails de aviso: plantillas puras; el envío lo hace el worker (M-02).
export { renderApprovalEmail } from "./email/approval.js";
export type { ApprovalEmailInput, EmailLocale, RenderedEmail } from "./email/approval.js";
export { renderBudgetEmail } from "./email/budget.js";
export type { BudgetEmailInput } from "./email/budget.js";
export { renderHandoffEmail } from "./email/handoff.js";
export type { HandoffEmailInput } from "./email/handoff.js";
export { EmailSendError, RESEND_API_URL, createResendSender } from "./email/resend.js";
export type { EmailAddress, EmailSendErrorKind, EmailSender, ResendSenderOptions, SendEmailRequest } from "./email/resend.js";
// Integraciones de plataforma (O-02, ADR 0053): la interfaz, el catálogo, Nango
// (el único que habla con él, platform/transports) y la lectura del calendario.
export { ConnectorPlatformError } from "./platform/types.js";
export type {
  ConnectSession,
  ConnectSessionRequest,
  ConnectionTags,
  ConnectorPlatform,
  ConnectorPlatformErrorKind,
  PlatformConnection,
  ProxyRequest,
} from "./platform/types.js";
export { PLATFORM_INTEGRATIONS, platformIntegration, platformIntegrationByKey, platformIntegrationsIn } from "./platform/catalog.js";
export type { PlatformCategory, PlatformIntegration } from "./platform/catalog.js";
export { NANGO_DEFAULT_HOST, createNangoPlatform, parseNangoHost } from "./platform/transports/nango.js";
export type { NangoPlatformOptions } from "./platform/transports/nango.js";
export {
  NANGO_SIGNATURE_HEADER,
  NANGO_WEBHOOK_MAX_BYTES,
  parseNangoWebhook,
  signNangoWebhook,
  verifyNangoWebhook,
} from "./platform/transports/nango-webhook.js";
export type { NangoAuthWebhook } from "./platform/transports/nango-webhook.js";
export { createFakeConnectorPlatform } from "./platform/fake.js";
export type { FakeConnectorPlatform, FakeConnectorPlatformOptions } from "./platform/fake.js";
export { GOOGLE_CALENDAR_EVENTS_PATH, createGoogleCalendarReader } from "./calendar/google.js";
export { OUTLOOK_CALENDAR_HORIZON_DAYS, OUTLOOK_CALENDAR_VIEW_PATH, createOutlookCalendarReader } from "./calendar/outlook.js";
export { BUSY_MAX, busyFromEvent } from "./calendar/common.js";
export type { BusyInterval, CalendarEvent, CalendarReader, ListBusyRequest, ListUpcomingEventsRequest } from "./calendar/common.js";
// Koibox (int-koibox, O-02): API abierta con la clave del centro. Solo lectura.
export {
  KOIBOX_DEFAULT_API_BASE,
  KOIBOX_KEY_HEADER,
  KOIBOX_MAX_SLOT_DAYS,
  KoiboxError,
  createKoiboxReader,
  parseKoiboxApiBase,
} from "./booking/koibox/client.js";
export type {
  KoiboxAppointment,
  KoiboxErrorKind,
  KoiboxKeyInfo,
  KoiboxReader,
  KoiboxReaderOptions,
  KoiboxService,
  KoiboxSlot,
} from "./booking/koibox/client.js";
