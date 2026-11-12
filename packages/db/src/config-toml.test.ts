import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Auditoría G-04 y CLAUDE.md («Web: autenticación»): la configuración de Auth de
// packages/db/supabase/config.toml no se debe aflojar sin que un test lo note.
//  - Registro público cerrado: [auth] enable_signup = false.
//  - No tocar [auth.email] enable_signup: en la CLI, false desactiva el proveedor
//    de email entero y con él el login.
//  - Confirmar el email antes de entrar: [auth.email] enable_confirmations = true.
// Lo mismo para la sobreescritura de staging ([remotes.staging.*]), que
// `supabase config push` aplica al proyecto alojado.
const CONFIG = readFileSync(join(import.meta.dirname, "..", "supabase", "config.toml"), "utf8");

/** Valores `clave = valor` por sección ([a.b]) de un TOML plano; solo booleanos y cadenas simples. */
export function parseSections(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let current = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header?.[1] !== undefined) {
      current = header[1].trim();
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const pair = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/.exec(line);
    if (pair?.[1] !== undefined && pair[2] !== undefined) {
      if (!sections.has(current)) sections.set(current, new Map());
      sections.get(current)?.set(pair[1], pair[2].trim());
    }
  }
  return sections;
}

const sections = parseSections(CONFIG);
const get = (section: string, key: string) => sections.get(section)?.get(key);

describe("parseSections", () => {
  it("separa las secciones y no confunde claves con el mismo nombre", () => {
    const parsed = parseSections("[a]\nx = false\n[a.b]\nx = true # nota\n");
    expect(parsed.get("a")?.get("x")).toBe("false");
    expect(parsed.get("a.b")?.get("x")).toBe("true");
  });
});

describe("config.toml · Auth (base)", () => {
  it("el registro público está cerrado", () => {
    expect(get("auth", "enable_signup")).toBe("false");
  });
  it("[auth.email] enable_signup no se desactiva (apagaría el login por email)", () => {
    expect(get("auth.email", "enable_signup")).toBeDefined();
    expect(get("auth.email", "enable_signup")).not.toBe("false");
  });
  it("hay que confirmar el email antes de entrar", () => {
    expect(get("auth.email", "enable_confirmations")).toBe("true");
  });
});

describe("config.toml · Auth (staging)", () => {
  it("existe la sobreescritura de staging", () => {
    expect(sections.has("remotes.staging")).toBe(true);
  });
  it("staging confirma el email antes de entrar", () => {
    expect(get("remotes.staging.auth.email", "enable_confirmations")).toBe("true");
  });
  it("staging no abre el registro ni apaga el email, si lo declara", () => {
    const signup = get("remotes.staging.auth", "enable_signup");
    if (signup !== undefined) expect(signup).toBe("false");
    const emailSignup = get("remotes.staging.auth.email", "enable_signup");
    if (emailSignup !== undefined) expect(emailSignup).not.toBe("false");
  });
});
