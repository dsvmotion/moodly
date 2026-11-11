// El nivel de un PR sale de sus rutas con una regla fija, nunca del modelo
// (órdenes de M0 §5).

import { NON_NORMATIVE_DOCS, NORMATIVE_DOCS, type Level } from "./config.ts";

/** Los patrones de scripts/merge-guard/sensitive-paths.txt: `<regex ERE><TAB><motivo>`, con comentarios `#`. */
export function parseSensitivePatterns(text: string): RegExp[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => new RegExp(line.split("\t")[0] ?? ""));
}

export interface Classification {
  level: Level;
  /** Por qué: las rutas que deciden el nivel. */
  reasons: string[];
}

export function classify(files: readonly string[], sensitive: readonly RegExp[]): Classification {
  if (files.length === 0) return { level: 2, reasons: ["sin archivos: no se puede clasificar"] };
  const level2 = files.filter((file) => sensitive.some((re) => re.test(file)) || NORMATIVE_DOCS.some((re) => re.test(file)));
  if (level2.length > 0) return { level: 2, reasons: level2 };
  const code = files.filter((file) => !NON_NORMATIVE_DOCS.some((re) => re.test(file)));
  if (code.length > 0) return { level: 1, reasons: code };
  return { level: 0, reasons: ["solo documentación no normativa"] };
}
