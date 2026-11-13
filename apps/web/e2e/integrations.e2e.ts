import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { seedOrganizations } from "../../../packages/db/src/seed/data";
import { signIn } from "./helpers";

// Ajustes → Integraciones (O-02, ADR 0053) con Google Calendar, contra el Nango
// falso de e2e/nango-stub.ts (la web usa su transporte real por HTTP).
// Lo que hace el worker al llegar el webhook firmado (poner la fila activa con
// su id) lo hace aquí el test como postgres, como lo haría la plataforma: el
// webhook se prueba en apps/worker (nango-webhook.integration.ts).

const STUB = "http://127.0.0.1:3999";
const ORG_A = seedOrganizations.find((org) => org.name === "Demo A")?.id ?? "";

function localAdminUrl(): string {
  const status = JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], {
      cwd: resolve(import.meta.dirname, "../../../packages/db"),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as Record<string, string | undefined>;
  const url = status["DB_URL"];
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Solo contra Supabase local");
  return url;
}

const admin = new pg.Client({ connectionString: localAdminUrl() });

async function row(provider = "google-calendar") {
  const { rows } = await admin.query<{ id: string; status: string; external_connection_id: string | null; connected_by: string | null }>(
    "select id, status, external_connection_id, connected_by from public.integrations where organization_id = $1 and provider = $2 and kind = 'platform'",
    [ORG_A, provider],
  );
  return rows[0];
}

async function stubCalls(page: Page) {
  const res = await page.request.get(`${STUB}/__stub/calls`);
  return (await res.json()) as {
    sessions: {
      tags: Record<string, string>;
      allowed_integrations: string[];
      integrations_config_defaults?: Record<string, { connection_config?: Record<string, string> }>;
    }[];
    deleted: { connectionId: string; integrationKey: string | null }[];
  };
}

const card = (page: Page) => page.getByTestId("integration-google-calendar");
const outlookCard = (page: Page) => page.getByTestId("integration-outlook-calendar");

test.describe("Integraciones", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await admin.connect();
    await admin.query("delete from public.integrations where organization_id = $1 and provider in ('google-calendar', 'outlook-calendar')", [ORG_A]);
  });

  test.afterAll(async () => {
    await admin.query("delete from public.integrations where organization_id = $1 and provider in ('google-calendar', 'outlook-calendar')", [ORG_A]);
    await admin.end();
  });

  test("el org_admin conecta Google Calendar: fila pendiente, sesión de Nango con nuestras etiquetas y la ventana de autorización", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await expect(page.getByRole("heading", { level: 1, name: "Integraciones" })).toBeVisible();
    await expect(card(page).getByTestId("integration-status")).toHaveText("Sin conectar");

    const before = (await stubCalls(page)).sessions.length;
    const popupPromise = page.waitForEvent("popup");
    await card(page).getByTestId("integration-connect").click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/^http:\/\/127\.0\.0\.1:3999\/connect\?session_token=stub-session-\d+$/);
    await popup.close();

    await expect(card(page).getByTestId("integration-status")).toHaveText("Pendiente");
    const pending = await row();
    expect(pending).toMatchObject({ status: "pending", external_connection_id: null });
    const sessions = (await stubCalls(page)).sessions;
    expect(sessions).toHaveLength(before + 1);
    // La organización, la persona y la fila salen del servidor, nunca del cliente.
    expect(sessions.at(-1)).toEqual({
      allowed_integrations: ["google-calendar"],
      tags: { organization_id: ORG_A, end_user_id: pending?.connected_by, integration_id: pending?.id },
    });
  });

  test("conectada (como la deja el worker), otra organización no la ve; desconectar la borra en Nango", async ({ page, browser }) => {
    const connectionId = `conn-e2e-${randomUUID()}`;
    await admin.query(
      "update public.integrations set status = 'active', external_connection_id = $2 where organization_id = $1 and provider = 'google-calendar'",
      [ORG_A, connectionId],
    );

    // El org_admin de B no ve la conexión de A.
    const other = await browser.newPage();
    await signIn(other, "b_org_admin");
    await other.goto("/app/settings/integrations");
    await expect(card(other).getByTestId("integration-status")).toHaveText("Sin conectar");
    await other.close();

    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await expect(card(page).getByTestId("integration-status")).toHaveText("Conectado");
    await expect(card(page).getByTestId("integration-connect")).toHaveCount(0);
    await card(page).getByTestId("integration-disconnect").click();
    await expect(card(page).getByTestId("integration-status")).toHaveText("Desconectado");
    expect((await stubCalls(page)).deleted).toContainEqual({ connectionId, integrationKey: "google-calendar" });
    expect(await row()).toMatchObject({ status: "disconnected", external_connection_id: null });
  });

  test("si Nango falla al desconectar, la fila sigue conectada y la pantalla lo dice", async ({ page }) => {
    const connectionId = `fail-${randomUUID()}`;
    await admin.query(
      "update public.integrations set status = 'active', external_connection_id = $2 where organization_id = $1 and provider = 'google-calendar'",
      [ORG_A, connectionId],
    );
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await card(page).getByTestId("integration-disconnect").click();
    await expect(card(page).getByTestId("integration-error")).toHaveText(/No hemos podido hablar con el proveedor/);
    await expect(card(page).getByTestId("integration-status")).toHaveText("Conectado");
    expect(await row()).toMatchObject({ status: "active", external_connection_id: connectionId });
  });

  test("Outlook / Microsoft 365: la sesión pide solo leer el calendario y refrescar; conectado, desconectar la borra en Nango", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await expect(outlookCard(page)).toContainText("Outlook / Microsoft 365");
    await expect(outlookCard(page).getByTestId("integration-status")).toHaveText("Sin conectar");

    const popupPromise = page.waitForEvent("popup");
    await outlookCard(page).getByTestId("integration-connect").click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/^http:\/\/127\.0\.0\.1:3999\/connect\?session_token=stub-session-\d+$/);
    await popup.close();
    await expect(outlookCard(page).getByTestId("integration-status")).toHaveText("Pendiente");
    const pending = await row("outlook-calendar");
    expect(pending).toMatchObject({ status: "pending", external_connection_id: null });
    expect((await stubCalls(page)).sessions.at(-1)).toEqual({
      allowed_integrations: ["outlook"],
      tags: { organization_id: ORG_A, end_user_id: pending?.connected_by, integration_id: pending?.id },
      integrations_config_defaults: { outlook: { connection_config: { oauth_scopes_override: "offline_access,Calendars.Read" } } },
    });
    // Conectar Outlook no toca Google.
    await expect(card(page).getByTestId("integration-status")).not.toHaveText("Pendiente");

    const connectionId = `conn-ms-e2e-${randomUUID()}`;
    await admin.query(
      "update public.integrations set status = 'active', external_connection_id = $2 where organization_id = $1 and provider = 'outlook-calendar'",
      [ORG_A, connectionId],
    );
    await page.reload();
    await expect(outlookCard(page).getByTestId("integration-status")).toHaveText("Conectado");
    await outlookCard(page).getByTestId("integration-disconnect").click();
    await expect(outlookCard(page).getByTestId("integration-status")).toHaveText("Desconectado");
    expect((await stubCalls(page)).deleted).toContainEqual({ connectionId, integrationKey: "outlook" });
    expect(await row("outlook-calendar")).toMatchObject({ status: "disconnected", external_connection_id: null });
  });

  test("quien no administra la organización no ve el estado ni puede conectar", async ({ page }) => {
    await signIn(page, "a_staff");
    await page.goto("/app/settings/integrations");
    await expect(page.getByTestId("integrations-admin-only")).toBeVisible();
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByTestId("integration-status")).toHaveCount(0);
    await expect(card(page).getByTestId("integration-connect")).toHaveCount(0);
  });
});
