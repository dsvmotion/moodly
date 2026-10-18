// Genera los iconos PNG de la PWA a partir de public/icons/moodly-mark*.svg,
// renderizándolos con el Chromium de Playwright. Los PNG se commitean.
// Uso (desde la raíz): node apps/web/scripts/pwa-icons.ts
// (CHROMIUM_PATH=<ruta> si el Chromium de Playwright no está instalado.)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const iconsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/icons");

const targets: ReadonlyArray<{ source: string; size: number; file: string }> = [
  { source: "moodly-mark.svg", size: 192, file: "icon-192.png" },
  { source: "moodly-mark.svg", size: 512, file: "icon-512.png" },
  { source: "moodly-mark-maskable.svg", size: 192, file: "icon-192-maskable.png" },
  { source: "moodly-mark-maskable.svg", size: 512, file: "icon-512-maskable.png" },
  { source: "moodly-mark.svg", size: 180, file: "apple-touch-icon.png" },
];

const browser = await chromium.launch(
  process.env["CHROMIUM_PATH"] ? { executablePath: process.env["CHROMIUM_PATH"] } : {},
);
try {
  const page = await browser.newPage();
  for (const { source, size, file } of targets) {
    const svg = readFileSync(resolve(iconsDir, source)).toString("base64");
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0"><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.screenshot({ path: resolve(iconsDir, file) });
  }
} finally {
  await browser.close();
}
console.log(`${targets.length} iconos escritos en public/icons`);
