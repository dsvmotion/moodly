import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Lo que espera a una persona (auditoría de preproducción, M-02; OA10 y OA11):
// contadores en la barra lateral y la lista «Pendiente para ti» en Inicio y en
// Aprobaciones. Con Demo F del seed (SEED_VOLUME), que ninguna otra prueba
// cambia: 205 aprobaciones pendientes en F1 y 1 en F2, y una conversación que
// lleva el equipo, en F2. Demo B no tiene nada pendiente.

// Id fijo del seed (packages/db/src/seed/data.ts).
const LOC_F2 = "5eed0002-0000-4000-8000-0000000000f2";
const F2_SCOPE = `location:${LOC_F2}`;

test("la barra lateral cuenta lo pendiente de todo lo que ve la persona", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await expect(page.getByTestId("nav-approvals")).toContainText("99+");
  // El contador es la descripción del enlace; su nombre sigue siendo el de la sección.
  await expect(page.getByTestId("nav-approvals")).toHaveAccessibleName("Aprobaciones");
  await expect(page.getByTestId("nav-approvals")).toHaveAccessibleDescription("206 aprobaciones pendientes");
  await expect(page.getByTestId("nav-inbox")).toContainText("1");
  await expect(page.getByTestId("nav-inbox")).toHaveAccessibleDescription("1 conversación la lleva el equipo");
});

test("Inicio dice qué te espera en el alcance elegido y lleva a donde se resuelve", async ({ page }) => {
  await signIn(page, "f_org_admin");

  await page.goto("/app");
  await expect(page.getByTestId("home-task-approvals")).toContainText("206 aprobaciones esperan tu decisión");
  await expect(page.getByTestId("home-task-humanConversations")).toContainText("1 conversación la lleva el equipo");

  await page.goto(`/app?scope=${encodeURIComponent(F2_SCOPE)}`);
  await expect(page.getByTestId("home-task-approvals")).toContainText("1 aprobación espera tu decisión");
  await page.getByTestId("home-task-humanConversations").getByRole("link").click();
  await expect(page).toHaveURL(/\/app\/inbox\?status=human&scope=location%3A5eed0002/);
  await expect(page.getByTestId("inbox-contact")).toHaveText(["Contacto de F2"]);

  await page.goto(`/app?scope=${encodeURIComponent(F2_SCOPE)}`);
  await page.getByTestId("home-task-approvals").getByRole("link").click();
  await expect(page).toHaveURL(/\/app\/approvals\?scope=location%3A5eed0002/);
  await expect(page.getByTestId("approvals-count")).toHaveText("1 pendiente");
});

test("Aprobaciones dice cuántas hay de verdad, aunque la lista enseñe las 200 más antiguas", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approvals-count")).toHaveText("206 pendientes");
  await expect(page.getByTestId("approval")).toHaveCount(200);
});

test("sin nada pendiente, ni contadores ni entradas", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await expect(page.getByTestId("nav-approvals").locator("[data-slot=badge]")).toHaveCount(0);
  await expect(page.getByTestId("nav-inbox").locator("[data-slot=badge]")).toHaveCount(0);
  await expect(page.getByTestId("home-task-approvals")).toHaveCount(0);
  await expect(page.getByTestId("home-task-humanConversations")).toHaveCount(0);
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approvals-count")).toHaveCount(0);
});
