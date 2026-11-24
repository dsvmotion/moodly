import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { localDate } from "../src/lib/calendar";
import { apiToken, restRows, signIn } from "./helpers";

// La agenda (OA03): quién ve qué citas, leídas con su sesión (RLS), y cada una
// en el día y la hora de su sede. Las citas son las del seed
// (packages/db/src/seed/data.ts, seedAppointments): en Demo A, una o dos por sede
// (A1 y A2 en la región «A Norte»; A3 sin región); en Demo F, una en F1 (Madrid)
// y otra en F2 (Canarias), las dos a las 10:00 de su sede.

const A1_AGENT = "5eed0012-0000-4000-8000-000000000001";
const A2_SYNC = "5eed0012-0000-4000-8000-000000000003";
const A2_CANCELLED = "5eed0012-0000-4000-8000-000000000004";
const A3_AGENT = "5eed0012-0000-4000-8000-000000000005";
const F1_MADRID = "5eed0012-0000-4000-8000-000000000006";
const F2_CANARY = "5eed0012-0000-4000-8000-000000000007";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";

/** Cuándo empieza una cita, leído como el org_admin de su organización. */
async function startsAt(request: APIRequestContext, admin: string, id: string): Promise<string> {
  const token = await apiToken(request, admin);
  const [row] = (await restRows(request, token, `appointments?id=eq.${id}&select=starts_at`)) as { starts_at: string }[];
  if (!row) throw new Error(`La cita ${id} no está: ejecuta pnpm db:seed`);
  return row.starts_at;
}

async function shownIds(page: Page): Promise<string[]> {
  await expect(page.getByTestId("calendar-range")).toBeVisible();
  return page.getByTestId("appointment").evaluateAll((items) => items.map((item) => item.getAttribute("data-appointment") ?? ""));
}

test.describe("quién ve qué en la agenda de Demo A", () => {
  // El dispositivo en la zona de las sedes de Demo A (todas en Madrid): la hora sale sin la zona al lado.
  test.use({ timezoneId: "Europe/Madrid" });
  let day = "";
  test.beforeAll(async ({ request }) => {
    day = localDate(await startsAt(request, "a_org_admin", A1_AGENT), "Europe/Madrid");
  });

  const cases: { user: string; sees: string[]; doesNot: string[] }[] = [
    { user: "a_org_admin", sees: [A1_AGENT, A2_SYNC, A2_CANCELLED, A3_AGENT], doesNot: [] },
    { user: "a_region_manager", sees: [A1_AGENT, A2_SYNC, A2_CANCELLED], doesNot: [A3_AGENT] },
    { user: "a_location_manager", sees: [A1_AGENT], doesNot: [A2_SYNC, A2_CANCELLED, A3_AGENT] },
    { user: "a_staff", sees: [A2_SYNC, A2_CANCELLED], doesNot: [A1_AGENT, A3_AGENT] },
  ];
  for (const { user, sees, doesNot } of cases) {
    test(`${user} ve solo las citas de sus sedes`, async ({ page }) => {
      await signIn(page, user);
      await page.goto(`/app/calendar?view=day&date=${day}`);
      const ids = await shownIds(page);
      for (const id of sees) expect(ids).toContain(id);
      for (const id of doesNot) expect(ids).not.toContain(id);
    });
  }

  test("otra organización no ve ninguna", async ({ page }) => {
    await signIn(page, "b_org_admin");
    await page.goto(`/app/calendar?view=day&date=${day}`);
    await expect(page.getByTestId("calendar-empty")).toBeVisible();
    await expect(page.getByTestId("appointment")).toHaveCount(0);
  });

  test("cada cita dice servicio, profesional, cliente, estado y origen", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto(`/app/calendar?view=day&date=${day}`);
    const agent = page.locator(`[data-appointment="${A1_AGENT}"]`);
    await expect(agent.getByTestId("appointment-contact")).toHaveText("Lucía Martín");
    await expect(agent.getByTestId("appointment-service")).toHaveText("Color (agenda)");
    await expect(agent.getByTestId("appointment-resource")).toHaveText("con Laura · A1");
    await expect(agent.getByTestId("appointment-status")).toHaveText("Reservada");
    await expect(agent.getByTestId("appointment-origin")).toHaveText("La reservó un agente");
    await expect(agent.getByTestId("appointment-time")).toHaveText("10:00–11:00");
    await expect(page.locator(`[data-appointment="${A2_SYNC}"]`).getByTestId("appointment-origin")).toHaveText("Sincronizada");
    await expect(page.locator(`[data-appointment="${A2_CANCELLED}"]`).getByTestId("appointment-status")).toHaveText("Cancelada");
    // Con más de una sede en el alcance, las citas van agrupadas por sede.
    await expect(page.getByTestId("calendar-location")).toHaveCount(3);
  });

  test("el equipo ve la cita aunque RLS no le deje ver al contacto", async ({ page }) => {
    // «Empresa Sol» es un contacto de toda la organización, sin conversación en A2:
    // contacts_select no se lo deja ver al staff de A2, pero la cita sí.
    await signIn(page, "a_staff");
    await page.goto(`/app/calendar?view=day&date=${day}`);
    await expect(page.locator(`[data-appointment="${A2_CANCELLED}"]`).getByTestId("appointment-contact")).toHaveText("Cliente");
    await expect(page.locator(`[data-appointment="${A2_SYNC}"]`).getByTestId("appointment-contact")).toHaveText("Jorge Pérez");
  });

  test("el selector de alcance filtra la agenda", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto(`/app/calendar?view=day&date=${day}&scope=location:${LOC_A1}`);
    expect(await shownIds(page)).toEqual([A1_AGENT]);
    await expect(page.getByTestId("calendar-location")).toHaveCount(0);
  });

  test("la vista de semana y moverse de semana en semana", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto(`/app/calendar?view=day&date=${day}`);
    await page.getByTestId("calendar-view-week").click();
    await expect(page).toHaveURL(new RegExp(`view=week.*date=${day}|date=${day}.*view=week`));
    await expect(page.locator(`[data-testid="calendar-day"][data-date="${day}"]`)).toBeVisible();
    expect(await shownIds(page)).toEqual(expect.arrayContaining([A1_AGENT, A2_SYNC, A2_CANCELLED, A3_AGENT]));

    await page.getByTestId("calendar-next").click();
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    await expect(page).toHaveURL(new RegExp(`date=${next.toISOString().slice(0, 10)}`));
    await expect(page.getByTestId("calendar-range")).toBeVisible();
    await expect(page.locator(`[data-appointment="${A1_AGENT}"]`)).toHaveCount(0);
  });
});

test.describe("la hora de cada sede en Demo F (Madrid y Canarias)", () => {
  test.use({ timezoneId: "Atlantic/Canary" });

  for (const { id, zone } of [
    { id: F1_MADRID, zone: "Europe/Madrid" },
    { id: F2_CANARY, zone: "Atlantic/Canary" },
  ]) {
    test(`la cita de ${zone} sale a las 10:00 de su sede, con la zona al lado`, async ({ page, request }) => {
      const iso = await startsAt(request, "f_org_admin", id);
      await signIn(page, "f_org_admin");
      await page.goto(`/app/calendar?view=day&date=${localDate(iso, zone)}`);
      const time = page.locator(`[data-appointment="${id}"]`).getByTestId("appointment-time");
      await expect(time).toHaveAttribute("title", zone);
      await expect(time).toHaveAttribute("datetime", iso);
      // Dos zonas en la organización: cada hora lleva la suya («10:00–10:30 CET» o «… GMT»).
      await expect(time).toHaveText(/^10:00–10:30 \S+$/);
    });
  }
});
