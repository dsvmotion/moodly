import { expect, test, type Page } from "@playwright/test";
import { formatLocalTime } from "../src/lib/time-zone";
import { signIn } from "./helpers";

// Las horas en la zona horaria del local (auditoría de preproducción, M-08).
// Decisión de producto del 2026-11-10: cada hora va en la zona de su local, con
// la zona escrita al lado cuando la organización tiene más de una o cuando quien
// mira está en otra zona. El servidor de los e2e corre en UTC (en local y en el
// CI): si la hora saliera en la zona del servidor, no coincidiría con la de Madrid.

// Demo A: todos sus locales en Europe/Madrid. La conversación de A2 tiene
// mensajes del cliente, del sistema y del equipo (packages/db/src/seed/data.ts).
const HUMAN_A2_ID = "5eed000b-0000-4000-8000-0000000000b2";
const LOCATION_ZONE = "Europe/Madrid";

async function messageTimes(page: Page): Promise<{ iso: string; text: string }[]> {
  const times = page.getByTestId("inbox-message-time");
  await expect(times.first()).toBeVisible();
  return times.evaluateAll((elements) =>
    elements.map((element) => ({ iso: element.getAttribute("datetime") ?? "", text: element.textContent ?? "" })),
  );
}

test.describe("con el dispositivo en la zona del local", () => {
  test.use({ timezoneId: LOCATION_ZONE });

  test("las horas del hilo van en la hora del local, sin la zona al lado", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto(`/app/inbox/${HUMAN_A2_ID}`);
    const times = await messageTimes(page);
    expect(times.length).toBeGreaterThan(0);
    for (const { iso, text } of times) {
      expect(text).toBe(formatLocalTime(iso, { locale: "es", timeZone: LOCATION_ZONE, withZone: false }));
      // Y no en la del servidor.
      expect(text).not.toBe(formatLocalTime(iso, { locale: "es", timeZone: "UTC", withZone: false }));
    }
    await expect(page.getByTestId("inbox-message-time").first()).toHaveAttribute("title", LOCATION_ZONE);
  });
});

test.describe("con el dispositivo en otra zona", () => {
  test.use({ timezoneId: "America/New_York" });

  test("las horas siguen en la del local, con la zona escrita al lado", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto(`/app/inbox/${HUMAN_A2_ID}`);
    const first = page.getByTestId("inbox-message-time").first();
    const iso = (await first.getAttribute("datetime")) ?? "";
    await expect(first).toHaveText(formatLocalTime(iso, { locale: "es", timeZone: LOCATION_ZONE, withZone: true }));
    await expect(first).toContainText(/CES?T/);
    for (const { iso: each, text } of await messageTimes(page)) {
      expect(text).toBe(formatLocalTime(each, { locale: "es", timeZone: LOCATION_ZONE, withZone: true }));
    }
  });
});

// Demo F (seed de volumen, #170): F1 en Europe/Madrid y F2 en Atlantic/Canary.
// Con dos zonas en la organización, cada hora lleva la suya al lado, aunque el
// dispositivo esté en la misma zona que el local.
const F1_CONVERSATION_ID = "5eed00f1-0000-4000-8000-000000000001";
const F2_CONVERSATION_ID = "5eed00f1-0000-4000-8000-000000000000";

test.describe("en una organización con locales en dos zonas", () => {
  test.use({ timezoneId: "Atlantic/Canary" });

  test("cada hora va en la zona de su local, con la zona escrita al lado", async ({ page }) => {
    await signIn(page, "f_org_admin");

    await page.goto(`/app/inbox/${F2_CONVERSATION_ID}`);
    const canary = await messageTimes(page);
    expect(canary.length).toBeGreaterThan(0);
    for (const { iso, text } of canary) {
      expect(text).toBe(formatLocalTime(iso, { locale: "es", timeZone: "Atlantic/Canary", withZone: true }));
    }
    await expect(page.getByTestId("inbox-message-time").first()).toHaveAttribute("title", "Atlantic/Canary");

    await page.goto(`/app/inbox/${F1_CONVERSATION_ID}`);
    const madrid = await messageTimes(page);
    expect(madrid.length).toBeGreaterThan(0);
    for (const { iso, text } of madrid) {
      expect(text).toBe(formatLocalTime(iso, { locale: "es", timeZone: "Europe/Madrid", withZone: true }));
      // La misma hora en Canarias es otra: no se pinta en la zona del dispositivo.
      expect(text).not.toBe(formatLocalTime(iso, { locale: "es", timeZone: "Atlantic/Canary", withZone: true }));
    }
  });
});
