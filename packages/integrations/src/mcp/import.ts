import type { ReviewedMcpServer } from "./catalog.js";
import { toolHash } from "./pin.js";
import { toolInputSchema } from "./schema.js";
import type { JsonSchema, McpTool } from "./types.js";

// De tools/list a filas de skills (ADR 0030 §2, ADR 0036). Solo las
// herramientas revisadas del servidor; cada una fijada a su huella y sin
// clasificar. La base de datos lo vuelve a imponer
// (reset_mcp_skill_classification): esto es la intención, aquello la red.

/** Cómo entra una herramienta: nada se ejecuta sin aprobación hasta que alguien la clasifica. */
export const MCP_UNCLASSIFIED = {
  effectClass: "external_message",
  defaultAutonomy: "draft",
  maxAutonomy: "draft",
} as const;

export interface McpSkillDraft {
  key: string;
  name: string;
  description: string;
  mcpToolName: string;
  mcpToolHash: string;
  inputSchema: JsonSchema;
  effectClass: typeof MCP_UNCLASSIFIED.effectClass;
  defaultAutonomy: typeof MCP_UNCLASSIFIED.defaultAutonomy;
  maxAutonomy: typeof MCP_UNCLASSIFIED.maxAutonomy;
  /** Por qué no se puede usar tal cual (campos reservados, objetos abiertos...). Vacío si se puede. */
  problems: readonly string[];
}

export interface McpImport {
  drafts: McpSkillDraft[];
  skipped: { tool: string; reason: string }[];
}

const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/; // skills.mcp_tool_name
const SKILL_KEY = /^[a-z][a-z0-9_]{1,63}$/; // skills.key

/** La clave de la skill: mcp_<servidor>_<herramienta>, en el formato de skills.key. */
export function mcpSkillKey(serverKey: string, toolName: string): string {
  return `mcp_${serverKey}_${toolName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+$/, "")
    .slice(0, 64);
}

export function importMcpTools(server: ReviewedMcpServer, tools: readonly McpTool[]): McpImport {
  const drafts: McpSkillDraft[] = [];
  const skipped: McpImport["skipped"] = [];
  const seenTools = new Set<string>();
  const seenKeys = new Set<string>();

  for (const tool of tools) {
    const skip = (reason: string) => skipped.push({ tool: tool.name, reason });
    if (!server.tools.includes(tool.name)) {
      skip("no está entre las herramientas revisadas del servidor");
      continue;
    }
    if (!TOOL_NAME.test(tool.name)) {
      skip("nombre de herramienta no válido");
      continue;
    }
    if (seenTools.has(tool.name)) {
      skip("el servidor la anuncia dos veces");
      continue;
    }
    seenTools.add(tool.name);
    const key = mcpSkillKey(server.key, tool.name);
    if (!SKILL_KEY.test(key) || seenKeys.has(key)) {
      skip(`la clave de skill «${key}» no es válida o choca con otra herramienta`);
      continue;
    }
    seenKeys.add(key);
    const input = toolInputSchema(tool.inputSchema);
    drafts.push({
      key,
      name: tool.name,
      description: tool.description ?? "",
      mcpToolName: tool.name,
      mcpToolHash: toolHash(tool),
      inputSchema: tool.inputSchema,
      ...MCP_UNCLASSIFIED,
      problems: input.ok ? [] : input.problems,
    });
  }
  for (const name of server.tools) {
    if (!tools.some((tool) => tool.name === name)) {
      skipped.push({ tool: name, reason: "revisada, pero el servidor ya no la anuncia" });
    }
  }
  return { drafts, skipped };
}
