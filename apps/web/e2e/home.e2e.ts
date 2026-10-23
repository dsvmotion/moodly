import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Inicio (P1, MANUAL §9.4; auditoría del frontend, F-2): el destino tras el
// login, solo con datos reales.
test("tras entrar se llega a Inicio, con saludo, organización, rol y la entrada activa", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("home-greeting")).toHaveText("Hola, Admin A");
  await expect(page.getByTestId("home-context")).toHaveText("Demo A · Administración");
  await expect(page.getByTestId("breadcrumbs")).toHaveText("Inicio");
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(sidebar.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute("aria-current", "page");

  // Con el segundo factor activado no hay nada pendiente de seguridad.
  await expect(page.getByTestId("home-task-mfa")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("home-task-mfa")).toContainText("Verificación en dos pasos activada");
  // Sus agentes, sin datos inventados, y la bandeja vacía que explica cuándo llega.
  await expect(page.getByTestId("home-agents").getByRole("link")).toHaveCount(4);
  await expect(page.getByTestId("home-agents")).toContainText("Sin configurar");
  await expect(page.getByTestId("home-locations")).toHaveText("3 sedes en tu alcance");
  await expect(page.getByTestId("home-inbox-empty")).toContainText("cuando los agentes empiecen a trabajar");
});

test("sin segundo factor, Inicio lo pide y lleva a Seguridad y acceso", async ({ page }) => {
  await signIn(page, "a_staff");
  const mfa = page.getByTestId("home-task-mfa");
  await expect(mfa).toHaveAttribute("data-done", "false");
  await expect(mfa).toContainText("Activa la verificación en dos pasos");
  // Quien no administra no ve el aviso de que la necesita para hacer cambios.
  await expect(mfa).not.toContainText("Administras una organización");
  await mfa.getByRole("link", { name: "Activarla" }).click();
  await expect(page).toHaveURL(/\/app\/ajustes\/seguridad$/);
});

test("el alcance acota lo que cuenta Inicio", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await expect(page.getByTestId("home-locations")).toHaveText("1 sede en tu alcance");
  await expect(page.getByTestId("home-task-invitations")).toHaveCount(0);
});
