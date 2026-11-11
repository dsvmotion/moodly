import { expect, test } from "@playwright/test";
import { credentialsFor, signIn, withMfaLock } from "./helpers";

// Quién puede tomar el control y escribir en una conversación, y por qué
// canales (auditoría de preproducción, M-01). Solo lectura: no toma ni devuelve
// ninguna conversación, para no cambiar lo que comprueban en paralelo las demás
// pruebas de la bandeja. Que la base de datos lo impide de verdad lo prueban los
// pgTAP de 37_inbox_takeover; aquí, que la pantalla no lo ofrece.

// Ids fijos del seed (packages/db/src/seed/data.ts).
const A2_HUMAN_WEBCHAT = "5eed000b-0000-4000-8000-0000000000b2"; // Demo A, A2, chat web, la lleva el equipo
const F2_HUMAN_WHATSAPP = "5eed00f1-0000-4000-8000-000000000000"; // Demo F, F2, WhatsApp, la lleva el equipo

test("por un canal que aún no entrega lo que escribe el equipo, no hay cuadro de respuesta", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto(`/app/inbox/${F2_HUMAN_WHATSAPP}`);
  await expect(page.getByTestId("inbox-thread-contact")).toHaveText("Contacto de F2");
  await expect(page.getByTestId("inbox-composer-unavailable")).toBeVisible();
  await expect(page.getByTestId("inbox-composer")).toHaveCount(0);
  // Se puede devolver al agente: el bloqueo es solo para escribir.
  await expect(page.getByTestId("inbox-give-back")).toBeVisible();
});

test("el equipo del local de la conversación la lleva y escribe; el de otro local ni la ve", async ({ browser }) => {
  const own = await browser.newPage();
  await signIn(own, "a_staff");
  await own.goto(`/app/inbox/${A2_HUMAN_WEBCHAT}`);
  await expect(own.getByTestId("inbox-composer")).toBeVisible();
  await expect(own.getByTestId("inbox-give-back")).toBeVisible();
  await own.close();

  const other = await browser.newPage();
  await signIn(other, "a_location_manager");
  const response = await other.goto(`/app/inbox/${A2_HUMAN_WEBCHAT}`);
  expect(response?.status()).toBe(404);
  await expect(other.getByTestId("inbox-thread")).toHaveCount(0);
  await expect(other.getByTestId("inbox-give-back")).toHaveCount(0);
  await other.close();
});

test("un org_admin que solo ha puesto la contraseña no llega a la conversación: antes, el segundo factor", async ({ page }) => {
  const { email, password } = credentialsFor("a_org_admin");
  const target = `/app/inbox/${A2_HUMAN_WEBCHAT}`;
  // Sin completar el código: la sesión se queda en aal1. Con el candado, para que
  // otra prueba del mismo usuario no la cierre a medias al verificar su factor.
  await withMfaLock("a_org_admin", async () => {
    await page.goto(`/login?next=${encodeURIComponent(target)}`);
    const form = page.locator('form:has(input[name="password"])');
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="password"]').fill(password);
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login\/mfa/);

    await page.goto(target);
    await expect(page).toHaveURL(/\/login\/mfa/);
    await expect(page.getByTestId("inbox-thread")).toHaveCount(0);
    await expect(page.getByTestId("inbox-composer")).toHaveCount(0);
  });
});
