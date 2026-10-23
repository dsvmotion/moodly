import type { Breadcrumb, ErrorEvent, init } from "@sentry/nextjs";
import { pathOnly, redactEmails } from "./scrub";

// Errores con contexto en Sentry, región UE (ADR 0032), con el mismo cuidado que
// los logs: sin datos personales ni tokens. Lo comparten el servidor
// (instrumentation.ts) y el navegador (instrumentation-client.ts): solo tipos de
// Sentry y nada de Node.

/** Ruta propia por la que el navegador manda los errores (connect-src 'self'). */
export const SENTRY_TUNNEL = "/monitoring";

// Breadcrumbs cuyos datos llevan una URL (fetch, xhr, navegación).
const URL_KEYS = new Set(["url", "from", "to"]);
// Campos de los contextos con una URL o ruta (p. ej. nextjs.request_path).
const URL_FIELD = /(?:url|path)$/i;

/**
 * Un breadcrumb sin datos personales: fuera los de consola (pueden llevar
 * cualquier cosa), las URLs sin query ni fragmento y los emails censurados.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (scrubbed.message) scrubbed.message = redactEmails(scrubbed.message);
  if (scrubbed.data) {
    scrubbed.data = Object.fromEntries(
      Object.entries(scrubbed.data).map(([key, value]) => [key, URL_KEYS.has(key) && typeof value === "string" ? pathOnly(value) : value]),
    );
  }
  return scrubbed;
}

/**
 * Un evento sin datos personales:
 * - de la petición, solo el método y la URL sin query ni fragmento (sin
 *   cabeceras, cookies ni cuerpo);
 * - las URLs y rutas de los contextos, también sin query;
 * - sin usuario;
 * - emails censurados en el mensaje y en las excepciones;
 * - breadcrumbs limpios.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const { method, url } = event.request;
    event.request = {
      ...(method ? { method } : {}),
      ...(url ? { url: pathOnly(url) } : {}),
    };
  }
  for (const context of Object.values(event.contexts ?? {})) {
    for (const [key, value] of Object.entries(context ?? {})) {
      if (context && URL_FIELD.test(key) && typeof value === "string") context[key] = pathOnly(value);
    }
  }
  delete event.user;
  if (event.message) event.message = redactEmails(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactEmails(exception.value);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  return event;
}

// Integraciones por defecto que no queremos:
// - LinkedErrors: las `cause` encadenadas; el detalle de Supabase va en `cause`
//   y, como en los logs, no sale de la app;
// - BrowserTracing, WebVitals y SpanStreaming: trazas y métricas, que no se usan
//   (la SDK de Next añade BrowserTracing aunque no haya tasa de muestreo);
// - Console: la consola puede llevar cualquier dato;
// - BrowserSession: una sesión por cada página cargada (salud de versiones), que
//   no se usa y pasaría por el tunnel en cada visita.
const UNWANTED_INTEGRATIONS = new Set(["LinkedErrors", "BrowserTracing", "WebVitals", "SpanStreaming", "Console", "BrowserSession"]);

export function withoutUnwantedIntegrations<T extends { name: string }>(integrations: T[]): T[] {
  return integrations.filter((integration) => !UNWANTED_INTEGRATIONS.has(integration.name));
}

type SentryInitOptions = NonNullable<Parameters<typeof init>[0]>;

/**
 * Opciones comunes. Sin DSN (local, CI, e2e) Sentry no se activa.
 * - `dataCollection`: la SDK 11 lo recoge todo por defecto (usuario e IP,
 *   cookies, cabeceras, cuerpos, query, variables y código de los frames);
 *   aquí, nada.
 *   `sendDefaultPii` ya no existe en esta versión.
 * - Sin `tracesSampleRate`: con 0 la SDK seguiría propagando cabeceras de traza;
 *   así no hay trazas en absoluto, solo errores. Sin session replay.
 * El `satisfies` hace que una opción que la SDK no conoce no compile.
 */
export function sentryOptions() {
  // Escrito así para que Next lo incruste en el código del navegador.
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      // Sin las líneas de código alrededor de cada frame: sin source maps son
      // código minificado que no ayuda, y así no sale nada del bundle.
      frameContextLines: 0,
    },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    integrations: withoutUnwantedIntegrations,
  } satisfies SentryInitOptions;
}
