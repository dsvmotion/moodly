import { canonicalHash } from "@repo/agent-core";
import type { McpTool } from "./types.js";

/**
 * La huella de una herramienta tal y como se revisó (skills.mcp_tool_hash):
 * SHA-256 del JSON canónico de su nombre, su descripción y su esquema de
 * entrada. La descripción entra porque el modelo la lee: si el servidor la
 * cambia, lo que se revisó ya no es lo que hay (el «rug pull» de MCP).
 */
export function toolHash(tool: McpTool): string {
  return canonicalHash({ name: tool.name, description: tool.description ?? "", inputSchema: tool.inputSchema });
}
