import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";

// Todos los idiomas tienen exactamente las mismas claves (auditoría R-32): una
// clave que falta en uno se vería como el identificador en la interfaz.
type Messages = { [key: string]: string | Messages };

function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );
}

const load = (locale: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, `../../messages/${locale}.json`), "utf8")) as Messages;

describe("textos de la interfaz", () => {
  const [base, ...others] = LOCALES;

  it.each(others)(`${base} y %s tienen las mismas claves`, (locale) => {
    expect(keys(load(locale)).sort()).toEqual(keys(load(base)).sort());
  });

  it.each(LOCALES)("%s no tiene textos vacíos", (locale) => {
    const empty = keys(load(locale)).filter((key) => {
      const value = key.split(".").reduce<string | Messages>((node, part) => (node as Messages)[part] as string | Messages, load(locale));
      return typeof value === "string" && value.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});
