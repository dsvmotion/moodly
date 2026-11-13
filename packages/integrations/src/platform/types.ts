// La plataforma de conectores detrás de una interfaz (ADR 0053 §2 y §3): hoy,
// Nango (platform/transports/nango.ts); mañana puede ser otra, o nuestra propia
// autenticación, sin tocar quien la usa.
//
// - La conexión vive en la plataforma; la fila de integrations guarda su id.
//   Ese id y la organización salen siempre de la fila (forOrganization), nunca
//   de lo que genera el modelo.
// - Nada de esta interfaz devuelve tokens: la plataforma los guarda y el proxy
//   los pone en cada llamada.
// - Lo que devuelve el proveedor por el proxy es un dato no confiable: quien
//   llama lo valida con su esquema.

/**
 * Las etiquetas que llevamos a la sesión de conexión. La plataforma las copia a
 * la conexión y las devuelve firmadas en el webhook: así el webhook sabe de qué
 * organización y de qué fila es, sin creer al cliente.
 */
export interface ConnectionTags {
  organization_id: string;
  end_user_id: string;
  integration_id: string;
}

export interface ConnectSessionRequest {
  /** La clave de la integración en la plataforma (Nango: el «integration id»). */
  integrationKey: string;
  tags: ConnectionTags;
  /** Los permisos que se piden (los del catálogo). Sin ellos, los de la integración en la plataforma. */
  scopes?: readonly string[];
}

export interface ConnectSession {
  /** La URL donde la persona autoriza (el popup de la plataforma). */
  connectLink: string;
  expiresAt: Date;
}

export interface PlatformConnection {
  connectionId: string;
  integrationKey: string;
  tags: Readonly<Record<string, string>>;
}

export interface ProxyRequest {
  integrationKey: string;
  connectionId: string;
  /** Solo lectura por ahora: lo que escribe llega con su skill y su política (ADR 0047). */
  method: "GET";
  /** La ruta en la API del proveedor, empezando por «/». */
  path: string;
  query?: Readonly<Record<string, string>>;
}

export interface ConnectorPlatform {
  createConnectSession(request: ConnectSessionRequest): Promise<ConnectSession>;
  /** La conexión con sus etiquetas, sin credenciales; null si no existe. */
  getConnection(integrationKey: string, connectionId: string): Promise<PlatformConnection | null>;
  /** Borra la conexión (y la revoca donde la plataforma sepa). Si ya no existe, no falla. */
  deleteConnection(integrationKey: string, connectionId: string): Promise<void>;
  /** Una llamada a la API del proveedor con las credenciales de la conexión. Devuelve el JSON tal cual. */
  proxy(request: ProxyRequest): Promise<unknown>;
}

/**
 * - transient: vale la pena reintentar (red, 429, 5xx).
 * - unauthorized: la clave de la plataforma está mal (401/403); reintentar no sirve.
 * - not_found: la conexión no existe (o la plataforma no la reconoce).
 * - rejected: la plataforma o el proveedor rechazan la petición (otro 4xx), o la
 *   respuesta no tiene la forma esperada.
 */
export type ConnectorPlatformErrorKind = "transient" | "unauthorized" | "not_found" | "rejected";

/** Los errores nunca llevan la clave ni el cuerpo de la respuesta: solo la operación y el estado. */
export class ConnectorPlatformError extends Error {
  override readonly name = "ConnectorPlatformError";
  constructor(
    message: string,
    /** null: no llegó respuesta. */
    readonly status: number | null,
    readonly kind: ConnectorPlatformErrorKind,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.kind === "transient";
  }
}
