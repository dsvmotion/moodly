// Tunnel propio de Sentry (ADR 0032): el navegador manda los errores a la propia
// web (connect-src 'self') y el servidor los reenvía a la ingesta de Sentry en la
// UE. Solo si el sobre va a nuestro proyecto: no es un relé abierto hacia otros
// proyectos de Sentry, como el tunnel por rewrite de la SDK.

/** Límite de un sobre de errores; los normales pesan unos pocos KB. */
export const TUNNEL_MAX_BYTES = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5000;

type SentryDsn = { host: string; projectId: string; publicKey: string };

export function parseDsn(dsn: string | undefined): SentryDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.slice(1);
    if (url.protocol !== "https:" || !url.username || !/^\d+$/.test(projectId)) return null;
    return { host: url.host, projectId, publicKey: url.username };
  } catch {
    return null;
  }
}

/**
 * URL de ingesta para un sobre, o null si su cabecera (la primera línea, JSON)
 * no trae el DSN de nuestro proyecto. La URL se construye con el DSN esperado,
 * nunca con lo que manda el navegador.
 */
export function upstreamFor(envelope: Uint8Array, expected: SentryDsn): string | null {
  const newline = envelope.indexOf(10);
  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(newline === -1 ? envelope : envelope.subarray(0, newline)));
  } catch {
    return null;
  }
  const dsn =
    typeof header === "object" && header !== null && "dsn" in header && typeof header.dsn === "string"
      ? parseDsn(header.dsn)
      : null;
  if (!dsn || dsn.host !== expected.host || dsn.projectId !== expected.projectId || dsn.publicKey !== expected.publicKey) {
    return null;
  }
  return `https://${expected.host}/api/${expected.projectId}/envelope/`;
}

/**
 * POST /monitoring. Sin DSN configurado, 404 (el tunnel no existe); sobre
 * demasiado grande, 413; de otro proyecto o ilegible, 400; Sentry no responde,
 * 502. Si no, el estado que devuelva Sentry, sin su cuerpo.
 */
export async function forwardEnvelope(request: Request, dsnValue: string | undefined, send: typeof fetch = fetch): Promise<Response> {
  const dsn = parseDsn(dsnValue);
  if (!dsn) return new Response(null, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > TUNNEL_MAX_BYTES) return new Response(null, { status: 413 });
  const envelope = new Uint8Array(await request.arrayBuffer());
  if (envelope.byteLength > TUNNEL_MAX_BYTES) return new Response(null, { status: 413 });
  const upstream = upstreamFor(envelope, dsn);
  if (!upstream) return new Response(null, { status: 400 });
  try {
    const response = await send(upstream, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new Response(null, { status: response.status });
  } catch {
    return new Response(null, { status: 502 });
  }
}
