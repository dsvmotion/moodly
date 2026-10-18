import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PWA_ICONS } from "./icons";

const PUBLIC_DIR = new URL("../../../public", import.meta.url);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d];
// Tipo de color de la cabecera IHDR: 2 = RGB (opaco), 6 = RGBA (con transparencia).
const OPAQUE = 2;
const WITH_ALPHA = 6;

/** Lee el PNG servido en `file` y devuelve sus dimensiones (cabecera IHDR). */
function readPng(file: string) {
  const bytes = readFileSync(new URL(`.${file}`, `${PUBLIC_DIR.href}/`));
  return {
    signature: [...bytes.subarray(0, 5)],
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

describe("iconos de la PWA", () => {
  it.each(PWA_ICONS)("$file existe, es PNG y mide $size×$size", ({ file, size }) => {
    const png = readPng(file);
    expect(png.signature).toEqual(PNG_SIGNATURE);
    expect(png).toMatchObject({ width: size, height: size });
  });

  it("apple-touch-icon mide 180×180 y es opaco (iOS pinta de negro lo transparente)", () => {
    const png = readPng("/icons/apple-touch-icon.png");
    expect(png.signature).toEqual(PNG_SIGNATURE);
    expect(png).toMatchObject({ width: 180, height: 180, colorType: OPAQUE });
  });

  it.each(PWA_ICONS.filter((icon) => icon.purpose === "maskable"))(
    "$file es opaco: Android lo recorta con su máscara",
    ({ file }) => expect(readPng(file).colorType).toBe(OPAQUE),
  );

  it.each(PWA_ICONS.filter((icon) => icon.purpose === "any"))(
    "$file conserva la transparencia de las esquinas de la baldosa",
    ({ file }) => expect(readPng(file).colorType).toBe(WITH_ALPHA),
  );
});
