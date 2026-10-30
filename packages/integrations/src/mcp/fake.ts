import type { McpCallResult, McpClient, McpTool } from "./types.js";

// Un servidor MCP falso para tests y evals (MANUAL §7.1, modo sandbox).

export interface FakeMcpClient extends McpClient {
  readonly calls: { name: string; args: Record<string, unknown> }[];
  /** Cambia lo que anuncia el servidor (para probar una herramienta que cambia). */
  setTools(tools: readonly McpTool[]): void;
}

export function createFakeMcpClient(options: {
  tools: readonly McpTool[];
  respond?: (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<McpCallResult>;
}): FakeMcpClient {
  let tools = options.tools;
  const calls: FakeMcpClient["calls"] = [];
  const respond = options.respond ?? ((name) => Promise.resolve({ content: [{ type: "text", text: `ok: ${name}` }] }));
  return {
    calls,
    setTools(next) {
      tools = next;
    },
    listTools: () => Promise.resolve(tools),
    callTool(name, args, { signal }) {
      calls.push({ name, args });
      return respond(name, args, signal);
    },
  };
}
