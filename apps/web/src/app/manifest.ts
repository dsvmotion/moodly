import { BRAND_NAME } from "@repo/config";
import type { MetadataRoute } from "next";
import { PWA_ICONS } from "../lib/pwa/icons";

// Manifest de la PWA (se sirve en /manifest.webmanifest). Permite instalar la
// app en el iPhone y abrirla a pantalla completa. Colores: token canvas claro.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: "Agentes de IA que trabajan dentro de tu negocio.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    dir: "ltr",
    background_color: "#f4f4f5",
    theme_color: "#f4f4f5",
    icons: PWA_ICONS.map((icon) => ({
      src: icon.file,
      sizes: `${icon.size}x${icon.size}`,
      type: "image/png",
      purpose: icon.purpose,
    })),
  };
}
