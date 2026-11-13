import type { ServiceDb } from "@repo/db/service";
import { createKoiboxReader, type KoiboxReader } from "@repo/integrations";
import type { SecretVault } from "../secrets/vault.ts";

// Koibox, solo lectura (int-koibox, O-02): el lector de la integración nativa
// de UNA organización, con su clave descifrada en memoria y la zona horaria de
// su centro. Todavía sin skill (no llega al modelo): la skill de reservas, con
// su clase de efecto y sus evals, es el incremento siguiente.
//
// - La organización la pone quien llama desde el runtime (la fila del evento o
//   del run), nunca lo que genera el modelo.
// - La fila, el secreto y la zona horaria salen con forOrganization(org)
//   .transaction (moodly_worker, RLS): una organización nunca usa la clave de
//   otra. El secreto está ligado a su organización (ADR 0034): copiado a otra,
//   no se descifra.
// - La clave en claro solo existe en memoria, dentro del lector. Nunca va a un
//   log ni a un error.
// - El local también lo pone el runtime (el de la conversación): con una clave
//   por local, se usa la de ese local; si no la hay, la de toda la organización.
//   Nunca la de otro local.
// - Zona horaria: la del local de la integración; si la integración es de toda
//   la organización, la del local pedido o, sin él, la de su único local
//   activo. Con varios locales y sin local, no se adivina: se rechaza.

export const KOIBOX_PROVIDER = "koibox";
/**
 * El nombre del secreto (integration_secrets.name, único por organización): uno
 * para la clave de toda la organización y uno por local. La fila lo encuentra
 * por secret_id; el nombre solo lo hace legible y evita choques.
 */
export function koiboxSecretName(locationId: string | null): string {
  return locationId ? `koibox.${locationId}` : "koibox.api_key";
}

export class KoiboxSetupError extends Error {
  override name = "KoiboxSetupError";
}

export interface LoadKoiboxRequest {
  db: ServiceDb;
  vault: SecretVault;
  organizationId: string;
  /** El local de la conversación o del run (lo pone el runtime), o null si no hay. */
  locationId: string | null;
  /** KOIBOX_API_BASE (configuración del worker). */
  apiBase?: string | null;
  fetch?: typeof globalThis.fetch;
}

interface Row {
  location_id: string | null;
  key_ref: string;
  encrypted_data_key: string;
  ciphertext: string;
}

/** El lector de Koibox de la organización, o null si no tiene Koibox conectado (activo y con su clave). */
export async function loadKoiboxReader(request: LoadKoiboxRequest): Promise<KoiboxReader | null> {
  const { organizationId, locationId } = request;
  const found = await request.db.forOrganization(organizationId).transaction(async (sql) => {
    // La del local pedido primero; si no tiene, la de toda la organización. Nunca la de otro local.
    const [row] = await sql.query<Row>(
      `select i.location_id, s.key_ref, s.encrypted_data_key, s.ciphertext
         from public.integrations i
         join public.integration_secrets s on s.id = i.secret_id and s.organization_id = i.organization_id
        where i.organization_id = $1 and i.provider = $2 and i.kind = 'native' and i.status = 'active'
          and s.kind = 'integration'
          and (i.location_id is null or i.location_id = $3)
        order by i.location_id nulls last
        limit 1`,
      [organizationId, KOIBOX_PROVIDER, locationId],
    );
    if (!row) return null;
    const zoneLocation = row.location_id ?? locationId;
    const zones = await sql.query<{ timezone: string }>(
      zoneLocation
        ? `select timezone from public.locations where organization_id = $1 and id = $2`
        : `select timezone from public.locations where organization_id = $1 and status = 'active' limit 2`,
      zoneLocation ? [organizationId, zoneLocation] : [organizationId],
    );
    return { row, zones: zones.map((z) => z.timezone) };
  });
  if (!found) return null;
  if (found.zones.length !== 1 || !found.zones[0]) {
    throw new KoiboxSetupError("No se sabe la zona horaria del centro de Koibox: ni la integración ni la petición tienen local, y la organización no tiene un único local activo");
  }
  const apiKey = await request.vault.open(organizationId, {
    keyRef: found.row.key_ref,
    encryptedDataKey: found.row.encrypted_data_key,
    ciphertext: found.row.ciphertext,
  });
  return createKoiboxReader({
    apiKey,
    timeZone: found.zones[0],
    ...(request.apiBase ? { apiBase: request.apiBase } : {}),
    ...(request.fetch ? { fetch: request.fetch } : {}),
  });
}
