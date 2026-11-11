import type { TemplateRef } from "./message.js";

// Las plantillas (ADR 0052 §5): por cuenta de canal, con su estado de
// aprobación en el proveedor. Fuera de la ventana de servicio de un canal que
// la tiene (WhatsApp: 24 h desde el último mensaje del cliente), solo sale una
// plantilla aprobada.

export const TEMPLATE_CATEGORIES = ["utility", "marketing", "authentication"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export const TEMPLATE_STATUSES = ["pending", "approved", "rejected", "paused"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export interface MessageTemplate {
  name: string;
  language: string;
  category: TemplateCategory;
  /** El cuerpo con sus huecos {{1}}, {{2}}… */
  body: string;
  status: TemplateStatus;
}

export class TemplateError extends Error {
  override name = "TemplateError";
}

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

/** Cuántas variables pide una plantilla: los huecos tienen que ir de 1 a n, sin saltos. */
export function templateArity(body: string): number {
  const found = new Set([...body.matchAll(PLACEHOLDER)].map((match) => Number(match[1])));
  for (let i = 1; i <= found.size; i += 1) {
    if (!found.has(i)) throw new TemplateError(`la plantilla salta del hueco ${i - 1} al siguiente`);
  }
  return found.size;
}

/** El texto de una plantilla con sus variables, tal como lo verá el cliente (para guardarlo en messages.content). */
export function renderTemplate(template: MessageTemplate, variables: readonly string[]): string {
  const arity = templateArity(template.body);
  if (variables.length !== arity) throw new TemplateError(`la plantilla pide ${arity} variables y llegan ${variables.length}`);
  return template.body.replace(PLACEHOLDER, (_match, index: string) => variables[Number(index) - 1] ?? "");
}

/** Elige la plantilla aprobada de ese nombre en el idioma pedido, o en el de reserva. */
export function pickTemplate(
  registry: readonly MessageTemplate[],
  name: string,
  language: string,
  fallbackLanguage?: string,
): MessageTemplate | null {
  const approved = registry.filter((template) => template.name === name && template.status === "approved");
  const exact = approved.find((template) => template.language.toLowerCase() === language.toLowerCase());
  if (exact) return exact;
  const base = language.split(/[-_]/)[0]?.toLowerCase();
  const sameBase = approved.find((template) => template.language.split(/[-_]/)[0]?.toLowerCase() === base);
  if (sameBase) return sameBase;
  return fallbackLanguage ? (approved.find((template) => template.language.toLowerCase() === fallbackLanguage.toLowerCase()) ?? null) : null;
}

export function templateRef(template: MessageTemplate, variables: readonly string[]): TemplateRef {
  renderTemplate(template, variables);
  return { name: template.name, language: template.language, variables: [...variables] };
}
