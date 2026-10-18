import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// i18n (MANUAL §9.9): la configuración por petición está en src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @repo/ui exporta código fuente (componentes shadcn/ui); Next lo compila.
  transpilePackages: ["@repo/ui"],
  // Que el navegador compruebe siempre si hay una versión nueva del service worker.
  async headers() {
    return [
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
