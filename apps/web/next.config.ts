import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

// i18n (MANUAL §9.9): la configuración por petición está en src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @repo/ui exporta código fuente (componentes shadcn/ui); Next lo compila.
  transpilePackages: ["@repo/ui"],
  // Cabeceras de seguridad en todas las respuestas; la CSP la pone el proxy (lleva nonce).
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Que el navegador compruebe siempre si hay una versión nueva del service worker.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

// Sentry (ADR 0032; opciones de la SDK en src/lib/observability/sentry.ts):
// - sin subir source maps ni crear releases (no hay token de Sentry en el build)
//   y sin telemetría del plugin;
// - sin el tunnel por rewrite de la SDK, que reenvía a cualquier proyecto de
//   Sentry: el propio está en src/app/monitoring.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  release: { create: false, finalize: false },
  // Sin trazas: no hace falta instrumentar las navegaciones.
  suppressOnRouterTransitionStartWarning: true,
});
