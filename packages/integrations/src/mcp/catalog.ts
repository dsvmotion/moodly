// Servidores MCP revisados (ADR 0036; revisión de seguridad §7.3). Solo se
// conecta un servidor que está aquí, en la versión revisada y con las
// herramientas revisadas. Añadir uno es un PR con su revisión: quién lo
// mantiene, qué hace cada herramienta y con qué permisos, y dónde procesa.

export interface ReviewedMcpServer {
  /** La clave del proveedor (integrations.provider). */
  key: string;
  name: string;
  /** El endpoint remoto (https), comprobado con assertSafeServerUrl antes de conectar. */
  url: string;
  /** La versión revisada (integrations.server_version). */
  version: string;
  reviewedAt: string;
  /** Las herramientas que se pueden importar: el resto no llega a ser skill. */
  tools: readonly string[];
}

/** Ninguno todavía: el primero llega con su cliente (paso 3c no activa proveedores). */
export const REVIEWED_MCP_SERVERS: readonly ReviewedMcpServer[] = [];

export class UnreviewedMcpServerError extends Error {
  override name = "UnreviewedMcpServerError";
}

/** El servidor revisado con esa clave y esa versión exacta, o un error. */
export function reviewedServer(
  key: string,
  version: string,
  catalog: readonly ReviewedMcpServer[] = REVIEWED_MCP_SERVERS,
): ReviewedMcpServer {
  const server = catalog.find((entry) => entry.key === key);
  if (!server) throw new UnreviewedMcpServerError(`el servidor MCP «${key}» no está revisado`);
  if (server.version !== version) {
    throw new UnreviewedMcpServerError(`«${key}» está revisado en la versión ${server.version}, no en la ${version}`);
  }
  return server;
}
