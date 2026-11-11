import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken, restRows, signIn, supabasePublicEnv } from "./helpers";

// La pantalla de objetivos (unidad OA19, MANUAL §6.3) en Demo A, por rol. Quién
// gestiona qué lo dicen las políticas de goals: el org_admin (con el segundo
// factor) en cualquier alcance, el region_manager en A Norte y sus locales, el
// location_manager en A1 y el staff solo lee. Lo que queda en la base de datos
// se lee con la sesión de cada persona (RLS). Cada ejecución usa títulos
// propios y los borra al final.
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36);
const ORG_GOAL = `Citas de Demo A ${RUN}`;
const ORG_GOAL_EDITED = `Citas de toda Demo A ${RUN}`;
const A1_GOAL = `Respuesta en A1 ${RUN}`;
const NORTE_GOAL = `Leads de A Norte ${RUN}`;
const ALL_TITLES = [ORG_GOAL, ORG_GOAL_EDITED, A1_GOAL, NORTE_GOAL];
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Ids fijos del seed (packages/db/src/seed/data.ts).
const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";

interface GoalDbRow {
  id: string;
  organization_id: string;
  scope: string;
  scope_id: string;
  title: string;
  metric_key: string;
  direction: string;
  target_value: number;
  period: string;
  due_date: string | null;
  status: string;
}

async function goals(request: APIRequestContext, key: string, title: string): Promise<GoalDbRow[]> {
  const token = await apiToken(request, key);
  return (await restRows(
    request,
    token,
    `goals?title=eq.${encodeURIComponent(title)}&select=id,organization_id,scope,scope_id,title,metric_key,direction,target_value,period,due_date,status`,
  )) as GoalDbRow[];
}

interface NewGoal {
  title: string;
  target?: string;
  metric?: string;
  value: string;
  period?: string;
  dueDate?: string;
}

async function openCreate(page: Page) {
  await page.getByTestId("goal-add").click();
  return page.getByTestId("goal-create-form");
}

async function fillGoal(page: Page, goal: NewGoal) {
  const form = page.getByTestId("goal-create-form");
  if (goal.target) await form.getByTestId("goal-target").selectOption({ label: goal.target });
  await form.getByTestId("goal-title").fill(goal.title);
  if (goal.metric) await form.getByTestId("goal-metric").selectOption({ label: goal.metric });
  await form.getByTestId("goal-target-value").fill(goal.value);
  if (goal.period) await form.getByTestId("goal-period").selectOption({ label: goal.period });
  if (goal.dueDate) await form.getByTestId("goal-due-date").fill(goal.dueDate);
  return form;
}

const row = (page: Page, title: string) => page.getByTestId("goals-table-row").filter({ hasText: title });

async function targetOptions(page: Page): Promise<string[]> {
  return page.getByTestId("goal-target").locator("option").allTextContents();
}

test.afterAll(async ({ request }) => {
  const token = await apiToken(request, "a_org_admin");
  const { url, publishableKey } = supabasePublicEnv();
  for (const title of ALL_TITLES) {
    await request.delete(`${url}/rest/v1/goals?title=eq.${encodeURIComponent(title)}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    });
  }
});

test("el org_admin crea un objetivo de toda la organización", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/goals");
  await expect(page.getByRole("heading", { level: 1, name: "Objetivos" })).toBeVisible();

  const form = await openCreate(page);
  // Puede elegir cualquier alcance; por defecto, el del selector (toda la organización).
  expect(await targetOptions(page)).toEqual(["Toda la organización", "A Norte", "A1 Norte", "A2 Norte", "A3 sin región"]);
  await expect(form.getByTestId("goal-target")).toHaveValue(`organization:${ORG_A}`);
  // La fecha límite solo se pide con «una vez».
  await expect(form.getByTestId("goal-due-date")).toHaveCount(0);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const sheetScan = await new AxeBuilder({ page }).include('[data-testid="goal-create-sheet"]').withTags(WCAG_21_AA).analyze();
  expect(sheetScan.violations).toEqual([]);

  await fillGoal(page, { title: ORG_GOAL, value: "40" });
  await form.getByTestId("goal-create").click();
  await expect(page.getByTestId("goal-create-sheet")).toBeHidden();

  await expect(row(page, ORG_GOAL).getByTestId("goal-row-applies-to")).toHaveText("Toda la organización");
  await expect(row(page, ORG_GOAL).getByTestId("goal-row-target")).toHaveText("Al menos 40 al mes");
  await expect(row(page, ORG_GOAL).getByTestId("goal-status")).toHaveText("Activo");

  const [saved, ...rest] = await goals(request, "a_org_admin", ORG_GOAL);
  expect(rest).toEqual([]);
  expect(saved).toMatchObject({
    organization_id: ORG_A,
    scope: "organization",
    scope_id: ORG_A,
    metric_key: "appointments.booked",
    direction: "at_least",
    target_value: 40,
    period: "month",
    due_date: null,
    status: "active",
  });

  const pageScan = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(pageScan.violations).toEqual([]);
});

test("el org_admin cambia el objetivo desde su panel", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/goals");
  await row(page, ORG_GOAL).click();
  const form = page.getByTestId("goal-edit-form");
  await form.getByTestId("goal-title").fill(ORG_GOAL_EDITED);
  await form.getByTestId("goal-target-value").fill("45,5");
  await form.getByTestId("goal-status-select").selectOption({ label: "En pausa" });
  await form.getByTestId("goal-save").click();
  await expect(form.getByTestId("goal-saved")).toHaveText("Guardado.");

  await expect(row(page, ORG_GOAL_EDITED).getByTestId("goal-status")).toHaveText("En pausa");
  await expect(row(page, ORG_GOAL_EDITED).getByTestId("goal-row-target")).toHaveText("Al menos 45,5 al mes");
  const [saved] = await goals(request, "a_org_admin", ORG_GOAL_EDITED);
  expect(saved).toMatchObject({ scope: "organization", target_value: 45.5, status: "paused" });
});

test("un valor que no vale no se guarda y el formulario lo dice", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/goals");
  const form = await openCreate(page);
  await fillGoal(page, { title: A1_GOAL, metric: "Conversaciones resueltas sin una persona (%)", value: "150" });
  await form.getByTestId("goal-create").click();
  await expect(form.getByTestId("goal-error")).toContainText("Revisa los campos");
  await expect(page.getByTestId("goal-create-sheet")).toBeVisible();
  expect(await goals(request, "a_org_admin", A1_GOAL)).toEqual([]);
});

test("el location_manager crea objetivos solo en su local y lee los de la organización", async ({ page, request }) => {
  await signIn(page, "a_location_manager");
  await page.goto("/app/goals");
  await openCreate(page);
  expect(await targetOptions(page)).toEqual(["A1 Norte"]);
  // Cada métrica propone su sentido: el tiempo de respuesta, «como mucho».
  await fillGoal(page, { title: A1_GOAL, metric: "Tiempo hasta la primera respuesta", value: "15", period: "Cada semana" });
  await expect(page.getByTestId("goal-create-form").getByTestId("goal-direction")).toHaveValue("at_most");
  await page.getByTestId("goal-create-form").getByTestId("goal-create").click();
  await expect(page.getByTestId("goal-create-sheet")).toBeHidden();

  await expect(row(page, A1_GOAL).getByTestId("goal-row-applies-to")).toHaveText("A1 Norte");
  await expect(row(page, A1_GOAL).getByTestId("goal-row-target")).toHaveText("Como mucho 15 min a la semana");
  const [saved] = await goals(request, "a_location_manager", A1_GOAL);
  expect(saved).toMatchObject({ scope: "location", scope_id: LOC_A1, direction: "at_most", period: "week", target_value: 15 });

  // El de toda la organización lo ve, pero no lo puede cambiar.
  await row(page, ORG_GOAL_EDITED).click();
  await expect(page.getByTestId("goal-read-only")).toBeVisible();
  await expect(page.getByTestId("goal-edit-form")).toHaveCount(0);
  await expect(page.getByTestId("goal-delete")).toHaveCount(0);
});

test("el region_manager gestiona su región y sus locales, no la organización", async ({ page, request }) => {
  await signIn(page, "a_region_manager");
  await page.goto("/app/goals");
  await openCreate(page);
  expect(await targetOptions(page)).toEqual(["A Norte", "A1 Norte", "A2 Norte"]);
  await fillGoal(page, {
    title: NORTE_GOAL,
    target: "A Norte",
    metric: "Leads cualificados",
    value: "120",
    period: "Una vez, con fecha límite",
    dueDate: "2027-06-30",
  });
  await page.getByTestId("goal-create-form").getByTestId("goal-create").click();
  await expect(page.getByTestId("goal-create-sheet")).toBeHidden();

  await expect(row(page, NORTE_GOAL).getByTestId("goal-row-target")).toHaveText("Al menos 120 antes del 30/6/27");
  const [saved] = await goals(request, "a_region_manager", NORTE_GOAL);
  expect(saved).toMatchObject({ scope: "region", scope_id: REGION_A_NORTE, period: "once", due_date: "2027-06-30" });

  // El de A1 es de su región: lo puede cambiar. El de la organización, no.
  await row(page, A1_GOAL).click();
  await expect(page.getByTestId("goal-edit-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await row(page, ORG_GOAL_EDITED).click();
  await expect(page.getByTestId("goal-read-only")).toBeVisible();
});

test("el staff lee los objetivos que se le aplican y no puede crear", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/goals");
  await expect(page.getByTestId("goals-table")).toBeVisible();
  await expect(row(page, ORG_GOAL_EDITED)).toHaveCount(1);
  await expect(row(page, NORTE_GOAL)).toHaveCount(1);
  // El de A1 no es de su local (A2): RLS no lo enseña.
  await expect(row(page, A1_GOAL)).toHaveCount(0);
  await expect(page.getByTestId("goal-add")).toHaveCount(0);
});

test("con un local elegido, solo los que se le aplican", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto(`/app/goals?scope=${encodeURIComponent(`location:${LOC_A3}`)}`);
  await expect(row(page, ORG_GOAL_EDITED)).toHaveCount(1);
  await expect(row(page, A1_GOAL)).toHaveCount(0);
  await expect(row(page, NORTE_GOAL)).toHaveCount(0);
  // Al crear, se propone el local elegido.
  await openCreate(page);
  await expect(page.getByTestId("goal-target")).toHaveValue(`location:${LOC_A3}`);
});

test("otra organización no ve los objetivos de Demo A", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/app/goals");
  await expect(page.getByRole("heading", { level: 1, name: "Objetivos" })).toBeVisible();
  for (const title of ALL_TITLES) await expect(page.getByText(title)).toHaveCount(0);
});

test("el org_admin borra un objetivo, después de confirmarlo", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/goals");
  await row(page, A1_GOAL).click();
  await page.getByTestId("goal-delete").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar" }).click();
  await expect(row(page, A1_GOAL)).toHaveCount(0);
  expect(await goals(request, "a_org_admin", A1_GOAL)).toEqual([]);
});
