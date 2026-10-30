import { canonicalJson, defineSkill } from "@repo/agent-core";
import type { AutonomyLevel, EffectClass, SkillDefinition } from "@repo/agent-core";
import { z } from "zod";
import type { GovernedMcpConnection } from "./governed.js";
import { toolInputSchema } from "./schema.js";
import type { JsonSchema, UntrustedContent } from "./types.js";

// Una fila de skills de tipo mcp como skill del runtime (ADR 0030 §2): el
// mismo contrato que una skill de código, con su clase de efecto, el motor de
// políticas y las aprobaciones atadas al contenido (ADR 0047). Lo que ejecuta
// es la herramienta fijada, a través de la conexión gobernada.

/** Lo que el runtime lee de public.skills para una skill mcp. */
export interface McpSkillRow {
  key: string;
  version: number;
  name: string;
  description: string;
  effectClass: EffectClass;
  defaultAutonomy: AutonomyLevel;
  mcpToolName: string;
  mcpToolHash: string;
  inputSchema: JsonSchema;
}

export class McpSkillError extends Error {
  override name = "McpSkillError";
}

const UNTRUSTED_OUTPUT = z.object({
  untrusted: z.literal(true),
  source: z.string(),
  text: z.string(),
  truncated: z.boolean(),
  isError: z.boolean(),
});

const PREVIEW_ARGS_CHARS = 500;

export function mcpSkill(
  row: McpSkillRow,
  connection: GovernedMcpConnection,
): SkillDefinition<Record<string, unknown>, UntrustedContent> {
  // El destinatario de un outreach lo calcula una consulta de la plataforma
  // con consentimientos (ADR 0047 §2); una herramienta de terceros no la tiene.
  if (row.effectClass === "external_outreach") {
    throw new McpSkillError(`skill «${row.key}»: una herramienta MCP no puede ser external_outreach`);
  }
  const input = toolInputSchema(row.inputSchema);
  if (!input.ok) {
    throw new McpSkillError(`skill «${row.key}»: la herramienta no se puede usar tal cual:\n  ${input.problems.join("\n  ")}`);
  }

  return defineSkill({
    key: row.key,
    version: row.version,
    description: row.description,
    effectClass: row.effectClass,
    defaultAutonomy: row.defaultAutonomy,
    input: input.schema,
    output: UNTRUSTED_OUTPUT,
    preview(_ctx, args) {
      const json = canonicalJson(args);
      const shown = json.length > PREVIEW_ARGS_CHARS ? `${json.slice(0, PREVIEW_ARGS_CHARS)}…` : json;
      return Promise.resolve({ summary: `«${row.name}» en ${connection.server.name}, con ${shown}` });
    },
    async execute(ctx, args) {
      // La conexión lleva las credenciales de una organización: nunca sirve a otra.
      if (ctx.organizationId !== connection.organizationId) {
        throw new McpSkillError(`skill «${row.key}»: la conexión MCP es de otra organización`);
      }
      return connection.call(row.mcpToolName, row.mcpToolHash, args);
    },
  });
}
