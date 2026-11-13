import "server-only";
import { createNangoPlatform, parseNangoHost, type ConnectorPlatform } from "@repo/integrations/platform";
import { logger } from "@/lib/observability/logger";

// La plataforma de conectores en la web (O-02, ADR 0053): Nango, con la clave
// secreta del servidor (NANGO_API_KEY) y la URL base como configuración
// (NANGO_HOST: Nango Cloud por defecto; la instancia autoalojada en la UE antes
// del primer dato real). Sin clave, no hay plataforma y la pantalla lo dice.
// No hay interruptor de «falso»: los e2e apuntan NANGO_HOST a un stub local.

let cached: { key: string; host: string; platform: ConnectorPlatform } | null = null;

export function getConnectorPlatform(env: Record<string, string | undefined> = process.env): ConnectorPlatform | null {
  const secretKey = env["NANGO_API_KEY"]?.trim();
  if (!secretKey) return null;
  let host: string;
  try {
    host = parseNangoHost(env["NANGO_HOST"]);
  } catch (err) {
    // El mensaje es nuestro y no repite el valor.
    logger.error({ err }, "NANGO_HOST no es válida: las integraciones de plataforma no están disponibles");
    return null;
  }
  if (cached?.key === secretKey && cached.host === host) return cached.platform;
  const platform = createNangoPlatform({ secretKey, host });
  cached = { key: secretKey, host, platform };
  return platform;
}
