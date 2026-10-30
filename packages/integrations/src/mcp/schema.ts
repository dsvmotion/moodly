import { inputSchemaProblems } from "@repo/agent-core";
import { z } from "zod";
import type { JsonSchema } from "./types.js";

// El esquema de entrada de una herramienta MCP, como esquema Zod de skill. Un
// objeto que no dice nada de additionalProperties se cierra: al servidor solo
// le llegan los campos que se revisaron. Uno que los abre a propósito
// (additionalProperties, patternProperties, sin tipo) se queda abierto, y
// inputSchemaProblems lo marca igual que un campo reservado (control 3.4).

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SCHEMA_MAPS = ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"];
const SCHEMA_SINGLES = ["items", "additionalProperties", "not", "if", "then", "else", "contains", "propertyNames"];
const SCHEMA_LISTS = ["anyOf", "oneOf", "allOf", "prefixItems", "items"];

function isObjectSchema(node: Node): boolean {
  const type = node.type;
  return type === "object" || (Array.isArray(type) && type.includes("object")) || isNode(node.properties);
}

/** Cierra los objetos que no declaran additionalProperties, recorriendo solo palabras clave de esquema. */
export function closeObjects(schema: JsonSchema): JsonSchema {
  const node: Node = { ...schema };
  if (isObjectSchema(node) && !("additionalProperties" in node) && !("patternProperties" in node)) {
    node.additionalProperties = false;
  }
  for (const key of SCHEMA_MAPS) {
    const map = node[key];
    if (isNode(map)) {
      node[key] = Object.fromEntries(Object.entries(map).map(([name, child]) => [name, isNode(child) ? closeObjects(child) : child]));
    }
  }
  for (const key of SCHEMA_SINGLES) {
    const child = node[key];
    if (isNode(child)) node[key] = closeObjects(child);
  }
  for (const key of SCHEMA_LISTS) {
    const list = node[key];
    if (Array.isArray(list)) node[key] = list.map((child: unknown) => (isNode(child) ? closeObjects(child) : child));
  }
  return node;
}

export type ToolInput =
  | { ok: true; schema: z.ZodType<Record<string, unknown>> }
  | { ok: false; problems: readonly string[] };

/** El esquema Zod de la entrada, o por qué la herramienta no puede ser una skill tal cual. */
export function toolInputSchema(inputSchema: JsonSchema): ToolInput {
  let schema: z.ZodType;
  try {
    schema = z.fromJSONSchema(closeObjects(inputSchema));
  } catch (error) {
    return { ok: false, problems: [`$: esquema no admitido (${(error as Error).message})`] };
  }
  const problems = inputSchemaProblems(schema);
  if (problems.length > 0) return { ok: false, problems };
  if ((schema as unknown as { _zod: { def: { type: string } } })._zod.def.type !== "object") {
    return { ok: false, problems: ["$: la entrada de una herramienta es un objeto"] };
  }
  return { ok: true, schema: schema as z.ZodType<Record<string, unknown>> };
}
