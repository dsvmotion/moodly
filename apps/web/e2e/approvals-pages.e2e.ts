import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Las aprobaciones con más pendientes de las que caben en la lista (auditoría
// de preproducción, M-07), con la organización de volumen del seed (Demo F):
// 205 pendientes en F1 y una en F2, la más reciente. El local elegido se filtra
// en la consulta: la de F2 sale aunque las 200 más antiguas sean de F1. Y si
// hay más de las que se muestran, la pantalla lo dice.

const LIST_LIMIT = 200;
const PENDING_F2 = "Responder: «Mensaje pendiente en F2»";
// Id fijo del seed (packages/db/src/seed/data.ts).
const LOC_F2 = "5eed0002-0000-4000-8000-0000000000f2";

test("con un local elegido salen sus aprobaciones, aunque otras doscientas de la organización sean más antiguas", async ({
  page,
}) => {
  await signIn(page, "f_org_admin");
  await page.goto(`/app/approvals?scope=${encodeURIComponent(`location:${LOC_F2}`)}`);
  await expect(page.getByTestId("approval-summary")).toHaveText([PENDING_F2]);
  await expect(page.getByTestId("approvals-truncated")).toHaveCount(0);
});

test("con más pendientes de las que caben, la lista enseña las más antiguas y avisa de que hay más", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approval")).toHaveCount(LIST_LIMIT);
  await expect(page.getByTestId("approvals-truncated")).toBeVisible();
  await expect(page.getByTestId("approval-summary").filter({ hasText: PENDING_F2 })).toHaveCount(0);
});
