import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { totp } from "../../../packages/db/src/seed/totp";
import { credentialsFor, signIn, withMfaLock } from "./helpers";

// Invitaciones con consentimiento (migración invitations). Usa solo Demo C y la
// identidad sin organización del seed, para no cambiar lo que ven los demás
// tests, que corren en paralelo contra A y B.
const ORG_C = "5eed0000-0000-4000-8000-00000000000c";
const GUEST_EMAIL = credentialsFor("guest_no_org").email;

test.describe.configure({ mode: "serial" });

function supabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Falta apps/web/.env.local: pnpm --filter @repo/web env:local");
  return { url, publishableKey };
}

// Token aal2 del org_admin de Demo C: contraseña y después el código TOTP, como
// en la app (sus cambios exigen MFA: migración admin_mfa).
async function orgCAdminToken(request: APIRequestContext): Promise<string> {
  const { url, publishableKey } = supabasePublicEnv();
  const { email, password, totpSecret } = credentialsFor("c_org_admin");
  if (!totpSecret) throw new Error("El seed no ha dado de alta el TOTP de c_org_admin: ejecuta pnpm db:seed");
  return withMfaLock("c_org_admin", async () => {
    const login = await request.post(`${url}/auth/v1/token?grant_type=password`, {
      headers: { apikey: publishableKey },
      data: { email, password },
    });
    expect(login.status()).toBe(200);
    const session = (await login.json()) as { access_token: string; user: { factors?: { id: string; status: string }[] } };
    const factor = session.user.factors?.find((f) => f.status === "verified");
    if (!factor) throw new Error("c_org_admin no tiene un factor verificado");
    const auth = { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` };
    const challenge = await request.post(`${url}/auth/v1/factors/${factor.id}/challenge`, { headers: auth });
    expect(challenge.status()).toBe(200);
    const verify = await request.post(`${url}/auth/v1/factors/${factor.id}/verify`, {
      headers: auth,
      data: { challenge_id: ((await challenge.json()) as { id: string }).id, code: totp(totpSecret) },
    });
    expect(verify.status()).toBe(200);
    return ((await verify.json()) as { access_token: string }).access_token;
  });
}

// Deja Demo C como la crea el seed: solo su org_admin y sin invitaciones
// pendientes. Lo hace el propio org_admin con su JWT (RLS), como desde la app.
async function resetOrgC(request: APIRequestContext): Promise<void> {
  const { url, publishableKey } = supabasePublicEnv();
  const token = await orgCAdminToken(request);
  const removed = await request.delete(`${url}/rest/v1/memberships?organization_id=eq.${ORG_C}&role=neq.org_admin`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  expect(removed.status()).toBe(204);
  const revoked = await request.patch(
    `${url}/rest/v1/invitations?organization_id=eq.${ORG_C}&accepted_at=is.null&revoked_at=is.null`,
    { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, data: { revoked_at: new Date().toISOString() } },
  );
  expect(revoked.status()).toBe(204);
}

async function newSignedInPage(browser: Browser, key: string, next?: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, key, next);
  return page;
}

async function invite(page: Page, location: string): Promise<string> {
  await page.goto("/app/settings/organization");
  await page.getByLabel("Email").fill(GUEST_EMAIL);
  await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption({ label: "Personal" });
  await page.getByRole("combobox", { name: "Alcance", exact: true }).selectOption({ label: location });
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const link = (await page.getByTestId("invitation-url").innerText()).trim();
  expect(link).toMatch(/\/app\/invitation\?token=[A-Za-z0-9_-]{40,}$/);
  return new URL(link).pathname + new URL(link).search;
}

test.beforeEach(async ({ request }) => resetOrgC(request));
test.afterAll(async ({ request }) => resetOrgC(request));

test("solo la persona invitada entra, y solo cuando acepta", async ({ browser }) => {
  const admin = await newSignedInPage(browser, "c_org_admin");
  const path = await invite(admin, "C1");
  await expect(admin.getByTestId("pending-invitation-email")).toContainText([GUEST_EMAIL]);

  // Otra cuenta con el enlace: no entra (el error es el mismo que con un token inventado).
  const other = await newSignedInPage(browser, "b_org_admin", path);
  await other.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(other.locator('form p[role="alert"]')).toContainText("no es válida");
  await other.goto("/app");
  await expect(other.getByTestId("org-name")).toHaveText("Demo B");

  // La persona invitada abre el enlace sin sesión: login y vuelta al enlace.
  // Abrirlo no acepta nada; hace falta el botón.
  const guest = await newSignedInPage(browser, "guest_no_org", path);
  await expect(guest).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
  await expect(guest.getByTestId("org-name")).toHaveText("");
  await guest.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(guest).toHaveURL(/\/app\/settings\/organization$/);
  await expect(guest.getByTestId("org-name")).toHaveText("Demo C");
  await guest.goto("/app/settings/organization");
  await expect(guest.getByTestId("location-name")).toHaveText(["C1"]);

  // Ya usada: ni la propia persona puede repetirla.
  await guest.goto(path);
  await guest.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(guest.locator('form p[role="alert"]')).toBeVisible();

  // Y deja de estar pendiente para el org_admin.
  await admin.reload();
  await expect(admin.getByTestId("pending-invitation-email")).toHaveCount(0);
});

test("una invitación revocada ya no sirve", async ({ browser }) => {
  const admin = await newSignedInPage(browser, "c_org_admin");
  const path = await invite(admin, "C1");
  await admin.getByRole("button", { name: "Revocar" }).click();
  await expect(admin.getByTestId("pending-invitation-email")).toHaveCount(0);

  const guest = await newSignedInPage(browser, "guest_no_org", path);
  await guest.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(guest.locator('form p[role="alert"]')).toContainText("no es válida");
  await guest.goto("/app");
  await expect(guest.getByTestId("org-name")).toHaveText("");
});

test("quien no es org_admin no ve el formulario de invitar", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/settings/organization");
  await expect(page.getByRole("heading", { name: "Mi organización" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear invitación" })).toHaveCount(0);
});
