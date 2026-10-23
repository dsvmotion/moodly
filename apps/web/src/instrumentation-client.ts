import { init } from "@sentry/nextjs";
import { SENTRY_TUNNEL, sentryOptions } from "./lib/observability/sentry";

// Errores del navegador a Sentry por el tunnel propio (ADR 0032). Sin DSN no se
// activa.
init({ ...sentryOptions(), tunnel: SENTRY_TUNNEL });
