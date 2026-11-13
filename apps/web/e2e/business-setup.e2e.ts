import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken, restRows, signIn, supabasePublicEnv } from "./helpers";

// Ajustes del negocio (OA04) en Demo A. El org_admin (con el segundo factor)
// crea un servicio con precio, lo cambia, da de alta a una profesional que lo
// hace y cambia el horario de una sede; un location_manager lo ve pero no lo
// puede cambiar, ni desde la pantalla ni desde la API. Lo que queda en la base
// de datos se lee con la sesión de cada persona (RLS). Que los huecos siguen
// ese horario lo prueba pgTAP (56_business_setup). Cada ejecución usa nombres
// propios; los servicios y recursos no se borran (las citas apuntan a ellos):
// se desactivan al final, y el horario vuelve a como estaba.
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36);
const SERVICE = `Facial ${RUN}`;
const RESOURCE = `Marta ${RUN}`;
const LOCATION = "A1 Norte";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

interface ServiceRecord {
  id: string;
  price_cents: number | null;
  currency: string;
  duration_minutes: number;
  location_id: string | null;
  active: boolean;
}

async function rest(request: APIRequestContext, key: string, path: string): Promise<unknown[]> {
  return restRows(request, await apiToken(request, key), path);
}

async function patch(request: APIRequestContext, key: string, path: string, body: unknown): Promise<unknown[]> {
  const { url, publishableKey } = supabasePublicEnv();
  const response = await request.patch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${await apiToken(request, key)}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: body,
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as unknown[];
}

const serviceRecord = async (request: APIRequestContext, key = "a_org_admin") =>
  (await rest(request, key, `services?name=eq.${encodeURIComponent(SERVICE)}&select=id,price_cents,currency,duration_minutes,location_id,active`)) as ServiceRecord[];

const row = (page: Page, table: string, name: string) => page.getByTestId(`${table}-table-row`).filter({ hasText: name });

let locationId = "";
let originalHours: unknown = {};

test.beforeAll(async ({ request }) => {
  const [location] = (await rest(request, "a_org_admin", `locations?name=eq.${encodeURIComponent(LOCATION)}&select=id,opening_hours`)) as {
    id: string;
    opening_hours: unknown;
  }[];
  if (!location) throw new Error(`El seed no tiene la sede ${LOCATION}`);
  locationId = location.id;
  originalHours = location.opening_hours;
});

test.afterAll(async ({ request }) => {
  await patch(request, "a_org_admin", `services?name=eq.${encodeURIComponent(SERVICE)}`, { active: false });
  await patch(request, "a_org_admin", `booking_resources?name=eq.${encodeURIComponent(RESOURCE)}`, { active: false });
  await patch(request, "a_org_admin", `locations?id=eq.${locationId}`, { opening_hours: originalHours });
});

test("el org_admin crea un servicio con precio y lo cambia", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/settings/services");
  await expect(page.getByRole("heading", { level: 1, name: "Servicios y equipo" })).toBeVisible();

  await page.getByTestId("service-add").click();
  const form = page.getByTestId("service-create-form");
  await form.getByTestId("service-name").fill(SERVICE);
  await form.getByTestId("service-duration").fill("45");
  await form.getByTestId("service-price").fill("45,50");
  await form.getByTestId("service-create").click();
  await expect(page.getByTestId("service-create-sheet")).toBeHidden();
  await expect(row(page, "services", SERVICE).getByTestId("service-row-price")).toContainText("45,50");

  // En la base de datos: en todas las sedes, en céntimos y en euros.
  const [saved, ...rest] = await serviceRecord(request);
  expect(rest).toEqual([]);
  expect(saved).toMatchObject({ price_cents: 4550, currency: "EUR", duration_minutes: 45, location_id: null, active: true });

  await row(page, "services", SERVICE).click();
  const edit = page.getByTestId("service-edit-form");
  await edit.getByTestId("service-price").fill("50");
  await edit.getByTestId("service-save").click();
  await expect(edit.getByTestId("business-saved")).toBeVisible();
  expect((await serviceRecord(request))[0]?.price_cents).toBe(5000);

  // Un precio que no se entiende no se guarda.
  await edit.getByTestId("service-price").fill("50 euros");
  await edit.getByTestId("service-save").click();
  await expect(edit.getByTestId("business-error")).toBeVisible();
  expect((await serviceRecord(request))[0]?.price_cents).toBe(5000);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("el org_admin da de alta a una profesional de una sede que hace ese servicio", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/settings/services?tab=team");
  await expect(page.getByTestId("business-tab-team")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("resource-add").click();
  const form = page.getByTestId("resource-create-form");
  await form.getByTestId("resource-location").selectOption({ label: LOCATION });
  await form.getByTestId("resource-name").fill(RESOURCE);
  await form.getByTestId("resource-kind").selectOption("staff");
  await form.getByTestId("resource-service").filter({ hasText: SERVICE }).check();
  await form.getByTestId("resource-create").click();
  await expect(page.getByTestId("resource-create-sheet")).toBeHidden();
  await expect(row(page, "resources", RESOURCE)).toContainText(SERVICE);

  const [service] = await serviceRecord(request);
  const [resource] = (await rest(request, "a_org_admin", `booking_resources?name=eq.${encodeURIComponent(RESOURCE)}&select=id,kind,location_id`)) as {
    id: string;
    kind: string;
    location_id: string;
  }[];
  expect(resource).toMatchObject({ kind: "staff", location_id: locationId });
  expect(await rest(request, "a_org_admin", `resource_services?resource_id=eq.${resource?.id}&select=service_id`)).toEqual([
    { service_id: service?.id },
  ]);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("el org_admin cambia el horario de una sede", async ({ page, request }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/settings/locations");
  await page.getByTestId("locations-table-row").filter({ hasText: LOCATION }).click();
  const form = page.getByTestId("hours-form");

  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) await form.getByTestId(`hours-${day}-open`).uncheck();
  await form.getByTestId("hours-mon-open").check();
  await form.getByTestId("hours-mon-from").fill("10:00");
  await form.getByTestId("hours-mon-to").fill("13:00");
  await form.getByTestId("hours-sat-open").check();
  await form.getByTestId("hours-sat-from").fill("09:30");
  await form.getByTestId("hours-sat-to").fill("14:00");
  await form.getByTestId("hours-save").click();
  await expect(form.getByTestId("business-saved")).toBeVisible();
  // Tras guardar se sigue viendo lo guardado, no el horario de antes.
  await expect(form.getByTestId("hours-mon-from")).toHaveValue("10:00");
  await expect(form.getByTestId("hours-sat-to")).toHaveValue("14:00");

  const [location] = (await rest(request, "a_org_admin", `locations?id=eq.${locationId}&select=opening_hours`)) as { opening_hours: unknown }[];
  expect(location?.opening_hours).toEqual({ mon: ["10:00", "13:00"], sat: ["09:30", "14:00"] });

  // Cerrar antes de abrir no se guarda.
  await form.getByTestId("hours-mon-from").fill("15:00");
  await form.getByTestId("hours-save").click();
  await expect(form.getByTestId("business-error")).toBeVisible();

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("un location_manager lo ve pero no lo puede cambiar, ni desde la API", async ({ page, request }) => {
  await signIn(page, "a_location_manager");
  await page.goto("/app/settings/services");
  await expect(row(page, "services", SERVICE)).toBeVisible();
  await expect(page.getByTestId("service-add")).toHaveCount(0);
  await row(page, "services", SERVICE).click();
  await expect(page.getByTestId("preview-drawer").getByRole("heading", { name: SERVICE })).toBeVisible();
  await expect(page.getByTestId("service-edit-form")).toHaveCount(0);
  await expect(page.getByTestId("service-toggle-active")).toHaveCount(0);

  await page.goto("/app/settings/services?tab=team");
  await expect(row(page, "resources", RESOURCE)).toBeVisible();
  await expect(page.getByTestId("resource-add")).toHaveCount(0);

  await page.goto("/app/settings/locations");
  await page.getByTestId("locations-table-row").filter({ hasText: LOCATION }).click();
  await expect(page.getByTestId("preview-drawer").getByRole("heading", { name: LOCATION })).toBeVisible();
  await expect(page.getByTestId("hours-form")).toHaveCount(0);

  // La barrera es la base de datos: con su sesión, ni el precio ni el nombre cambian.
  expect(await patch(request, "a_location_manager", `services?name=eq.${encodeURIComponent(SERVICE)}`, { price_cents: 1 })).toEqual([]);
  expect(await patch(request, "a_location_manager", `booking_resources?name=eq.${encodeURIComponent(RESOURCE)}`, { name: "otro" })).toEqual([]);
  expect((await serviceRecord(request))[0]?.price_cents).toBe(5000);
});
