// Lo que el runtime necesita de un servidor MCP (ADR 0036). El cliente real
// (el SDK oficial de MCP) llega con el primer servidor, en mcp/transports/:
// fuera de esa carpeta nadie lo importa (sdk-boundary.test.ts).

/** Un JSON Schema tal y como lo anuncia el servidor. */
export type JsonSchema = Record<string, unknown>;

/** Una herramienta de tools/list. */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export type McpContent = { type: "text"; text: string } | { type: string; [key: string]: unknown };

/** La respuesta de tools/call. */
export interface McpCallResult {
  content: readonly McpContent[];
  isError?: boolean;
}

/**
 * Un cliente MCP ya conectado a un servidor, con las credenciales de UNA
 * organización (de su SecretVault). Nunca se comparte entre organizaciones.
 */
export interface McpClient {
  listTools(): Promise<readonly McpTool[]>;
  callTool(name: string, args: Record<string, unknown>, options: { signal: AbortSignal }): Promise<McpCallResult>;
}

/**
 * Lo que devuelve una herramienta MCP: datos no confiables (control 3.8). El
 * runtime se lo da al modelo marcado como dato, nunca como instrucción, y
 * nada de lo que diga cambia el destinatario, el tenant ni la autonomía.
 */
export interface UntrustedContent {
  untrusted: true;
  /** De dónde viene: mcp:<servidor>@<versión>/<herramienta>. */
  source: string;
  text: string;
  truncated: boolean;
  /** El servidor dijo que la llamada falló (isError). */
  isError: boolean;
}
