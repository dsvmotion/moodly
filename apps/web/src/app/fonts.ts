import localFont from "next/font/local";

/*
 * Fuentes de marca Moodly, cargadas localmente (woff2 en src/fonts).
 * Exponen variables CSS que globals.css enlaza con los tokens --font-sans
 * y --font-display de @repo/ui. Licencia de Labil Grotesk confirmada (2026-10-08).
 */

// Cuerpo: Plus Jakarta Sans (licencia abierta SIL OFL).
export const jakarta = localFont({
  src: [
    { path: "../fonts/PlusJakartaSans-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/PlusJakartaSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/PlusJakartaSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/PlusJakartaSans-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

// Titulares: Labil Grotesk (Thin para H1; sin SemiBold → Medium).
export const labil = localFont({
  src: [
    { path: "../fonts/LabilGrotesk-Thin.woff2", weight: "100", style: "normal" },
    { path: "../fonts/LabilGrotesk-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/LabilGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/LabilGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/LabilGrotesk-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-labil",
  display: "swap",
});
