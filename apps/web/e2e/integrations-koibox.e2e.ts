import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { seedOrganizations } from "../../../packages/db/src/seed/data";
import { createLocalIngressKeyring, openSubmission } from "../../../packages/integrations/src/key-ingress/sealed-key";
import { signIn } from "./helpers";

// Ajustes → Integraciones → Koibox (ADR 0055; int-koibox): el org_admin pega la
// clave, la web la cifra hacia el worker y deja el envío. En los e2e no corre
// el worker: lo que haría al comprobar la clave con Koibox (activar, rechazar,
// el resultado con la marca) lo hace aquí el test como postgres. El worker se
// prueba en apps/worker (key-submission.integration.ts).
//
// Lo que sí es real: el cifrado de la web con la parte pública local (la de
// .env.local, del par que genera `pnpm db:seed`), la fila que queda en la base
// de datos, que se abre con la privada local (la del worker) y solo con el
// contexto del envío, el evento del outbox y el freno de la base de datos.

const ORG_A = seedOrganizations.find((org) => org.name === "Demo A")?.id ?? "";
const DB_ROOT = resolve(import.meta.dirname, "../../../packages/db");
const KEY_1 = "kbx_e2e_primera_clave_0001";
const KEY_2 = "kbx_e2e_segunda_clave_0002";

function localAdminUrl(): string {
  const status = JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], { cwd: DB_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  ) as Record<string, string | undefined>;
  const url = status["DB_URL"];
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Solo contra Supabase local");
  return url;
}

const admin = new pg.Client({ connectionString: localAdminUrl() });
const serverKeys = JSON.parse(readFileSync(resolve(DB_ROOT, ".seed/server-keys.local.json"), "utf8")) as Record<string, string>;
const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: serverKeys["integration_ingress_private_pem"] ?? "" }]);

interface Row {
  id: string;
  status: string;
  secret_id: string | null;
  last_submission_id: string | null;
  last_submission_result: string | null;
}

async function integration(): Promise<Row | undefined> {
  const { rows } = await admin.query<Row>(
    `select id, status, secret_id, last_submission_id, last_submission_result from public.integrations
      where organization_id = $1 and provider = 'koibox' and kind = 'native' and location_id is null`,
    [ORG_A],
  );
  return rows[0];
}

async function submissions(integrationId: string) {
  const { rows } = await admin.query<{
    id: string;
    key_ref: string;
    encrypted_data_key: string;
    ciphertext: string;
    created_at: Date;
    submitted_by: string | null;
  }>(
    `select id, key_ref, encrypted_data_key, ciphertext, created_at, submitted_by from public.integration_secret_submissions
      where integration_id = $1 order by created_at, id`,
    [integrationId],
  );
  return rows;
}

/** Lo que haría el worker tras comprobar la clave con Koibox (aquí, como postgres). */
async function workerApplies(integrationId: string, submissionId: string, createdAt: Date, result: "applied" | "rejected") {
  await admin.query("begin");
  try {
    const current = await integration();
    let secretId = current?.secret_id ?? null;
    if (result === "applied" && !secretId) {
      const { rows } = await admin.query<{ id: string }>(
        `insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
         values ($1, 'integration', 'koibox.api_key', 'local:v1', 'ZTJl', 'ZTJl') returning id`,
        [ORG_A],
      );
      secretId = rows[0]?.id ?? null;
    }
    await admin.query(
      `update public.integrations
          set status = case when $2 = 'applied' then 'active' else status end,
              secret_id = $3, last_submission_at = $4, last_submission_id = $5, last_submission_result = $2
        where id = $1`,
      [integrationId, result, secretId, createdAt, submissionId],
    );
    await admin.query("delete from public.integration_secret_submissions where id = $1", [submissionId]);
    await admin.query("commit");
  } catch (err) {
    await admin.query("rollback");
    throw err;
  }
}

async function cleanup() {
  await admin.query(
    `delete from public.domain_events where organization_id = $1 and type in ('integration.key_submitted', 'integration.disconnected')`,
    [ORG_A],
  );
  await admin.query("delete from public.integrations where organization_id = $1 and provider = 'koibox'", [ORG_A]);
  await admin.query("delete from public.integration_secrets where organization_id = $1 and name like 'koibox.%'", [ORG_A]);
}

const card = (page: Page) => page.getByTestId("integration-koibox");

async function paste(page: Page, value: string) {
  await card(page).getByTestId("integration-key-input").fill(value);
  await card(page).getByTestId("integration-key-submit").click();
}

test.describe("Integraciones · Koibox (clave del cliente)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await admin.connect();
    await cleanup();
  });

  test.afterAll(async () => {
    await cleanup();
    await admin.end();
  });

  test("una clave con mala forma no crea nada", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await expect(card(page).getByTestId("integration-status")).toHaveText("Sin conectar");
    await paste(page, "con espacios 12345");
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText(/no tiene una forma válida/);
    expect(await integration()).toBeUndefined();
  });

  test("primera conexión: la web cifra la clave hacia el worker y la deja pendiente; el worker la acepta", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await paste(page, KEY_1);
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText("Comprobando la clave con Koibox…");
    await expect(card(page).getByTestId("integration-key-input")).toHaveValue("");

    const row = await integration();
    expect(row).toMatchObject({ status: "pending", secret_id: null, last_submission_id: null });
    const [sent] = await submissions(row?.id ?? "");
    expect(sent).toBeDefined();
    if (!row || !sent) return;
    expect(sent.key_ref).toBe("local:v1");
    expect(sent.submitted_by).not.toBeNull();
    // En la base de datos no está la clave…
    expect(`${sent.ciphertext}${sent.encrypted_data_key}`).not.toContain(KEY_1);
    expect(Buffer.from(sent.ciphertext, "base64").toString("latin1")).not.toContain(KEY_1);
    // …pero la privada local del worker la abre, solo con el contexto del envío.
    const context = { organizationId: ORG_A, integrationId: row.id, submissionId: sent.id, provider: "koibox" };
    const sealed = { keyRef: sent.key_ref, encryptedDataKey: sent.encrypted_data_key, ciphertext: sent.ciphertext };
    await expect(openSubmission(keyring, context, sealed)).resolves.toBe(KEY_1);
    await expect(openSubmission(keyring, { ...context, organizationId: seedOrganizations[1]?.id ?? "" }, sealed)).rejects.toThrow();
    // Y con él, el evento que despierta al worker, solo con ids.
    const { rows: events } = await admin.query<{ payload: Record<string, string> }>(
      `select payload from public.domain_events where organization_id = $1 and type = 'integration.key_submitted' and payload->>'submission_id' = $2`,
      [ORG_A, sent.id],
    );
    expect(events.map((e) => e.payload)).toEqual([{ submission_id: sent.id, integration_id: row.id, provider: "koibox" }]);

    await workerApplies(row.id, sent.id, sent.created_at, "applied");
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText("Clave comprobada: Koibox está conectado.", { timeout: 15_000 });
    await expect(card(page).getByTestId("integration-status")).toHaveText("Conectado");
  });

  test("al rotar, una clave que Koibox no acepta dice que sigue la anterior", async ({ page }) => {
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await expect(card(page).getByTestId("integration-key-submit")).toHaveText("Cambiar clave");
    await paste(page, KEY_2);
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText("Comprobando la clave con Koibox…");
    const row = await integration();
    const [sent] = await submissions(row?.id ?? "");
    if (!row || !sent) throw new Error("no quedó el envío");
    await workerApplies(row.id, sent.id, sent.created_at, "rejected");
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText(/no ha aceptado la última clave que enviaste: sigue funcionando la anterior/, {
      timeout: 15_000,
    });
    await expect(card(page).getByTestId("integration-status")).toHaveText("Conectado");
    // Y al volver a la pantalla, se sigue diciendo.
    await page.reload();
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText(/sigue funcionando la anterior/);
  });

  test("el freno de la base de datos: con 5 envíos en 15 minutos, «demasiados intentos»", async ({ page }) => {
    const row = await integration();
    if (!row) throw new Error("no hay integración");
    // Llevamos 2; con 3 eventos más (como si se hubieran enviado) llega a 5.
    await admin.query(
      `insert into public.domain_events (organization_id, type, payload)
       select $1, 'integration.key_submitted', jsonb_build_object('submission_id', gen_random_uuid(), 'integration_id', $2::text, 'provider', 'koibox')
         from generate_series(1, 3)`,
      [ORG_A, row.id],
    );
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await paste(page, KEY_1);
    await expect(card(page).getByTestId("integration-key-notice")).toHaveText(/Demasiados intentos/);
    expect(await submissions(row.id)).toEqual([]);
  });

  test("desconectar: la integración queda desconectada y sale el evento para que el worker borre el secreto", async ({ page }) => {
    const before = await integration();
    await signIn(page, "a_org_admin");
    await page.goto("/app/settings/integrations");
    await card(page).getByTestId("integration-disconnect").click();
    await expect(card(page).getByTestId("integration-status")).toHaveText("Desconectado");
    expect(await integration()).toMatchObject({ status: "disconnected" });
    const { rows } = await admin.query<{ payload: Record<string, string> }>(
      `select payload from public.domain_events where organization_id = $1 and type = 'integration.disconnected' and payload->>'integration_id' = $2`,
      [ORG_A, before?.id ?? ""],
    );
    expect(rows.map((r) => r.payload)).toEqual([{ integration_id: before?.id, provider: "koibox", secret_id: before?.secret_id }]);
  });

  test("quien no administra la organización ve Koibox sin estado ni campo para la clave", async ({ page }) => {
    await signIn(page, "a_staff");
    await page.goto("/app/settings/integrations");
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByTestId("integration-status")).toHaveCount(0);
    await expect(card(page).getByTestId("integration-key-input")).toHaveCount(0);
  });
});
