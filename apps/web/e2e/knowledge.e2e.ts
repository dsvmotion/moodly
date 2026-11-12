import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken, restRows, signIn, supabasePublicEnv } from "./helpers";

// La pantalla de conocimiento (paso B20-3) en Demo A. El org_admin (con el
// segundo factor) añade, cambia y borra fuentes; el resto del equipo las ve
// según su alcance y no las puede tocar; otra organización no las ve. Lo que
// queda en la base de datos se lee con la sesión de cada persona (RLS). El
// worker no está en marcha: las fuentes se quedan «Por indexar» (la ingesta la
// prueba su integración). Cada ejecución usa títulos propios y los borra al
// final.
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36);
const ORG_TITLE = `Horarios ${RUN}`;
const ORG_TITLE_EDITED = `Horarios y festivos ${RUN}`;
const A1_TITLE = `Precios de A1 ${RUN}`;
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

interface SourceRow {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  location_id: string | null;
}

async function sources(request: APIRequestContext, key: string, title: string): Promise<SourceRow[]> {
  const token = await apiToken(request, key);
  return (await restRows(
    request,
    token,
    `knowledge_sources?title=eq.${encodeURIComponent(title)}&select=id,type,title,body,status,location_id`,
  )) as SourceRow[];
}

async function addSource(page: Page, { title, body, location }: { title: string; body: string; location?: string }) {
  await page.getByTestId("knowledge-add").click();
  const form = page.getByTestId("knowledge-create-form");
  if (location) await form.getByTestId("knowledge-location").selectOption({ label: location });
  await form.getByTestId("knowledge-title").fill(title);
  await form.getByTestId("knowledge-body").fill(body);
  await form.getByTestId("knowledge-create").click();
  await expect(page.getByTestId("knowledge-create-sheet")).toBeHidden();
}

const row = (page: Page, title: string) => page.getByTestId("knowledge-table-row").filter({ hasText: title });

test.afterAll(async ({ request }) => {
  const token = await apiToken(request, "a_org_admin");
  const { url, publishableKey } = supabasePublicEnv();
  for (const title of [ORG_TITLE, ORG_TITLE_EDITED, A1_TITLE]) {
    await request.delete(`${url}/rest/v1/knowledge_sources?title=eq.${encodeURIComponent(title)}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    });
  }
});

test("el org_admin añade una fuente de toda la organización y queda por indexar", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/knowledge");
  await expect(page.getByRole("heading", { level: 1, name: "Conocimiento" })).toBeVisible();
  await expect(page.getByTestId("knowledge-privacy")).toBeVisible();

  await addSource(page, { title: ORG_TITLE, body: "Abrimos de lunes a viernes de 9 a 20 h.\n\nLos sábados, de 10 a 14 h." });
  await expect(row(page, ORG_TITLE).getByTestId("knowledge-row-location")).toHaveText("Toda la organización");
  await expect(row(page, ORG_TITLE).getByTestId("knowledge-status")).toHaveText("Por indexar");

  // En la base de datos: la organización activa, sin local, de tipo FAQ y pendiente.
  const [saved, ...rest] = await sources(request, "a_org_admin", ORG_TITLE);
  expect(rest).toEqual([]);
  expect(saved).toMatchObject({
    type: "faq",
    location_id: null,
    status: "pending",
    body: "Abrimos de lunes a viernes de 9 a 20 h.\n\nLos sábados, de 10 a 14 h.",
  });

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("una fuente de un local la ve quien tiene ese local, y no quien tiene otro ni otra organización", async ({ page, browser, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/knowledge");
  await addSource(page, { title: A1_TITLE, body: "Primera visita: 40 €.", location: "A1 Norte" });
  await expect(row(page, A1_TITLE).getByTestId("knowledge-row-location")).toHaveText("A1 Norte");

  const manager = await browser.newPage();
  await signIn(manager, "a_location_manager");
  await manager.goto("/app/knowledge");
  await expect(row(manager, A1_TITLE)).toBeVisible();
  await expect(row(manager, ORG_TITLE)).toBeVisible();
  await manager.close();

  const staff = await browser.newPage();
  await signIn(staff, "a_staff");
  await staff.goto("/app/knowledge");
  await expect(row(staff, ORG_TITLE)).toBeVisible();
  await expect(row(staff, A1_TITLE)).toHaveCount(0);
  await staff.close();
  expect(await sources(request, "a_staff", A1_TITLE)).toEqual([]);

  const other = await browser.newPage();
  await signIn(other, "b_org_admin");
  await other.goto("/app/knowledge");
  await expect(other.getByRole("heading", { level: 1, name: "Conocimiento" })).toBeVisible();
  await expect(row(other, ORG_TITLE)).toHaveCount(0);
  await expect(row(other, A1_TITLE)).toHaveCount(0);
  await other.close();
  expect(await sources(request, "b_org_admin", ORG_TITLE)).toEqual([]);
});

test("el equipo lee el texto pero no puede añadir, cambiar ni borrar", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/knowledge");
  await expect(page.getByTestId("knowledge-add")).toHaveCount(0);
  await row(page, ORG_TITLE).click();
  const drawer = page.getByTestId("preview-drawer");
  await expect(drawer.getByRole("heading", { name: ORG_TITLE })).toBeVisible();
  await expect(drawer.getByTestId("knowledge-body-text")).toContainText("Los sábados, de 10 a 14 h.");
  await expect(drawer.getByTestId("knowledge-edit-form")).toHaveCount(0);
  await expect(drawer.getByTestId("knowledge-delete")).toHaveCount(0);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("cambiar el título y el texto los guarda y la deja por indexar otra vez", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/knowledge");
  await row(page, ORG_TITLE).click();
  const form = page.getByTestId("knowledge-edit-form");
  await form.getByTestId("knowledge-title").fill(ORG_TITLE_EDITED);
  await form.getByTestId("knowledge-body").fill("Abrimos de lunes a viernes de 9 a 20 h.\n\nLos festivos cerramos.");
  await form.getByTestId("knowledge-save").click();
  await expect(form.getByTestId("knowledge-saved")).toBeVisible();
  await page.getByTestId("preview-drawer").getByRole("button", { name: "Cerrar vista previa" }).click();
  await expect(row(page, ORG_TITLE_EDITED).getByTestId("knowledge-status")).toHaveText("Por indexar");

  expect(await sources(request, "a_org_admin", ORG_TITLE)).toEqual([]);
  expect(await sources(request, "a_org_admin", ORG_TITLE_EDITED)).toEqual([
    expect.objectContaining({ body: "Abrimos de lunes a viernes de 9 a 20 h.\n\nLos festivos cerramos.", status: "pending" }),
  ]);
});

test("borrar una fuente pide confirmación y la quita", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/knowledge");
  await row(page, A1_TITLE).click();
  await page.getByTestId("knowledge-delete").click();
  // Cancelar no borra nada.
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
  expect(await sources(request, "a_org_admin", A1_TITLE)).toHaveLength(1);

  await page.getByTestId("knowledge-delete").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar" }).click();
  await expect(row(page, A1_TITLE)).toHaveCount(0);
  await expect(page.getByTestId("preview-drawer")).toBeHidden();
  expect(await sources(request, "a_org_admin", A1_TITLE)).toEqual([]);
});
