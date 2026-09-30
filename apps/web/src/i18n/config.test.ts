import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "./config";

describe("i18n config", () => {
  it("español por defecto, e inglés disponible", () => {
    expect(DEFAULT_LOCALE).toBe("es");
    expect(LOCALES).toEqual(["es", "en"]);
  });

  it.each([["es", true], ["en", true], ["fr", false], ["", false], [undefined, false], ["ES", false]])(
    "isLocale(%j) = %j",
    (value, expected) => {
      expect(isLocale(value)).toBe(expected);
    },
  );
});
