import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PWA_ICONS } from "./icons";

const PUBLIC_DIR = new URL("../../../public", import.meta.url);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d];

/** Lee el PNG servido en `file` y devuelve sus dimensiones (cabecera IHDR). */
function readPng(file: string) {
  const bytes = readFileSync(new URL(`.${file}`, `${PUBLIC_DIR.href}/`));
  return {
    signature: [...bytes.subarray(0, 5)],
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("iconos de la PWA", () => {
  it.each(PWA_ICONS)("$file existe, es PNG y mide $size×$size", ({ file, size }) => {
    const png = readPng(file);
    expect(png.signature).toEqual(PNG_SIGNATURE);
    expect(png).toMatchObject({ width: size, height: size });
  });

  it("apple-touch-icon mide 180×180", () => {
    const png = readPng("/icons/apple-touch-icon.png");
    expect(png.signature).toEqual(PNG_SIGNATURE);
    expect(png).toMatchObject({ width: 180, height: 180 });
  });
});
