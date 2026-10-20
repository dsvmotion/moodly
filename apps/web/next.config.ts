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

export default withNextIntl(nextConfig);
