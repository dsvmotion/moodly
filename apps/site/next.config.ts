import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { readScopeStatus } from "./scope-status.mjs";

// Estado de cada función e integración, sacado del registro de alcance al compilar
// (auditoría 2026-11-10, N-01; ver scope-status.mjs y src/components/availability.js).
const SCOPE = fileURLToPath(new URL("../../docs/scope.yaml", import.meta.url));

// Web pública de moodlycrm.com (prototipo a partir del canvas de diseño).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_SCOPE_STATUS: JSON.stringify(readScopeStatus(SCOPE)) },
  // El prototipo (/plataforma) no se indexa: además de la meta robots de su layout,
  // la cabecera cubre cualquier respuesta de esas rutas (auditoría 2026-11-10, N-04).
  async headers() {
    return [
      { source: "/plataforma", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/plataforma/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
