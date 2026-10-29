import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, localeFromTag, LOCALES } from "./config";

describe("i18n config", () => {
  it("inglés por defecto, y español disponible (ADR 0041)", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "es"]);
  });

  it.each([["es", true], ["en", true], ["fr", false], ["", false], [undefined, false], ["ES", false]])(
    "isLocale(%j) = %j",
    (value, expected) => {
      expect(isLocale(value)).toBe(expected);
    },
  );

  it.each([
    ["es-ES", "es"],
    ["es", "es"],
    ["ES-es", "es"],
    ["en-GB", "en"],
    ["en", "en"],
    ["fr-FR", "en"],
    ["", "en"],
    ["-es", "en"],
    [null, "en"],
    [undefined, "en"],
  ])("el idioma de una organización %j es %j", (tag, expected) => {
    expect(localeFromTag(tag)).toBe(expected);
  });
});
