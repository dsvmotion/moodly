// La resolución de la cuenta de un canal en la entrada de canales (ADR 0052
// §2): la segunda y última lectura entre organizaciones de la plataforma,
// junto a los metadatos del outbox (CLAUDE.md, «Prohibido»).
//
// - Solo por coincidencia exacta de (canal, id externo), que es única
//   (channel_accounts_channel_external_id_key): un número o una cuenta es de
//   una sola organización.
// - Solo devuelve id, organización y estado: nada más de la cuenta ni de la
//   organización.
// - Quien la usa ya ha comprobado la firma del proveedor (para que nadie sin
//   firma pueda preguntar qué cuentas existen) y, después, solo accede a los
//   datos con forOrganization(organizationId de la fila).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export interface ResolvedChannelAccount {
  id: string;
  organizationId: string;
  status: "pending" | "active" | "disabled";
}

export interface ChannelAccounts {
  /** La cuenta de ese canal con ese id externo, o null si no existe. */
  resolve(channel: string, externalId: string): Promise<ResolvedChannelAccount | null>;
}

export class ChannelAccountError extends Error {
  override readonly name = "ChannelAccountError";
}

const CHANNEL = /^[a-z][a-z_]{1,30}$/;
const STATUSES = new Set(["pending", "active", "disabled"]);

export function channelAccounts(client: SupabaseClient<Database>): ChannelAccounts {
  return {
    async resolve(channel, externalId) {
      if (!CHANNEL.test(channel)) throw new ChannelAccountError("channelAccounts: canal no válido");
      if (externalId.length < 1 || externalId.length > 200) throw new ChannelAccountError("channelAccounts: id externo no válido");
      const { data, error } = await client
        .from("channel_accounts")
        .select("id, organization_id, status")
        .eq("channel", channel)
        .eq("external_id", externalId)
        .maybeSingle();
      if (error) throw new ChannelAccountError(`channelAccounts: no se pudo resolver la cuenta (${error.code})`);
      if (!data) return null;
      if (!STATUSES.has(data.status)) throw new ChannelAccountError("channelAccounts: estado de cuenta desconocido");
      return { id: data.id, organizationId: data.organization_id, status: data.status as ResolvedChannelAccount["status"] };
    },
  };
}
