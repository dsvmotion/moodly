import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/config se publica compilado en dist; no hace falta transpilarlo.
  poweredByHeader: false,
};

export default nextConfig;
