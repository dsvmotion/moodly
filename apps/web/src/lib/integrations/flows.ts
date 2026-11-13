import { ConnectorPlatformError, type ConnectorPlatform, type PlatformIntegration } from "@repo/integrations/platform";

// La lógica de conectar y desconectar, sin Next.js ni Supabase (O-02): las
// Server Actions le dan el acceso a la fila (con el cliente de la persona, bajo
// RLS) y la plataforma. Así se prueba sola, también las carreras con el webhook.

export interface IntegrationRow {
  id: string;
  status: string;
  externalConnectionId: string | null;
}

/** El acceso a la fila de esta organización y este proveedor (RLS y guard_integration_write mandan). */
export interface IntegrationStore {
  find(): Promise<IntegrationRow | null>;
  /** Crea la fila pendiente; devuelve su id, o null si RLS no deja. */
  insertPending(): Promise<string | null>;
  /** Vuelve a pendiente (reconectar). false si no la alcanza. */
  setPending(id: string): Promise<boolean>;
  /**
   * La pasa a desconectada solo si sigue apuntando a `expectedConnectionId`
   * (null: sin conexión). false si no cambió ninguna fila (otra conexión llegó
   * mientras tanto, o no la alcanza).
   */
  markDisconnected(id: string, expectedConnectionId: string | null): Promise<boolean>;
}

export type FlowError = "not_allowed" | "platform_failed";

export interface ConnectOutcome {
  ok: boolean;
  error?: FlowError;
  connectLink?: string;
  integrationId?: string;
  /** El tipo de error de la plataforma, para el log. */
  platformErrorKind?: string;
}

function kindOf(err: unknown): string {
  return err instanceof ConnectorPlatformError ? err.kind : "unknown";
}

/**
 * Conectar o reconectar. Para no dejar una fila «pendiente» sin salida:
 * - si ya existe, primero se pide la sesión a Nango y solo después pasa a
 *   pendiente (si Nango falla, la fila se queda como estaba);
 * - si es nueva, se crea pendiente (hace falta su id para las etiquetas) y, si
 *   Nango falla, vuelve a desconectada.
 */
export async function connectFlow(
  store: IntegrationStore,
  platform: ConnectorPlatform,
  entry: PlatformIntegration,
  tags: { organizationId: string; userId: string },
): Promise<ConnectOutcome> {
  const existing = await store.find();
  const integrationId = existing ? existing.id : await store.insertPending();
  if (!integrationId) return { ok: false, error: "not_allowed" };

  let connectLink: string;
  try {
    const session = await platform.createConnectSession({
      integrationKey: entry.integrationKey,
      tags: { organization_id: tags.organizationId, end_user_id: tags.userId, integration_id: integrationId },
    });
    connectLink = session.connectLink;
  } catch (err) {
    if (!existing) await store.markDisconnected(integrationId, null);
    return { ok: false, error: "platform_failed", integrationId, platformErrorKind: kindOf(err) };
  }
  if (existing && !(await store.setPending(integrationId))) return { ok: false, error: "not_allowed", integrationId };
  return { ok: true, connectLink, integrationId };
}

export interface DisconnectOutcome {
  ok: boolean;
  error?: FlowError;
  integrationId?: string;
  platformErrorKind?: string;
  /** Las conexiones borradas en Nango (más de una si el webhook trajo otra a mitad). */
  deleted: string[];
}

/** Cuántas veces se vuelve a leer si una conexión nueva llega a mitad. */
const DISCONNECT_ATTEMPTS = 3;

/**
 * Desconectar: borrar en Nango la conexión que tiene la fila y pasarla a
 * desconectada solo si sigue siendo esa. Si el webhook trae otra entre la
 * lectura y el cambio, el cambio no alcanza ninguna fila: se vuelve a leer y
 * se borra también la nueva, para que no quede viva en Nango con los tokens.
 * Si Nango falla, la fila no cambia.
 */
export async function disconnectFlow(
  store: IntegrationStore,
  platform: ConnectorPlatform,
  entry: PlatformIntegration,
): Promise<DisconnectOutcome> {
  const deleted: string[] = [];
  for (let attempt = 0; attempt < DISCONNECT_ATTEMPTS; attempt++) {
    const row = await store.find();
    if (!row) return { ok: false, error: "not_allowed", deleted };
    if (row.status === "disconnected" && row.externalConnectionId === null) return { ok: true, integrationId: row.id, deleted };
    if (row.externalConnectionId && !deleted.includes(row.externalConnectionId)) {
      try {
        await platform.deleteConnection(entry.integrationKey, row.externalConnectionId);
      } catch (err) {
        return { ok: false, error: "platform_failed", integrationId: row.id, platformErrorKind: kindOf(err), deleted };
      }
      deleted.push(row.externalConnectionId);
    }
    if (await store.markDisconnected(row.id, row.externalConnectionId)) return { ok: true, integrationId: row.id, deleted };
  }
  return { ok: false, error: "not_allowed", deleted };
}
