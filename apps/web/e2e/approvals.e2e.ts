import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiToken, restRows, signIn } from "./helpers";

// La bandeja de aprobaciones (paso 4d-3d) con las del seed de Demo A: dos en A2
// (las ve y las decide el equipo de A2) y una en A1 (solo quien tiene A1). Las
// pruebas deciden, así que van en orden y necesitan el seed recién aplicado: el
// seed las vuelve a dejar pendientes cada vez. Decidir pasa por RLS y
// guard_approval con la sesión de la persona; ejecutar lo aprobado es del
// worker (probado en su integración), que aquí no está en marcha.
test.describe.configure({ mode: "serial" });

const A2_REPLY = "Responder: «Hola, tenemos hueco el lunes a las 9:00. ¿Te va bien?»";
const A2_BOOKING = "Reservar Primera visita el lunes, 3 de junio de 2030, 9:00";
const A1_REPLY = "Responder: «Buenas tardes, le confirmamos la cita del martes.»";
const A2_REPLY_ID = "5eed0009-0000-4000-8000-0000000000a1";
const A2_BOOKING_ID = "5eed0009-0000-4000-8000-0000000000a2";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("el equipo de un local ve lo que espera en su local, y nada de otro", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await expect(page.getByRole("heading", { level: 1, name: "Aprobaciones" })).toBeVisible();
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_REPLY, A2_BOOKING]);
  await expect(page.getByTestId("approval-location")).toHaveText(["A2 Norte", "A2 Norte"]);
  await expect(page.getByText(A1_REPLY)).toHaveCount(0);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("aprobar la respuesta la decide con la sesión de quien aprueba y la saca de pendientes", async ({ page, request }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  const reply = page.getByTestId("approval").filter({ hasText: A2_REPLY });
  await reply.getByTestId("approval-approve").click();
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_BOOKING]);

  // Lo que quedó en la base de datos, leído con la sesión de esa persona (RLS).
  const token = await apiToken(request, "a_staff");
  const rows = (await restRows(request, token, `approvals?id=eq.${A2_REPLY_ID}&select=status,decided_at,decided_by`)) as {
    status: string;
    decided_at: string | null;
    decided_by: string | null;
  }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: "approved" });
  expect(rows[0]?.decided_at).not.toBeNull();
  expect(rows[0]?.decided_by).not.toBeNull();
});

test("rechazar la reserva la saca de pendientes sin aprobarla", async ({ page, request }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await page.getByTestId("approval").filter({ hasText: A2_BOOKING }).getByTestId("approval-reject").click();
  await expect(page.getByTestId("approvals-empty")).toBeVisible();

  const token = await apiToken(request, "a_staff");
  const rows = (await restRows(request, token, `approvals?id=eq.${A2_BOOKING_ID}&select=status`)) as { status: string }[];
  expect(rows).toEqual([{ status: "rejected" }]);
});

test("quien lleva otro local solo ve lo de su local", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approval-summary")).toHaveText([A1_REPLY]);
  await expect(page.getByTestId("approval-location")).toHaveText(["A1 Norte"]);
});

test("otra organización no ve las aprobaciones de Demo A", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approvals-empty")).toBeVisible();
  await expect(page.getByText(A1_REPLY)).toHaveCount(0);
});
