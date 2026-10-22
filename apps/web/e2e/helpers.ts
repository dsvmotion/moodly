import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { totp } from "../../../packages/db/src/seed/totp";

// Credenciales que genera `pnpm db:seed` en cada ejecución (archivo local,
// ignorado por git). Nunca se escriben en el código ni en los logs.
const credentialsFile = resolve(import.meta.dirname, "../../../packages/db/.seed/credentials.local.json");

interface SeedCredential {
  key: string;
  email: string;
  password: string;
  /** Solo los org_admin: secreto del segundo factor (TOTP) que da de alta el seed. */
  totpSecret?: string;
}

export function credentialsFor(key: string): SeedCredential {
  const { users } = JSON.parse(readFileSync(credentialsFile, "utf8")) as { users: SeedCredential[] };
  const user = users.find((u) => u.key === key);
  if (!user) throw new Error(`El seed no tiene el usuario ${key}: ejecuta pnpm db:seed`);
  return user;
}

export async function signIn(page: Page, key: string, next?: string): Promise<void> {
  const { email, password, totpSecret } = credentialsFor(key);
  const login = async () => {
    await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    if (totpSecret) await completeMfa(page, totpSecret);
    await expect(page.getByTestId("current-user")).toHaveText(email);
  };
  await (totpSecret ? withMfaLock(key, login) : login());
}

/**
 * Supabase Auth cierra las sesiones aal1 (solo contraseña) de una persona cuando
 * esa persona verifica el segundo factor en otra sesión. Los tests van en
 * paralelo y comparten los usuarios del seed: el tramo «contraseña → código» de
 * un mismo usuario se hace de uno en uno, para que ningún test pierda su sesión
 * a medias. Las sesiones aal2 ya abiertas no se ven afectadas.
 */
export async function withMfaLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lock = resolve(tmpdir(), `e2e-mfa-lock-${key}`);
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      // Un bloqueo de más de 30 s es de un test que murió sin liberarlo.
      try {
        if (Date.now() - statSync(lock).mtimeMs > 30_000) rmSync(lock, { recursive: true, force: true });
      } catch {
        // Lo acaba de liberar otro test: se vuelve a intentar.
      }
      if (Date.now() > deadline) throw new Error(`El bloqueo de MFA de ${key} no se libera`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** Paso del segundo factor tras la contraseña (migración admin_mfa). */
export async function completeMfa(page: Page, secret: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
  await page.getByLabel("Código de verificación").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar" }).click();
}

export async function texts(page: Page, testId: string): Promise<string[]> {
  return (await page.getByTestId(testId).allInnerTexts()).map((t) => t.trim()).sort();
}
