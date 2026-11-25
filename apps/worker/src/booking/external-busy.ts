import type { TenantDb } from "@repo/db/service";
import {
  busySourceFromReader,
  platformIntegration,
  platformIntegrationsIn,
  type BusySource,
  type ConnectorPlatform,
} from "@repo/integrations";
import type { Logger } from "pino";
import { CALENDAR_READERS } from "../integrations/calendar.ts";

// El calendario conectado (Google/Outlook) cuenta al ofrecer huecos (O-02): la
// parte del worker es resolver qué calendario y construir la fuente de tramos
// ocupados. El decorador y el filtrado son lógica de dominio (@repo/integrations,
// withExternalBusy/busySourceFromReader).
//
// - La organización y el local los pone el runtime (la conversación), nunca el
//   modelo. La fila, el id de la conexión y el proveedor salen con la base de
//   datos de esta organización (moodly_worker, RLS): una organización nunca usa
//   la conexión de otra.
// - Mismo criterio que Koibox: el calendario del local pedido; si no lo tiene,
//   el de toda la organización; nunca el de otro local. Con varios, el que se
//   activó más tarde. Un evento ocupado bloquea el hueco del local para todos
//   los recursos (mapear cada profesional a su calendario es después).

export { BUSY_TIMEOUT_MS } from "@repo/integrations";
export type { BusySource } from "@repo/integrations";

interface CalendarRow {
  provider: string;
  external_connection_id: string;
}

/** La fila del calendario conectado del local (o de la organización), o null si no hay ninguno. */
export async function resolveLocationCalendar(
  db: TenantDb,
  locationId: string | null,
): Promise<{ provider: string; connectionId: string; integrationKey: string } | null> {
  const providers = platformIntegrationsIn("calendar")
    .map((entry) => entry.provider)
    .filter((provider) => provider in CALENDAR_READERS);
  if (providers.length === 0) return null;
  // organization_id explícito (AGENTS.md, «Prohibido»), además de RLS.
  const [row] = await db.transaction((sql) =>
    sql.query<CalendarRow>(
      `select provider, external_connection_id from public.integrations
        where organization_id = $3 and provider = any($1::text[]) and kind = 'platform' and status = 'active'
          and external_connection_id is not null
          and (location_id is null or location_id = $2)
        order by (location_id is null), last_health_check desc nulls last, provider
        limit 1`,
      [providers, locationId, db.organizationId],
    ),
  );
  if (!row) return null;
  const entry = platformIntegration(row.provider);
  if (!entry || !(row.provider in CALENDAR_READERS)) return null;
  return { provider: row.provider, connectionId: row.external_connection_id, integrationKey: entry.integrationKey };
}

export interface BusySourceOptions {
  platform: ConnectorPlatform;
  provider: string;
  connectionId: string;
  integrationKey: string;
  timeoutMs?: number;
  logger?: Logger;
}

/** La fila resuelta del calendario conectado (lo que se guarda dentro de un paso de DBOS). */
export type ResolvedCalendar = NonNullable<Awaited<ReturnType<typeof resolveLocationCalendar>>>;

/**
 * La fila del calendario conectado, o null si no hay plataforma o ninguno
 * conectado. Se llama DENTRO del primer paso que ya tiene cada workflow (load,
 * waitlist-accept:find), nunca como paso nuevo: WORKER_APP_VERSION no cambia en
 * cada despliegue (MANUAL §4.4), así que un despliegue recoge los runs a medias
 * del anterior, y un paso nuevo en medio movería la secuencia de esos runs. Un
 * run guardado antes de este cambio no trae la fila y sigue como antes (sin
 * calendario conectado).
 */
export async function calendarFor(db: TenantDb, platform: ConnectorPlatform | undefined, locationId: string | null): Promise<ResolvedCalendar | null> {
  return platform ? resolveLocationCalendar(db, locationId) : null;
}

/** La fuente de tramos ocupados de una fila ya resuelta (sin pasos ni consultas). */
export function busySourceFor(platform: ConnectorPlatform | undefined, calendar: ResolvedCalendar | null | undefined, logger: Logger): BusySource | null {
  return platform && calendar ? createBusySource({ platform, ...calendar, logger }) : null;
}

/** La fuente de tramos ocupados del calendario conectado (lector del catálogo + memo + tope de tiempo). */
export function createBusySource(options: BusySourceOptions): BusySource {
  const reader = CALENDAR_READERS[options.provider];
  if (!reader) throw new Error("un calendario conectado no está en el catálogo");
  const instance = reader(options.platform, { integrationKey: options.integrationKey, connectionId: options.connectionId });
  return busySourceFromReader(instance, {
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    onError: (err) =>
      options.logger?.warn(
        { provider: options.provider, err: err instanceof Error ? err.name : "unknown" },
        "no se pudo leer el calendario conectado: no se ofrecen huecos",
      ),
  });
}
