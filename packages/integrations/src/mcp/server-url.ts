import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Antes de conectar a un servidor MCP (revisión de seguridad §7.3, «sin acceso
// a la red interna»): solo https en el puerto por defecto, con un nombre de
// dominio público, y todas sus direcciones públicas. Así una URL revisada que
// cambie de DNS no lleva al worker a la red interna ni a los metadatos de la
// nube. El transporte conecta después a la dirección comprobada, no vuelve a
// resolver (contra el DNS rebinding).

export class UnsafeServerUrlError extends Error {
  override name = "UnsafeServerUrlError";
}

export interface ResolvedAddress {
  address: string;
  family: number;
}
export type Resolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

const systemResolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

// Lo que no es Internet: privadas, loopback, enlace local, CGNAT, documentación,
// multicast, reservadas y las formas IPv6 que esconden una IPv4 (mapeada, NAT64,
// 6to4 y Teredo). Una lista por familia: BlockList compara una IPv4 también con
// las reglas IPv6 (como ::ffff:a.b.c.d), y ::ffff:0:0/96 las bloquearía todas.
const NON_PUBLIC_V4 = new BlockList();
const NON_PUBLIC_V6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC_V4.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC_V6.addSubnet(network, prefix, "ipv6");
}

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return family === 4 ? !NON_PUBLIC_V4.check(address, "ipv4") : !NON_PUBLIC_V6.check(address, "ipv6");
}

/** Comprueba la URL y devuelve las direcciones (todas públicas) a las que puede conectar el transporte. */
export async function assertSafeServerUrl(raw: string, resolve: Resolver = systemResolver): Promise<readonly ResolvedAddress[]> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeServerUrlError("la URL del servidor MCP no es válida");
  }
  if (url.protocol !== "https:") throw new UnsafeServerUrlError("el servidor MCP tiene que ir por https");
  if (url.username || url.password) throw new UnsafeServerUrlError("la URL no lleva credenciales: van en el SecretVault");
  if (url.port !== "") throw new UnsafeServerUrlError("solo el puerto por defecto de https");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(hostname) !== 0) throw new UnsafeServerUrlError("un servidor MCP se conecta por nombre, no por IP");
  if (!hostname.includes(".") || hostname === "localhost" || INTERNAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeServerUrlError(`«${hostname}» no es un nombre público`);
  }

  const addresses = await resolve(hostname);
  if (addresses.length === 0) throw new UnsafeServerUrlError(`«${hostname}» no resuelve`);
  const internal = addresses.filter(({ address }) => !isPublicAddress(address));
  if (internal.length > 0) {
    throw new UnsafeServerUrlError(`«${hostname}» resuelve a direcciones no públicas (${internal.map((a) => a.address).join(", ")})`);
  }
  return addresses;
}
