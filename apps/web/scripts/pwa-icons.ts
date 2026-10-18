// Genera los iconos PNG de la PWA a partir del icono maestro
// (scripts/pwa-icons/app-icon.png, la baldosa sobre fondo transparente),
// componiéndolos en un canvas del Chromium de Playwright. Los PNG se commitean.
// Uso (desde la raíz): node apps/web/scripts/pwa-icons.ts
// (CHROMIUM_PATH=<ruta> si el Chromium de Playwright no está instalado.)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(scriptDir, "../public/icons");
const source = readFileSync(resolve(scriptDir, "pwa-icons/app-icon.png")).toString("base64");

// La baldosa dentro del maestro (px del maestro): fuera de ella es transparente.
const TILE = { x: 93, y: 94, size: 1063 };

// - any: la baldosa tal cual, con sus esquinas transparentes.
// - full-bleed: opaco para iOS. La baldosa ocupa todo el icono y las esquinas
//   (más redondas que la máscara de iOS) se rellenan con la propia baldosa
//   ampliada y difuminada, para que no queden en negro.
// - maskable: opaco para Android. La baldosa al 80 % sobre ese mismo fondo,
//   con el símbolo dentro de la zona segura circular (80 % central).
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
      async ({ src, tile, size, kind }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${src}`;
        await image.decode();
        const canvas = document.getElementById("c") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("El canvas no ofrece contexto 2d");
        ctx.imageSmoothingQuality = "high";
        const drawTile = (scale: number, blur = 0) => {
          const side = size * scale;
          const offset = (size - side) / 2;
          ctx.filter = blur ? `blur(${blur}px)` : "none";
          ctx.drawImage(image, tile.x, tile.y, tile.size, tile.size, offset, offset, side, side);
        };
        if (kind !== "any") drawTile(1.6, size / 12);
        drawTile(kind === "maskable" ? 0.8 : 1);
      },
      { src: source, tile: TILE, size, kind },
    );
    const png = await page.locator("#c").screenshot({ omitBackground: kind === "any" });
    writeFileSync(resolve(iconsDir, file), png);
  }
} finally {
  await browser.close();
}
console.log(`${targets.length} iconos escritos en public/icons`);
