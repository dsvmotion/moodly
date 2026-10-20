import { BRAND_NAME } from "@repo/config";
import { describe, expect, it } from "vitest";
import { PWA_ICONS } from "../lib/pwa/icons";
import manifest from "./manifest";

describe("manifest de la PWA", () => {
  const m = manifest();

  it("usa la marca y abre la app a pantalla completa", () => {
    expect(m).toMatchObject({
      name: BRAND_NAME,
      short_name: BRAND_NAME,
      start_url: "/app",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      lang: "es",
      background_color: "#f4f4f5",
      theme_color: "#f4f4f5",
    });
  });

  it("declara los cuatro iconos", () => {
    expect(m.icons).toEqual(
      PWA_ICONS.map((i) => ({ src: i.file, sizes: `${i.size}x${i.size}`, type: "image/png", purpose: i.purpose })),
    );
  });
});
