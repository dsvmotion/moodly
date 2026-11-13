import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
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

export function supabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Falta apps/web/.env.local: pnpm --filter @repo/web env:local");
  return { url, publishableKey };
}

export async function signIn(page: Page, key: string, next?: string): Promise<void> {
  const { email, password, totpSecret } = credentialsFor(key);
  // Cargar la página y rellenar el formulario va antes del bloqueo de MFA: no
  // crea ninguna sesión, así que no hace falta esperar turno para eso.
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  // Por nombre de campo y no por etiqueta: el login está traducido y algunos
  // tests entran con la interfaz en inglés (las etiquetas las prueba auth.e2e.ts).
  const form = page.locator('form:has(input[name="password"])');
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  // Lo que sí va dentro del bloqueo es desde enviar la contraseña (que crea la
  // sesión aal1) hasta tener la sesión aal2: es la ventana en la que verificar
  // el factor de otro test del mismo usuario cerraría esta sesión (withMfaLock).
  const submit = async () => {
    await form.locator('button[type="submit"]').click();
    if (totpSecret) await completeMfa(page, totpSecret);
    await expect(page.getByTestId("current-user")).toHaveText(email);
  };
  await (totpSecret ? withMfaLock(key, submit) : submit());
}

/** Abre el menú de usuario del pie de la barra lateral (auditoría del frontend, F-4). */
export async function openUserMenu(page: Page): Promise<void> {
  await page.getByTestId("user-menu").click();
  await expect(page.getByTestId("user-menu-content")).toBeVisible();
}

/** Cierra la sesión desde el menú de usuario, como en la app (en el idioma que tenga la interfaz). */
export async function signOutFromMenu(page: Page): Promise<void> {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: /^(Cerrar sesión|Sign out)$/ }).click();
}

/** Token de solo contraseña (sesión aal1) de la API de Supabase Auth, y el factor TOTP verificado si lo hay. */
export async function passwordToken(
  request: APIRequestContext,
  key: string,
): Promise<{ token: string; factorId: string | null }> {
  const { url, publishableKey } = supabasePublicEnv();
  const { email, password } = credentialsFor(key);
  const response = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const session = (await response.json()) as { access_token: string; user: { factors?: { id: string; status: string }[] } };
  const factor = session.user.factors?.find((f) => f.status === "verified");
  return { token: session.access_token, factorId: factor?.id ?? null };
}

/** Verifica el código TOTP sobre una sesión aal1 y devuelve el token aal2. */
export async function verifyTotpApi(request: APIRequestContext, key: string, token: string, factorId: string): Promise<string> {
  const { url, publishableKey } = supabasePublicEnv();
  const { totpSecret } = credentialsFor(key);
  if (!totpSecret) throw new Error(`El seed no ha dado de alta el TOTP de ${key}: ejecuta pnpm db:seed`);
  const auth = { apikey: publishableKey, Authorization: `Bearer ${token}` };
  const challenge = await request.post(`${url}/auth/v1/factors/${factorId}/challenge`, { headers: auth });
  expect(challenge.status()).toBe(200);
  const verify = await request.post(`${url}/auth/v1/factors/${factorId}/verify`, {
    headers: auth,
    data: { challenge_id: ((await challenge.json()) as { id: string }).id, code: totp(totpSecret) },
  });
  expect(verify.status()).toBe(200);
  return ((await verify.json()) as { access_token: string }).access_token;
}

/**
 * Token de la API como lo obtiene la app: contraseña y, si la persona tiene el
 * segundo factor, también el código (sesión aal2). Con MFA, la contraseña sola
 * no lee datos (migración mfa_reads) ni administra (admin_mfa).
 */
export async function apiToken(request: APIRequestContext, key: string): Promise<string> {
  if (!credentialsFor(key).totpSecret) return (await passwordToken(request, key)).token;
  return withMfaLock(key, async () => {
    const { token, factorId } = await passwordToken(request, key);
    if (!factorId) throw new Error(`${key} no tiene un factor verificado`);
    return verifyTotpApi(request, key, token, factorId);
  });
}

/** Filas que devuelve la API REST de Supabase con ese token (RLS decide). */
export async function restRows(request: APIRequestContext, token: string, path: string): Promise<unknown[]> {
  const { url, publishableKey } = supabasePublicEnv();
  const response = await request.get(`${url}/rest/v1/${path}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as unknown[];
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
  await expect(page.getByRole("heading", { level: 1, name: /^(Verificación en dos pasos|Two-step verification)$/ })).toBeVisible();
  // La página tiene otro formulario («Salir»): se usa el del código.
  const form = page.locator('form:has(input[name="code"])');
  await form.locator('input[name="code"]').fill(totp(secret));
  await form.locator('button[type="submit"]').click();
}

export async function texts(page: Page, testId: string): Promise<string[]> {
  return (await page.getByTestId(testId).allInnerTexts()).map((t) => t.trim()).sort();
}

/**
 * Insignias de la barra lateral fuera de Aprobaciones y Bandeja, las dos
 * entradas con contador de pendientes (M-02). Las pruebas esperan cero: en el
 * resto de secciones no hay contadores inventados.
 */
export const OTHER_THAN_COUNTED_BADGES =
  'li:not(:has([data-testid="nav-approvals"])):not(:has([data-testid="nav-inbox"])) [data-slot="badge"]';
