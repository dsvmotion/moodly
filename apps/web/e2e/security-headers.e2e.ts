import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Cabeceras de seguridad reales (servidor de producción de la app) y CSP sin
// bloqueos: si una pantalla necesitara algo que la política no permite, el
// navegador lo avisaría en consola y este test fallaría.

const CSP_VIOLATION = /Content Security Policy|Refused to (load|execute|apply|connect|frame)/i;

function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (msg) => { if (CSP_VIOLATION.test(msg.text())) violations.push(msg.text()); });
  page.on("pageerror", (err) => { if (CSP_VIOLATION.test(err.message)) violations.push(err.message); });
  return violations;
}

test("las páginas llevan las cabeceras de seguridad y una CSP con nonce distinto en cada petición", async ({ request }) => {
  const first = await request.get("/login");
  const second = await request.get("/login");
  const h = first.headers();

  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();

  const nonce = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(nonce(h["content-security-policy"])).toBeTruthy();
  expect(nonce(second.headers()["content-security-policy"])).not.toBe(nonce(h["content-security-policy"]));

  // Los scripts de la página llevan el nonce de su propia respuesta.
  const html = await first.text();
  expect(html).toContain(`nonce="${nonce(h["content-security-policy"])}"`);
});

test("los estáticos también llevan las cabeceras (aunque no pasen por el proxy)", async ({ request }) => {
  const h = (await request.get("/manifest.webmanifest")).headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
});

test("ninguna pantalla de la app provoca un bloqueo de la CSP", async ({ page }) => {
  const violations = watchCsp(page);
  await page.goto("/login");
  await signIn(page, "a_org_admin");
  for (const path of ["/app", "/app/ajustes/sedes", "/app/ajustes/equipo", "/app/ajustes/general", "/app/conversaciones", "/app/aprobaciones", "/app/agentes", "/app/agentes/sales"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  // Abre la paleta ⌘K (componente cliente con portal) para que se ejecute su código.
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.press("Escape");
  expect(violations).toEqual([]);
});
