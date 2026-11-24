import type { Logger } from "pino";
import { pseudonym } from "./logger-core";

// Eventos de seguridad (ADR 0032): una línea `event` por hecho relevante, con
// identificadores internos (ids de usuario y organización) y seudónimos de los
// datos personales. Son la base de las alertas (B1): ráfagas de fallos de login,
// desactivación de MFA, cambios de organización e invitaciones.

export type SecurityEvent =
  | "auth.login_failed"
  | "auth.login_throttled"
  | "auth.login_succeeded"
  | "auth.mfa_required"
  | "auth.mfa_failed"
  | "auth.mfa_throttled"
  | "auth.mfa_succeeded"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "org.active_changed"
  | "org.invitation_created"
  | "org.invitation_revoked"
  | "org.invitation_accepted"
  | "knowledge.source_created"
  | "knowledge.source_updated"
  | "knowledge.source_deleted"
  | "goal.created"
  | "goal.updated"
  | "goal.deleted"
  | "agent.approval_approved"
  | "agent.approval_rejected"
  | "inbox.conversation_taken_over"
  | "inbox.conversation_handed_back"
  | "inbox.staff_message_sent"
  | "integration.connect_started"
  | "integration.disconnected"
  | "integration.disconnect_failed"
  | "integration.key_submitted"
  | "integration.key_throttled"
  | "business.service_created"
  | "business.service_updated"
  | "business.resource_created"
  | "business.resource_updated"
  | "business.opening_hours_updated";

export interface SecurityEventFields {
  userId?: string | undefined;
  organizationId?: string | undefined;
  /** Se escribe solo como seudónimo (`email_ref`). */
  email?: string | undefined;
  /** Se escribe solo como seudónimo (`ip_ref`). */
  ip?: string | undefined;
  [extra: string]: string | number | boolean | null | undefined;
}

export function logSecurityEvent(logger: Logger, event: SecurityEvent, fields: SecurityEventFields = {}): void {
  const { userId, organizationId, email, ip, ...extra } = fields;
  const line: Record<string, unknown> = { event, ...extra };
  if (userId) line["user_id"] = userId;
  if (organizationId) line["organization_id"] = organizationId;
  const emailRef = email ? pseudonym(email) : undefined;
  if (emailRef) line["email_ref"] = emailRef;
  const ipRef = ip ? pseudonym(ip) : undefined;
  if (ipRef) line["ip_ref"] = ipRef;
  const warn = event.endsWith("_failed") || event.endsWith("_throttled") || event === "auth.mfa_disabled";
  logger[warn ? "warn" : "info"](line, event);
}
