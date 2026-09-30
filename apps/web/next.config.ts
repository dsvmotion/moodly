import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// i18n (MANUAL §9.9): la configuración por petición está en src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @repo/ui exporta código fuente (componentes shadcn/ui); Next lo compila.
  transpilePackages: ["@repo/ui"],
};

export default withNextIntl(nextConfig);
