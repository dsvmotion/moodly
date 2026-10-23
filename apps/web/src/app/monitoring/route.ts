import { forwardEnvelope } from "@/lib/observability/sentry-tunnel";

// Tunnel de Sentry para los errores del navegador (ADR 0032). Fuera del proxy:
// llegan también desde el login, sin sesión.
export function POST(request: Request): Promise<Response> {
  return forwardEnvelope(request, process.env["NEXT_PUBLIC_SENTRY_DSN"]);
}
