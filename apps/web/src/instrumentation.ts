import type { Instrumentation } from "next";

// Errores del servidor (render, Server Actions, rutas) como una línea JSON cada
// uno (ADR 0032). Solo nombre, mensaje (genérico: el detalle de Supabase va en
// `cause` y no se escribe), digest y la ruta sin query: un token de invitación
// nunca llega a los logs.
// Next avisa a veces dos veces del mismo error (mismo digest): se escribe una.
const recentDigests = new Set<string>();

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (err as Error & { digest?: string }).digest;
  if (digest) {
    if (recentDigests.has(digest)) return;
    recentDigests.add(digest);
    if (recentDigests.size > 500) recentDigests.delete(recentDigests.values().next().value as string);
  }
  const { logger } = await import("./lib/observability/logger");
  const { pathOnly } = await import("./lib/observability/logger-core");
  logger.error(
    {
      event: "request.error",
      err: { name: err.name, message: err.message, digest },
      method: request.method,
      path: pathOnly(request.path),
      route: context.routePath,
      router: context.routerKind,
      route_type: context.routeType,
    },
    "request.error",
  );
};
