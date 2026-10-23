import { expect, test } from "@playwright/test";
import { credentialsFor, signIn } from "./helpers";

function supabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Falta apps/web/.env.local: pnpm --filter @repo/web env:local");
  return { url, publishableKey };
}

// ---------------------------------------------------------------------------
// 1. En el navegador no hay service role ni clave secreta, y el navegador no
//    habla con Supabase: todo pasa por el servidor de la app con el JWT.
// ---------------------------------------------------------------------------
test("el navegador solo habla con la app y no recibe claves secretas", async ({ page }) => {
  const appOrigin = "http://127.0.0.1:3000";
  const foreignRequests: string[] = [];
  const leaks: string[] = [];

  page.on("request", (request) => {
    if (!request.url().startsWith(appOrigin)) foreignRequests.push(request.url());
  });
  page.on("response", async (response) => {
    const type = response.request().resourceType();
    if (!["document", "script", "fetch", "xhr"].includes(type)) return;
    const body = await response.text().catch(() => "");
    if (/sb_secret_|service_role/i.test(body)) leaks.push(`${type} ${response.url()}`);
  });

  await signIn(page, "a_org_admin");
  await expect(page.getByTestId("location-name")).toHaveCount(3);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  expect(foreignRequests).toEqual([]);
  expect(leaks).toEqual([]);
});

// ---------------------------------------------------------------------------
// 3. Protección en servidor: sin sesión, cada ruta protegida responde con una
//    redirección HTTP al login (sin JavaScript: no depende del cliente).
// ---------------------------------------------------------------------------
const protectedRoutes = ["/", "/app", "/app/ajustes/general", "/app/ruta-que-no-existe"];

for (const route of protectedRoutes) {
  test(`sin sesión, ${route} redirige al login desde el servidor`, async ({ request }) => {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers()["location"] ?? "", "http://127.0.0.1:3000");
    expect(location.pathname).toBe("/login");
    if (route !== "/") expect(location.searchParams.get("next")).toBe(route);
  });
}

test("sin sesión, el HTML de una ruta protegida no contiene datos", async ({ request }) => {
  const response = await request.get("/app/ajustes/general");
  expect(new URL(response.url()).pathname).toBe("/login");
  expect(await response.text()).not.toMatch(/Demo A|Demo B|A1 Norte|Admin A/);
});

// ---------------------------------------------------------------------------
// 4. Registro público desactivado: la API de Auth rechaza altas por su cuenta.
// ---------------------------------------------------------------------------
test("nadie puede registrarse por su cuenta en Supabase Auth", async ({ request }) => {
  const { url, publishableKey } = supabasePublicEnv();
  const email = `intruso-${Date.now()}@demo.test`;
  const password = "Intruso-1234567890"; // gitleaks:allow — contraseña de prueba de un alta que se rechaza

  const signup = await request.post(`${url}/auth/v1/signup`, {
    headers: { apikey: publishableKey },
    data: { email, password },
  });
  expect(signup.status()).toBe(422);
  expect((await signup.json()).error_code).toBe("signup_disabled");

  const signin = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey },
    data: { email, password },
  });
  expect(signin.ok()).toBe(false);
});

test("la app no ofrece página de registro", async ({ request }) => {
  for (const path of ["/signup", "/registro", "/register"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    // Sin sesión, el proxy manda al login; nunca hay un formulario de alta.
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/^\/login/);
  }
});

// ---------------------------------------------------------------------------
// 6. El login no revela si un email existe.
// ---------------------------------------------------------------------------
test("mismo mensaje para email inexistente y contraseña incorrecta", async ({ page }) => {
  const messages: string[] = [];
  // Un email inexistente distinto en cada ejecución: con uno fijo, sus fallos se
  // acumularían entre ejecuciones y el freno de login (login_throttle) acabaría
  // respondiendo «Demasiados intentos».
  for (const email of [credentialsFor("a_org_admin").email, `no-existe-${Date.now()}@demo.test`]) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    messages.push(await alert.innerText());
  }
  expect(messages).toEqual(["Email o contraseña incorrectos.", "Email o contraseña incorrectos."]);
});
