// Genera los iconos PNG de la PWA a partir del icono maestro
// (scripts/pwa-icons/app-icon.svg: la «M» del logotipo, negra sobre blanco, a
// sangre), dibujándolo en un canvas del Chromium de Playwright. Los PNG se commitean.
// Uso (desde la raíz): node apps/web/scripts/pwa-icons.ts
// (CHROMIUM_PATH=<ruta> si el Chromium de Playwright no está instalado.)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(scriptDir, "../public/icons");
const source = readFileSync(resolve(scriptDir, "pwa-icons/app-icon.svg")).toString("base64");

// - any: la baldosa con las esquinas redondeadas (radio de la máscara de iOS,
//   22,37 %) y transparentes fuera de ella.
// - full-bleed: opaco y a sangre para iOS, que aplica su propia máscara.
// - maskable: opaco y a sangre para Android. La M (50 % del ancho) ya cae dentro
//   de la zona segura circular (80 % central), así que no hace falta reducirla.
type Kind = "any" | "full-bleed" | "maskable";
const targets: ReadonlyArray<{ file: string; size: number; kind: Kind }> = [
  { file: "icon-192.png", size: 192, kind: "any" },
  { file: "icon-512.png", size: 512, kind: "any" },
  { file: "icon-192-maskable.png", size: 192, kind: "maskable" },
  { file: "icon-512-maskable.png", size: 512, kind: "maskable" },
  { file: "apple-touch-icon.png", size: 180, kind: "full-bleed" },
];

const browser = await chromium.launch(
  process.env["CHROMIUM_PATH"] ? { executablePath: process.env["CHROMIUM_PATH"] } : {},
);
try {
  const page = await browser.newPage();
  for (const { file, size, kind } of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0"><canvas id="c" width="${size}" height="${size}" style="display:block"></canvas></body>`);
    await page.evaluate(
      async ({ src, size, kind }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${src}`;
        await image.decode();
        const canvas = document.getElementById("c") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("El canvas no ofrece contexto 2d");
        ctx.imageSmoothingQuality = "high";
        if (kind === "any") {
          ctx.beginPath();
          ctx.roundRect(0, 0, size, size, size * 0.2237);
          ctx.clip();
        }
        ctx.drawImage(image, 0, 0, size, size);
      },
      { src: source, size, kind },
    );
    const png = await page.locator("#c").screenshot({ omitBackground: kind === "any" });
    writeFileSync(resolve(iconsDir, file), png);
  }
} finally {
  await browser.close();
}
console.log(`${targets.length} iconos escritos en public/icons`);
