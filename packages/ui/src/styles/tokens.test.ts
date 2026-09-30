import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Contraste WCAG 2.1 AA de los tokens de diseño, en claro y en oscuro.
// Texto normal: ≥ 4,5:1 (1.4.3). Bordes de controles y foco: ≥ 3:1 (1.4.11).
const css = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

type Oklch = [l: number, c: number, h: number];

function tokens(): Map<string, { light: Oklch; dark: Oklch }> {
  const result = new Map<string, { light: Oklch; dark: Oklch }>();
  const pattern = /--([a-z-]+):\s*light-dark\(\s*oklch\(([^)]+)\)\s*,\s*oklch\(([^)]+)\)\s*\)/g;
  const parse = (value = ""): Oklch => {
    const [l = 0, c = 0, h = 0] = (value.split("/")[0] ?? "").trim().split(/\s+/).map(Number);
    return [l, c, h];
  };
  for (const [, name = "", light, dark] of css.matchAll(pattern)) {
    result.set(name, { light: parse(light), dark: parse(dark) });
  }
  return result;
}

// OKLCH → sRGB lineal (Björn Ottosson) → luminancia relativa (WCAG).
function luminance([l, c, h]: Oklch): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const r = clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
  const g = clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
  const bl = clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(x: Oklch, y: Oklch): number {
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function token(all: Map<string, { light: Oklch; dark: Oklch }>, name: string, mode: "light" | "dark"): Oklch {
  const value = all.get(name);
  if (!value) throw new Error(`Falta el token --${name} con light-dark()`);
  return value[mode];
}

const TEXT_PAIRS: Array<[text: string, background: string]> = [
  ["foreground", "background"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["foreground", "muted"],
  ["surface-foreground", "surface"],
  ["muted-foreground", "surface"],
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-muted-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-muted-foreground", "sidebar-accent"],
];

const UI_PAIRS: Array<[component: string, background: string]> = [
  ["input", "background"],
  ["ring", "background"],
  ["ring", "sidebar"],
];

describe("tokens de diseño", () => {
  const all = tokens();

  it("define los tokens con light-dark()", () => {
    expect(all.size).toBeGreaterThanOrEqual(20);
  });

  describe.each(["light", "dark"] as const)("modo %s", (mode) => {
    it.each(TEXT_PAIRS)("texto %s sobre %s ≥ 4,5:1", (text, background) => {
      const ratio = contrast(token(all, text, mode), token(all, background, mode));
      expect(ratio, `${text}/${background} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it.each(UI_PAIRS)("control %s sobre %s ≥ 3:1", (component, background) => {
      const ratio = contrast(token(all, component, mode), token(all, background, mode));
      expect(ratio, `${component}/${background} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });
  });
});
