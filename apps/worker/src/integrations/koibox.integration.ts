import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createServiceDb } from "@repo/db/service";
import { KoiboxError } from "@repo/integrations";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLocalKeyProvider, createSecretVault, SecretDecryptionError } from "../secrets/vault.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { KOIBOX_SECRET_NAME, KoiboxSetupError, loadKoiboxReader } from "./koibox.ts";

// Koibox, solo lectura, contra Supabase local con el seed aplicado: moodly_worker
// de verdad (RLS, privilegios de columna), un secreto cifrado con la clave
// maestra local (local:v1) y un Koibox falso en loopback con las formas de la
// referencia de la API. Sin cuenta real.

const api = localSupabaseApi();
const db = createServiceDb({ url: api.url, secretKey: api.secretKey, workerDatabaseUrl: localWorkerDatabaseUrl() });
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const vault = createSecretVault(createLocalKeyProvider(randomBytes(32).toString("base64")));

// Demo A tiene tres locales; Demo B, uno (Madrid); Demo F, dos (uno en Canarias).
const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const ORG_B = "5eed0000-0000-4000-8000-00000000000b";
const ORG_F = "5eed0000-0000-4000-8000-00000000000f";
const KEY_B = "kbx_demo_b_key_not_secret_0001";

let server: Server;
let apiBase = "";
const calls: { path: string; key: string | undefined }[] = [];

async function connect(org: string, apiKey: string, locationId: string | null = null): Promise<string> {
  const sealed = await vault.seal(org, apiKey);
  const { rows } = await admin.query<{ id: string }>(
    `insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
     values ($1, 'integration', $2, $3, $4, $5) returning id`,
    [org, KOIBOX_SECRET_NAME, sealed.keyRef, sealed.encryptedDataKey, sealed.ciphertext],
  );
  const secretId = rows[0]?.id ?? "";
  await admin.query(
    `insert into public.integrations (organization_id, location_id, provider, kind, status, secret_id) values ($1, $2, 'koibox', 'native', 'active', $3)`,
    [org, locationId, secretId],
  );
  return secretId;
}

async function cleanup() {
  await admin.query("delete from public.integrations where provider = 'koibox' and organization_id = any($1)", [[ORG_A, ORG_B, ORG_F]]);
  await admin.query("delete from public.integration_secrets where name = $1 and organization_id = any($2)", [KOIBOX_SECRET_NAME, [ORG_A, ORG_B, ORG_F]]);
}

beforeAll(async () => {
  await admin.connect();
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const key = req.headers["x-koibox-key"] as string | undefined;
    calls.push({ path: url.pathname, key });
    const send = (status: number, body: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (key !== KEY_B) return send(403, { detail: "Invalid key" });
    if (url.pathname === "/api/api-key/me/") return send(200, { name: "Moodly", centro: 21, centro_slug: "demo-b" });
    if (url.pathname === "/api/servicios/") {
      return send(200, { count: 1, next: null, previous: null, results: [{ id: 7, referencia: "C", nombre: "Corte", duracion: "00:30:00", users: [3] }] });
    }
    if (url.pathname === "/api/agenda/") {
      return send(200, {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 90, titulo: "Corte", fecha: "2026-11-13", hora_inicio: "10:00:00", hora_fin: "10:30:00", user: 3, servicios: [7], cliente: { text: "Lucía", movil: "600000000" } }],
      });
    }
    return send(404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  calls.length = 0;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await admin.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("loadKoiboxReader (moodly_worker, RLS, secreto cifrado)", () => {
  it("con la clave de su organización y la zona de su único local: lee servicios y citas (sin datos del cliente)", async () => {
    await connect(ORG_B, KEY_B);
    const koibox = await loadKoiboxReader({ db, vault, organizationId: ORG_B, apiBase });
    expect(koibox).not.toBeNull();
    await expect(koibox?.verifyKey()).resolves.toEqual({ centerId: "21", centerSlug: "demo-b" });
    await expect(koibox?.listServices()).resolves.toEqual([
      { id: "7", name: "Corte", durationMinutes: 30, active: true, bookableOnline: false, employeeIds: ["3"] },
    ]);
    const appointments = await koibox?.listAppointments({ from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-14T00:00:00Z"), limit: 5 });
    // 10:00 en Madrid = 09:00 UTC.
    expect(appointments).toEqual([
      { id: "90", employeeId: "3", serviceIds: ["7"], startsAt: new Date("2026-11-13T09:00:00Z"), endsAt: new Date("2026-11-13T09:30:00Z"), state: "" },
    ]);
    expect(JSON.stringify(appointments)).not.toMatch(/Lucía|600000000/);
    expect(calls.every((c) => c.key === KEY_B)).toBe(true);
  });

  it("una organización sin Koibox conectado: null y ni una llamada", async () => {
    await connect(ORG_B, KEY_B);
    await expect(loadKoiboxReader({ db, vault, organizationId: ORG_A, apiBase })).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("en negativo: el secreto de B copiado a una integración de A no se descifra (ligado a su organización)", async () => {
    const secretB = await connect(ORG_B, KEY_B);
    const { rows } = await admin.query<{ id: string }>(
      `insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
       select $1, kind, name, key_ref, encrypted_data_key, ciphertext from public.integration_secrets where id = $2 returning id`,
      [ORG_A, secretB],
    );
    const { rows: loc } = await admin.query<{ id: string }>("select id from public.locations where organization_id = $1 order by id limit 1", [ORG_A]);
    await admin.query(
      `insert into public.integrations (organization_id, location_id, provider, kind, status, secret_id) values ($1, $2, 'koibox', 'native', 'active', $3)`,
      [ORG_A, loc[0]?.id, rows[0]?.id],
    );
    await expect(loadKoiboxReader({ db, vault, organizationId: ORG_A, apiBase })).rejects.toBeInstanceOf(SecretDecryptionError);
    expect(calls).toHaveLength(0);
  });

  it("de toda la organización con varios locales activos: no adivina la zona horaria", async () => {
    await connect(ORG_A, "kbx_demo_a_key_not_secret_0001");
    await expect(loadKoiboxReader({ db, vault, organizationId: ORG_A, apiBase })).rejects.toBeInstanceOf(KoiboxSetupError);
    expect(calls).toHaveLength(0);
  });

  it("de un local: usa la zona de ese local (Canarias, una hora menos que Madrid)", async () => {
    const { rows } = await admin.query<{ id: string }>(
      "select id from public.locations where organization_id = $1 and timezone = 'Atlantic/Canary' limit 1",
      [ORG_F],
    );
    await connect(ORG_F, KEY_B, rows[0]?.id ?? null);
    const koibox = await loadKoiboxReader({ db, vault, organizationId: ORG_F, apiBase });
    const [appointment] = (await koibox?.listAppointments({ from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-14T00:00:00Z"), limit: 5 })) ?? [];
    // 10:00 en Canarias = 10:00 UTC en noviembre.
    expect(appointment?.startsAt).toEqual(new Date("2026-11-13T10:00:00Z"));
  });

  it("una clave revocada en Koibox: error «unauthorized», sin la clave en el mensaje", async () => {
    const { rows } = await admin.query<{ id: string }>(
      "select id from public.locations where organization_id = $1 and timezone = 'Atlantic/Canary' limit 1",
      [ORG_F],
    );
    await connect(ORG_F, "kbx_revoked_key_not_secret_01", rows[0]?.id ?? null);
    const koibox = await loadKoiboxReader({ db, vault, organizationId: ORG_F, apiBase });
    const err = await koibox?.listServices().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KoiboxError);
    expect((err as KoiboxError).kind).toBe("unauthorized");
    expect((err as Error).message).not.toContain("kbx_revoked");
  });
});
