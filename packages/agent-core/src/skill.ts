import type { z } from "zod";
import { AUTONOMY_LEVELS, EFFECT_CLASSES, EFFECT_CLASS_CEILING, autonomyRank } from "./effects.js";
import type { AutonomyLevel, EffectClass } from "./effects.js";

// Contrato de una skill (MANUAL §5.5) y lo que el runtime le da (ADR 0047).
// El tenant, el local y el destino los pone siempre el runtime: la entrada que
// propone el LLM no puede ni declararlos (§5.4, punto 6; control 3.4).

/** A quién va el efecto. Lo resuelve el runtime, nunca la entrada de la skill. */
export type Target =
  | { kind: "none" }
  /** external_message: el contacto de la conversación en curso. */
  | { kind: "conversation"; conversationId: string; contactId: string }
  /** external_outreach: la audiencia de la skill, ya filtrada por consentimiento. */
  | { kind: "audience"; contactIds: readonly string[] };

export interface SkillContext {
  organizationId: string;
  locationId: string | null;
  runId: string;
  /** El contacto de la conversación del run (RunScope.conversation), o null. Lo pone el runtime: es para quien se reserva o se cancela. */
  contactId: string | null;
  /** La conversación del run (RunScope.conversation), o null. Lo pone el runtime: por ella salen los recordatorios de una cita. */
  conversationId: string | null;
  target: Target;
  /** Para que execute sea idempotente (§5.5): el mismo para la misma ejecución. */
  idempotencyKey: string;
}

/** Lo que necesita una skill de outreach para calcular su audiencia. */
export interface AudienceContext {
  organizationId: string;
  locationId: string | null;
}

export interface SkillPreview {
  /** Lo que hará, en frases que entiende quien aprueba. */
  summary: string;
}

export interface SkillDefinition<I = unknown, O = unknown> {
  key: string;
  version: number;
  description: string;
  effectClass: EffectClass;
  defaultAutonomy: AutonomyLevel;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  /** Solo external_outreach: los contactos a los que iría, por una consulta propia acotada al tenant. */
  audience?: (ctx: AudienceContext, input: I) => Promise<readonly string[]>;
  /** Reglas de negocio (§5.4, punto 4): un motivo para pedir aprobación aunque la autonomía permitiera ejecutar. */
  requiresApproval?: (input: I) => string | null;
  /** Sin efectos: lo que haría. Lo ve quien aprueba. */
  preview(ctx: SkillContext, input: I): Promise<SkillPreview>;
  execute(ctx: SkillContext, input: I): Promise<O>;
}

export class SkillDefinitionError extends Error {
  override name = "SkillDefinitionError";
}

// Nombres que solo puede poner el runtime: el tenant, el local, el contacto y
// cualquier forma de destinatario. Se comparan sin mayúsculas ni separadores
// (organization_id, organizationId y OrganizationID son el mismo campo).
const RESERVED = new Set(
  [
    "organization_id",
    "org_id",
    "tenant_id",
    "location_id",
    "contact_id",
    "contact_ids",
    "conversation_id",
    "to",
    "cc",
    "bcc",
    "recipient",
    "recipients",
    "phone",
    "phone_number",
    "email",
    "email_address",
    "channel_address",
  ].map(normalizeKey),
);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isReservedKey(key: string): boolean {
  return RESERVED.has(normalizeKey(key));
}

/** Rutas de los campos reservados que trae un valor cualquiera (los argumentos crudos del LLM). */
export function reservedPaths(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => reservedPaths(item, `${path}[${index}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(isReservedKey(key) ? [`${path}.${key}`] : []),
    ...reservedPaths(child, `${path}.${key}`),
  ]);
}

interface ZodDef {
  type: string;
  shape?: Record<string, { _zod: { def: ZodDef } }>;
  catchall?: { _zod: { def: ZodDef } };
  element?: { _zod: { def: ZodDef } };
  innerType?: { _zod: { def: ZodDef } };
  options?: { _zod: { def: ZodDef } }[];
  left?: { _zod: { def: ZodDef } };
  right?: { _zod: { def: ZodDef } };
  items?: { _zod: { def: ZodDef } }[];
  rest?: { _zod: { def: ZodDef } } | null;
  in?: { _zod: { def: ZodDef } };
}

// Tipos con claves abiertas: con ellos el LLM podría colar cualquier campo, también uno reservado.
const OPEN_TYPES = new Set(["record", "map", "any", "unknown", "lazy", "custom"]);

/**
 * Problemas del esquema de entrada: campos reservados (a cualquier profundidad)
 * y estructuras con claves abiertas. Vacío si el esquema es aceptable.
 */
export function inputSchemaProblems(schema: z.ZodType, path = "$"): string[] {
  const def = (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
  const child = (node: { _zod: { def: ZodDef } }, at: string) => inputSchemaProblems(node as unknown as z.ZodType, at);

  if (OPEN_TYPES.has(def.type)) return [`${path}: tipo ${def.type} con claves abiertas`];
  switch (def.type) {
    case "object": {
      const problems = Object.entries(def.shape ?? {}).flatMap(([key, node]) => [
        ...(isReservedKey(key) ? [`${path}.${key}: campo reservado del runtime`] : []),
        ...child(node, `${path}.${key}`),
      ]);
      const catchall = def.catchall?._zod.def.type;
      if (catchall !== undefined && catchall !== "never") problems.push(`${path}: objeto que admite claves no declaradas`);
      return problems;
    }
    case "array":
      return def.element ? child(def.element, `${path}[]`) : [];
    case "union":
      return (def.options ?? []).flatMap((option) => child(option, path));
    case "intersection":
      return [...(def.left ? child(def.left, path) : []), ...(def.right ? child(def.right, path) : [])];
    case "tuple":
      return [
        ...(def.items ?? []).flatMap((item, index) => child(item, `${path}[${index}]`)),
        ...(def.rest ? child(def.rest, `${path}[]`) : []),
      ];
    case "pipe":
      return def.in ? child(def.in, path) : [];
    default:
      return def.innerType ? child(def.innerType, path) : [];
  }
}

const SKILL_KEY = /^[a-z][a-z0-9_]{1,63}$/; // la misma regla que skills.key en la base de datos

/** Valida una skill al registrarla. Una skill que no cumple el contrato no llega a existir. */
export function defineSkill<I, O>(definition: SkillDefinition<I, O>): SkillDefinition<I, O> {
  const fail = (message: string): never => {
    throw new SkillDefinitionError(`skill «${definition.key}»: ${message}`);
  };
  if (!SKILL_KEY.test(definition.key)) fail("la clave no cumple ^[a-z][a-z0-9_]{1,63}$");
  if (!Number.isInteger(definition.version) || definition.version < 1) fail("la versión tiene que ser un entero ≥ 1");
  if (!EFFECT_CLASSES.includes(definition.effectClass)) fail(`clase de efecto desconocida: ${String(definition.effectClass)}`);
  if (!AUTONOMY_LEVELS.includes(definition.defaultAutonomy)) fail(`autonomía desconocida: ${String(definition.defaultAutonomy)}`);
  if (autonomyRank(definition.defaultAutonomy) > autonomyRank(EFFECT_CLASS_CEILING[definition.effectClass])) {
    fail(`la autonomía por defecto supera el techo de ${definition.effectClass}`);
  }
  const isOutreach = definition.effectClass === "external_outreach";
  if (isOutreach && !definition.audience) fail("external_outreach necesita audience()");
  if (!isOutreach && definition.audience) fail("solo external_outreach declara audience()");
  const problems = inputSchemaProblems(definition.input);
  if (problems.length > 0) fail(`entrada no válida:\n  ${problems.join("\n  ")}`);
  return definition;
}
