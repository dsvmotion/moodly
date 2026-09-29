import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

// Credenciales que genera `pnpm db:seed` en cada ejecución (archivo local,
// ignorado por git). Nunca se escriben en el código ni en los logs.
const credentialsFile = resolve(import.meta.dirname, "../../../packages/db/.seed/credentials.local.json");

interface SeedCredential {
  key: string;
  email: string;
  password: string;
}

export function credentialsFor(key: string): SeedCredential {
  const { users } = JSON.parse(readFileSync(credentialsFile, "utf8")) as { users: SeedCredential[] };
  const user = users.find((u) => u.key === key);
  if (!user) throw new Error(`El seed no tiene el usuario ${key}: ejecuta pnpm db:seed`);
  return user;
}

export async function signIn(page: Page, key: string, next?: string): Promise<void> {
  const { email, password } = credentialsFor(key);
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(email);
}

export async function texts(page: Page, testId: string): Promise<string[]> {
  return (await page.getByTestId(testId).allInnerTexts()).map((t) => t.trim()).sort();
}
