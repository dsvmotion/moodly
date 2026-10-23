import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// La web pinta los agentes del catálogo (ADR 0030 §1), no una lista fija: los
// de serie y también uno propio (el del seed en Demo C), y ninguno sin
// organización.

test("un agente propio sale en la barra lateral, en Agentes, en Inicio y tiene su ventana", async ({ page }) => {
  await signIn(page, "c_org_admin");
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  const agents = sidebar.getByTestId("nav-agents");
  // Los 4 de serie y el propio, en ese orden.
  await expect(agents.getByRole("link")).toHaveText(["Recepción", "Atención al cliente", "Comercial", "Administración", "Eventos"]);
  await expect(page.getByTestId("home-agents").getByRole("link")).toHaveCount(5);

  await agents.getByRole("link", { name: "Eventos", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/agentes\/events$/);
  await expect(page.getByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();
  await expect(page.getByTestId("agent-description")).toHaveText("Prepara presupuestos de eventos y reserva salas.");
  await expect(page.getByTestId("agent-status")).toHaveText("Sin configurar");
  await expect(page.getByTestId("breadcrumbs")).toHaveText("Agentes/Eventos");

  await page.goto("/app/agentes");
  await expect(page.getByTestId("agent-cards").getByRole("link")).toHaveCount(5);
  await expect(page.getByTestId("agent-card-events")).toContainText("Eventos");
});

test("el agente propio de una organización no existe para otra", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await expect(page.getByTestId("nav-agents").getByRole("link")).toHaveCount(4);
  const response = await page.goto("/app/agentes/events");
  expect(response?.status()).toBe(404);
});

test("sin organización no hay agentes, y lo dice", async ({ page }) => {
  await signIn(page, "guest_alone");
  const agents = page.getByTestId("nav-agents");
  await expect(agents.getByRole("link")).toHaveCount(0);
  await expect(agents).toContainText("Sin agentes hasta que entres en una organización.");
  await expect(page.getByTestId("home-agents-empty")).toBeVisible();

  await page.goto("/app/agentes");
  await expect(page.getByTestId("agents-empty")).toBeVisible();
  const response = await page.goto("/app/agentes/reception");
  expect(response?.status()).toBe(404);
});
