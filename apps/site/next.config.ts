import type { NextConfig } from "next";

// Web pública de moodlycrm.com (prototipo a partir del canvas de diseño).
const nextConfig: NextConfig = {
  poweredByHeader: false,
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
