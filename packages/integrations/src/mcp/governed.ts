import { reservedPaths } from "@repo/agent-core";
import type { ReviewedMcpServer } from "./catalog.js";
import { toolHash } from "./pin.js";
import type { McpClient, UntrustedContent } from "./types.js";

// La única forma de llamar a una herramienta MCP (ADR 0036; revisión de
// seguridad §7.3). Envuelve un cliente de UNA organización y, en cada llamada:
// - solo herramientas revisadas del servidor;
// - la herramienta tiene que seguir siendo la que se fijó (misma huella); si
//   el servidor la cambió, no se llama: vuelve a revisión;
// - nunca campos reservados del runtime en los argumentos (control 3.4);
// - con un tiempo máximo y un tamaño máximo de respuesta;
// - lo que vuelve es un dato no confiable, con su procedencia (control 3.8).

export class McpToolNotAllowedError extends Error {
  override name = "McpToolNotAllowedError";
}
/** La herramienta ya no es la que se revisó: cambió o desapareció. */
export class McpToolDriftError extends Error {
  override name = "McpToolDriftError";
}
export class McpCallFailedError extends Error {
  override name = "McpCallFailedError";
}

export interface GovernedMcpConnection {
  readonly organizationId: string;
  readonly server: ReviewedMcpServer;
  call(toolName: string, pinnedHash: string, args: Record<string, unknown>): Promise<UntrustedContent>;
}

export interface GovernOptions {
  organizationId: string;
  server: ReviewedMcpServer;
  client: McpClient;
  timeoutMs?: number;
  maxResultChars?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESULT_CHARS = 20_000;

export function governMcpClient(options: GovernOptions): GovernedMcpConnection {
  const { organizationId, server, client } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResultChars = options.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;

  return {
    organizationId,
    server,
    async call(toolName, pinnedHash, args) {
      if (!server.tools.includes(toolName)) {
        throw new McpToolNotAllowedError(`«${toolName}» no es una herramienta revisada de ${server.key}`);
      }
      const reserved = reservedPaths(args);
      if (reserved.length > 0) {
        throw new McpToolNotAllowedError(`argumentos con campos que pone el runtime: ${reserved.join(", ")}`);
      }

      // Lo que anuncia ahora el servidor, no lo que anunciaba al importarla.
      const current = (await client.listTools()).find((tool) => tool.name === toolName);
      if (!current) throw new McpToolDriftError(`${server.key} ya no anuncia «${toolName}»`);
      if (toolHash(current) !== pinnedHash) {
        throw new McpToolDriftError(`«${toolName}» de ${server.key} ha cambiado desde que se revisó`);
      }

      let result;
      try {
        result = await client.callTool(toolName, args, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        // Sin el mensaje del servidor ni los argumentos: pueden llevar datos personales (ADR 0032).
        throw new McpCallFailedError(`la llamada a «${toolName}» de ${server.key} falló (${(error as Error).name})`);
      }

      const text = result.content
        .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : `[contenido ${part.type} omitido]`))
        .join("\n");
      const truncated = text.length > maxResultChars;
      return {
        untrusted: true,
        source: `mcp:${server.key}@${server.version}/${toolName}`,
        text: truncated ? text.slice(0, maxResultChars) : text,
        truncated,
        isError: result.isError === true,
      };
    },
  };
}
