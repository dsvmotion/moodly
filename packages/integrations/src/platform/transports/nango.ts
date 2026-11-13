import { z } from "zod";
import {
  ConnectorPlatformError,
  type ConnectorPlatform,
  type ConnectorPlatformErrorKind,
  type PlatformConnection,
} from "../types.js";

// Nango por su API HTTP (ADR 0053), sin SDK: unos pocos fetch. Es el único sitio
// del monorepo que habla con Nango (lo vigila platform/boundary.test.ts).
//
// - La URL base es configuración (NANGO_HOST): hoy Nango Cloud para desarrollo,
//   antes del primer dato real la instancia autoalojada en la UE. Cambiar de
//   una a otra es solo configuración.
// - La clave secreta va solo en la cabecera Authorization: nunca en un error ni
//   en un log. Los errores llevan la operación y el estado HTTP, no el cuerpo.
// - getConnection usa el listado (GET /connections?connectionId=…), que no trae
//   credenciales: los tokens no pasan por nuestra memoria.

export const NANGO_DEFAULT_HOST = "https://api.nango.dev";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Valida la URL base de Nango: https, o http solo en loopback (el stub de los
 * e2e o una instancia local). Sin credenciales, parámetros ni fragmento.
 * Devuelve la URL sin barra final. Lanza si no vale (sin repetir el valor).
 */
export function parseNangoHost(value: string | undefined | null): string {
  const raw = value?.trim() || NANGO_DEFAULT_HOST;
  if (!URL.canParse(raw)) throw new Error("NANGO_HOST no es una URL");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("NANGO_HOST: sin credenciales, parámetros ni fragmento");
  }
  if (!(url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname)))) {
    throw new Error("NANGO_HOST: https://… (o http:// solo en loopback)");
  }
  return url.toString().replace(/\/+$/, "");
}

export interface NangoPlatformOptions {
  secretKey: string;
  /** La URL base; por defecto, Nango Cloud. Pasa por parseNangoHost. */
  host?: string | null;
  fetch?: typeof globalThis.fetch;
}

const connectSessionResponse = z.object({
  data: z.object({ token: z.string().min(1), connect_link: z.string().min(1), expires_at: z.string().min(1) }),
});

const connectionsResponse = z.object({
  connections: z.array(
    z.object({
      connection_id: z.string(),
      provider_config_key: z.string(),
      tags: z.record(z.string(), z.string()).nullish(),
    }),
  ),
});

function kindFor(status: number): ConnectorPlatformErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429 || status >= 500) return "transient";
  return "rejected";
}

/** Una ruta de la API del proveedor: empieza por «/», sin «..», sin esquema ni host, sin «?» ni «#». */
function safeProxyPath(path: string): string {
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(path) || path.startsWith("//") || /(^|\/)\.\.?(\/|$)/.test(path)) {
    throw new ConnectorPlatformError("La ruta del proxy no es válida", null, "rejected");
  }
  return path;
}

export function createNangoPlatform({ secretKey, host, fetch = globalThis.fetch }: NangoPlatformOptions): ConnectorPlatform {
  if (!secretKey.trim()) throw new Error("Falta la clave secreta de Nango");
  const base = parseNangoHost(host);
  const connectHost = new URL(base);

  async function call(operation: string, path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${secretKey}`, ...(init.headers as Record<string, string> | undefined) },
        redirect: "error",
      });
    } catch {
      throw new ConnectorPlatformError(`Nango no respondió (${operation})`, null, "transient");
    }
    if (!response.ok) {
      // El cuerpo no se lee para el error: puede repetir datos de la conexión.
      await response.body?.cancel().catch(() => undefined);
      throw new ConnectorPlatformError(`Nango rechazó ${operation} (${response.status})`, response.status, kindFor(response.status));
    }
    return response;
  }

  async function json(operation: string, response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new ConnectorPlatformError(`Nango devolvió una respuesta que no es JSON (${operation})`, response.status, "rejected");
    }
  }

  return {
    async createConnectSession({ integrationKey, tags }) {
      const response = await call("la sesión de conexión", "/connect/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, allowed_integrations: [integrationKey] }),
      });
      const parsed = connectSessionResponse.safeParse(await json("la sesión de conexión", response));
      if (!parsed.success) throw new ConnectorPlatformError("La sesión de conexión no tiene la forma esperada", response.status, "rejected");
      const { connect_link: link, expires_at: expiresAt } = parsed.data.data;
      // El enlace es de Nango: https (o el loopback de la instancia local), nunca otra cosa.
      if (!URL.canParse(link)) throw new ConnectorPlatformError("El enlace de conexión no es una URL", response.status, "rejected");
      const url = new URL(link);
      const local = connectHost.protocol === "http:" && url.protocol === "http:" && LOOPBACK.has(url.hostname);
      if (url.protocol !== "https:" && !local) {
        throw new ConnectorPlatformError("El enlace de conexión no es https", response.status, "rejected");
      }
      const expires = new Date(expiresAt);
      if (Number.isNaN(expires.getTime())) throw new ConnectorPlatformError("La caducidad no es una fecha", response.status, "rejected");
      return { connectLink: url.toString(), expiresAt: expires };
    },

    async getConnection(integrationKey, connectionId) {
      const query = new URLSearchParams({ connectionId });
      const response = await call("la lectura de la conexión", `/connections?${query.toString()}`);
      const parsed = connectionsResponse.safeParse(await json("la lectura de la conexión", response));
      if (!parsed.success) throw new ConnectorPlatformError("La conexión no tiene la forma esperada", response.status, "rejected");
      const found = parsed.data.connections.find(
        (c) => c.connection_id === connectionId && c.provider_config_key === integrationKey,
      );
      if (!found) return null;
      const connection: PlatformConnection = {
        connectionId: found.connection_id,
        integrationKey: found.provider_config_key,
        tags: Object.freeze({ ...(found.tags ?? {}) }),
      };
      return connection;
    },

    async deleteConnection(integrationKey, connectionId) {
      const query = new URLSearchParams({ provider_config_key: integrationKey });
      try {
        const response = await call("el borrado de la conexión", `/connections/${encodeURIComponent(connectionId)}?${query.toString()}`, {
          method: "DELETE",
        });
        await response.body?.cancel().catch(() => undefined);
      } catch (err) {
        // Ya no existe: lo que se quería.
        if (err instanceof ConnectorPlatformError && err.kind === "not_found") return;
        throw err;
      }
    },

    async proxy({ integrationKey, connectionId, method, path, query }) {
      const search = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";
      const response = await call("la llamada por el proxy", `/proxy${safeProxyPath(path)}${search}`, {
        method,
        headers: { "Connection-Id": connectionId, "Provider-Config-Key": integrationKey },
      });
      return json("la llamada por el proxy", response);
    },
  };
}
