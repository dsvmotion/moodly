import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { KEY_SUBMISSION_TTL_MS } from "@repo/config";
import { createServiceDb } from "@repo/db/service";
import { IngressKeyUnavailableError, createLocalIngressKeyring, sealSubmission, type IngressKeyring, type IngressPublicKey } from "@repo/integrations/key-ingress";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLocalKeyProvider, createSecretVault } from "../secrets/vault.ts";
import { localAdminDatabaseUrl, localSupabaseApi, localWorkerDatabaseUrl } from "../testing/local-system-db.ts";
import { applySubmission, attemptUntil, cleanupDisconnected, type KeyVerifier } from "./key-submission.ts";
import { koiboxSecretName } from "./koibox.ts";

// El alta de la clave de Koibox (ADR 0055 §4 y §5) contra Supabase local con el
// seed aplicado y moodly_worker de verdad (RLS, privilegios de columna y las
// guardas de 20261114110000). Los envíos los inserta aquí postgres con el sobre
// de la web y el par local de ingreso; la comprobación contra Koibox es un falso
// en memoria (sus formas, en koibox.integration.ts y en el test del cliente).

const api = localSupabaseApi();
const db = createServiceDb({ url: api.url, secretKey: api.secretKey, workerDatabaseUrl: localWorkerDatabaseUrl() });
const admin = new pg.Client({ connectionString: localAdminDatabaseUrl() });
const vault = createSecretVault(createLocalKeyProvider(randomBytes(32).toString("base64")));

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const INGRESS: IngressPublicKey = { keyRef: "local:v1", spkiDerBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64") };
const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString() }]);

const ORG_A = "5eed0000-0000-4000-8000-00000000000a";
const ORG_B = "5eed0000-0000-4000-8000-00000000000b";
const GOOD_1 = "kbx_good_key_number_one_0001";
const GOOD_2 = "kbx_good_key_number_two_0002";
const GOOD_3 = "kbx_good_key_number_three_003";
const BAD = "kbx_bad_key_not_valid_000000";
const VALID = new Set([GOOD_1, GOOD_2, GOOD_3]);

const verified: string[] = [];
const verify: KeyVerifier = (_provider, apiKey) => {
  verified.push(apiKey);
  return Promise.resolve(VALID.has(apiKey) ? "valid" : "invalid");
};
const deps = { db, keyring, vault, verify };

interface IntegrationState {
  status: string;
  secret_id: string | null;
  last_submission_at: Date | null;
  last_submission_id: string | null;
  last_submission_result: string | null;
}

async function integration(id: string): Promise<IntegrationState> {
  const { rows } = await admin.query<IntegrationState>(
    `select status, secret_id, last_submission_at, last_submission_id, last_submission_result from public.integrations where id = $1`,
    [id],
  );
  if (!rows[0]) throw new Error("no existe la integración");
  return rows[0];
}

async function secret(id: string): Promise<{ ciphertext: string; rotated_at: Date | null; name: string } | null> {
  const { rows } = await admin.query<{ ciphertext: string; rotated_at: Date | null; name: string }>(
    `select ciphertext, rotated_at, name from public.integration_secrets where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function openSecret(org: string, id: string): Promise<string> {
  const { rows } = await admin.query<{ key_ref: string; encrypted_data_key: string; ciphertext: string }>(
    `select key_ref, encrypted_data_key, ciphertext from public.integration_secrets where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new Error("no existe el secreto");
  return vault.open(org, { keyRef: row.key_ref, encryptedDataKey: row.encrypted_data_key, ciphertext: row.ciphertext });
}

async function submissionExists(id: string): Promise<boolean> {
  const { rows } = await admin.query(`select 1 from public.integration_secret_submissions where id = $1`, [id]);
  return rows.length > 0;
}

/** Una integración de Koibox en un estado dado, con su secreto si se pide (como postgres). */
async function koibox(org: string, status: string, withKey?: string, locationId: string | null = null): Promise<{ id: string; secretId: string | null }> {
  let secretId: string | null = null;
  if (withKey) {
    const sealed = await vault.seal(org, withKey);
    const { rows } = await admin.query<{ id: string }>(
      `insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
       values ($1, 'integration', $2, $3, $4, $5) returning id`,
      [org, koiboxSecretName(locationId), sealed.keyRef, sealed.encryptedDataKey, sealed.ciphertext],
    );
    secretId = rows[0]?.id ?? null;
  }
  const { rows } = await admin.query<{ id: string }>(
    `insert into public.integrations (organization_id, location_id, provider, kind, status, secret_id)
     values ($1, $2, 'koibox', 'native', $3, $4) returning id`,
    [org, locationId, status, secretId],
  );
  return { id: rows[0]?.id ?? "", secretId };
}

/** Un envío como lo deja la web: cifrado hacia el worker con su contexto. */
async function submit(org: string, integrationId: string, apiKey: string, options: { id?: string; createdAt?: Date | string; sealFor?: string } = {}): Promise<string> {
  const id = options.id ?? randomUUID();
  const sealed = sealSubmission(INGRESS, { organizationId: org, integrationId: options.sealFor ?? integrationId, submissionId: id, provider: "koibox" }, apiKey);
  await admin.query(
    `insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext, created_at)
     values ($1, $2, $3, 'koibox', $4, $5, $6, $7)`,
    [id, org, integrationId, sealed.keyRef, sealed.encryptedDataKey, sealed.ciphertext, options.createdAt ?? new Date()],
  );
  return id;
}

function input(org: string, integrationId: string, submissionId: string) {
  return { organizationId: org, integrationId, submissionId, provider: "koibox" };
}

async function cleanup() {
  await admin.query("delete from public.integrations where provider = 'koibox' and organization_id = any($1)", [[ORG_A, ORG_B]]);
  await admin.query("delete from public.integration_secrets where name like 'koibox.%' and organization_id = any($1)", [[ORG_A, ORG_B]]);
}

beforeAll(async () => {
  await admin.connect();
});

beforeEach(async () => {
  verified.length = 0;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await admin.end();
  await db.end();
});

describe("primera conexión", () => {
  it("una clave buena: secreto nuevo con el nombre de la integración, activa, marca y envío borrado", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
    const state = await integration(id);
    expect(state.status).toBe("active");
    expect(state.last_submission_id).toBe(sub);
    expect(state.last_submission_result).toBe("applied");
    expect(state.secret_id).not.toBeNull();
    await expect(openSecret(ORG_A, state.secret_id ?? "")).resolves.toBe(GOOD_1);
    expect((await secret(state.secret_id ?? ""))?.name).toBe("koibox.api_key");
    expect(await submissionExists(sub)).toBe(false);
    expect(verified).toEqual([GOOD_1]);
  });

  it("una clave mala: en error, sin secreto, con la marca, y el envío borrado", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, BAD);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "rejected" });
    expect(await integration(id)).toMatchObject({ status: "error", secret_id: null, last_submission_id: sub, last_submission_result: "rejected" });
    expect(await submissionExists(sub)).toBe(false);
  });

  it("una en error y sin secreto acepta un envío nuevo: inserta y activa", async () => {
    const { id } = await koibox(ORG_A, "error");
    const sub = await submit(ORG_A, id, GOOD_2);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
    const state = await integration(id);
    expect(state.status).toBe("active");
    await expect(openSecret(ORG_A, state.secret_id ?? "")).resolves.toBe(GOOD_2);
  });

  it("con local, el secreto lleva el nombre del local", async () => {
    const { rows } = await admin.query<{ id: string }>(`select id from public.locations where organization_id = $1 order by id limit 1`, [ORG_A]);
    const loc = rows[0]?.id ?? "";
    const { id } = await koibox(ORG_A, "pending", undefined, loc);
    const sub = await submit(ORG_A, id, GOOD_1);
    await applySubmission(deps, input(ORG_A, id, sub));
    expect((await secret((await integration(id)).secret_id ?? ""))?.name).toBe(`koibox.${loc}`);
  });
});

describe("un envío movido no se abre", () => {
  it("cifrado para otra integración: no se descifra, no se comprueba y no cambia nada", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { sealFor: randomUUID() });
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "unopenable" });
    expect(verified).toEqual([]);
    expect(await integration(id)).toMatchObject({ status: "pending", secret_id: null, last_submission_id: null });
    // Se queda hasta que caduque (lo borra el workflow a los 15 minutos).
    expect(await submissionExists(sub)).toBe(true);
  });

  it("pedido con otra organización: el worker no lo ve (RLS) y no hace nada", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1);
    await expect(applySubmission(deps, input(ORG_B, id, sub))).resolves.toMatchObject({ outcome: "already_processed" });
    expect(await submissionExists(sub)).toBe(true);
    expect(await integration(id)).toMatchObject({ status: "pending" });
  });

  it("sin claves de ingreso o sin SecretVault: no se abre", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1);
    await expect(applySubmission({ ...deps, keyring: null }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "unopenable" });
    await expect(applySubmission({ ...deps, vault: null }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "unopenable" });
    expect(await submissionExists(sub)).toBe(true);
  });
});

describe("rotar", () => {
  it("una clave buena cambia la clave del mismo secreto (rotated_at), sin insertar otro", async () => {
    const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
    const sub = await submit(ORG_A, id, GOOD_2);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
    const state = await integration(id);
    expect(state.secret_id).toBe(secretId);
    expect(state.last_submission_result).toBe("applied");
    await expect(openSecret(ORG_A, secretId ?? "")).resolves.toBe(GOOD_2);
    expect((await secret(secretId ?? ""))?.rotated_at).not.toBeNull();
    const { rows } = await admin.query(`select 1 from public.integration_secrets where organization_id = $1 and name like 'koibox.%'`, [ORG_A]);
    expect(rows).toHaveLength(1);
  });

  it("una clave mala no cambia ni el estado ni el secreto (sigue la anterior), avanza la marca y borra el envío", async () => {
    const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
    const before = await secret(secretId ?? "");
    const sub = await submit(ORG_A, id, BAD);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "rejected" });
    expect(await integration(id)).toMatchObject({
      status: "active",
      secret_id: secretId,
      last_submission_id: sub,
      last_submission_result: "rejected",
    });
    expect((await secret(secretId ?? ""))?.ciphertext).toBe(before?.ciphertext);
    await expect(openSecret(ORG_A, secretId ?? "")).resolves.toBe(GOOD_1);
    expect(await submissionExists(sub)).toBe(false);
  });
});

describe("dos envíos seguidos (K2, K3) y los reintentos", () => {
  it("K3 se aplica primero y K2 llega después: K2 no escribe y queda K3", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const t = Date.now();
    const k2 = await submit(ORG_A, id, GOOD_2, { createdAt: new Date(t - 2000) });
    const k3 = await submit(ORG_A, id, GOOD_3, { createdAt: new Date(t - 1000) });
    await expect(applySubmission(deps, input(ORG_A, id, k3))).resolves.toMatchObject({ outcome: "applied" });
    await expect(applySubmission(deps, input(ORG_A, id, k2))).resolves.toMatchObject({ outcome: "stale" });
    const state = await integration(id);
    expect(state.last_submission_id).toBe(k3);
    await expect(openSecret(ORG_A, state.secret_id ?? "")).resolves.toBe(GOOD_3);
    expect(await submissionExists(k2)).toBe(false);
  });

  it("en el orden contrario, K3 sustituye a K2", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const t = Date.now();
    const k2 = await submit(ORG_A, id, GOOD_2, { createdAt: new Date(t - 2000) });
    const k3 = await submit(ORG_A, id, GOOD_3, { createdAt: new Date(t - 1000) });
    await applySubmission(deps, input(ORG_A, id, k2));
    await expect(applySubmission(deps, input(ORG_A, id, k3))).resolves.toMatchObject({ outcome: "applied" });
    const state = await integration(id);
    expect(state.last_submission_id).toBe(k3);
    await expect(openSecret(ORG_A, state.secret_id ?? "")).resolves.toBe(GOOD_3);
  });

  it("con el mismo created_at gana el de mayor id", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const at = new Date(Date.now() - 1000);
    const low = await submit(ORG_A, id, GOOD_2, { id: "00000000-0000-4000-8000-000000000001", createdAt: at });
    const high = await submit(ORG_A, id, GOOD_3, { id: "ffffffff-ffff-4fff-bfff-ffffffffffff", createdAt: at });
    await applySubmission(deps, input(ORG_A, id, high));
    await expect(applySubmission(deps, input(ORG_A, id, low))).resolves.toMatchObject({ outcome: "stale" });
    await expect(openSecret(ORG_A, (await integration(id)).secret_id ?? "")).resolves.toBe(GOOD_3);
  });

  it("en el mismo milisegundo, gana el más reciente por µs, no el de mayor id (la marca guarda µs; L1 de V10)", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const ms = new Date(Date.now() - 1000).toISOString().slice(0, 23);
    // El más reciente (µs 900) tiene el id menor: si la marca se truncara a ms, ganaría el otro.
    const newer = await submit(ORG_A, id, GOOD_3, { id: "00000000-0000-4000-8000-000000000002", createdAt: `${ms}900+00` });
    const older = await submit(ORG_A, id, GOOD_2, { id: "ffffffff-ffff-4fff-bfff-fffffffffffe", createdAt: `${ms}100+00` });
    await expect(applySubmission(deps, input(ORG_A, id, newer))).resolves.toMatchObject({ outcome: "applied" });
    await expect(applySubmission(deps, input(ORG_A, id, older))).resolves.toMatchObject({ outcome: "stale" });
    const { rows } = await admin.query<{ exact: boolean }>("select last_submission_at = $2::timestamptz as exact from public.integrations where id = $1", [
      id,
      `${ms}900+00`,
    ]);
    expect(rows[0]?.exact).toBe(true);
    await expect(openSecret(ORG_A, (await integration(id)).secret_id ?? "")).resolves.toBe(GOOD_3);
  });

  it("un envío que se procesa dos veces (reintento de DBOS) solo escribe una vez", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1);
    await applySubmission(deps, input(ORG_A, id, sub));
    const after = await integration(id);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "already_processed" });
    expect(await integration(id)).toEqual(after);
  });

  it("un envío que termina cuando la integración ya está desconectada no escribe nada", async () => {
    const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
    const sub = await submit(ORG_A, id, GOOD_2);
    await admin.query(`update public.integrations set status = 'disconnected' where id = $1`, [id]);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "disconnected" });
    expect(await integration(id)).toMatchObject({ status: "disconnected", secret_id: secretId, last_submission_id: null });
    await expect(openSecret(ORG_A, secretId ?? "")).resolves.toBe(GOOD_1);
  });
});

describe("KMS caído un rato (M1 de V10 en #337)", () => {
  it("la clave de ingreso falla 3 veces (IngressKeyUnavailableError) y el envío acaba aplicado, sin caducar", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1);
    let failures = 3;
    const flaky: IngressKeyring = {
      accepts: (ref) => keyring.accepts(ref),
      unwrap: (ref, edk) => (failures-- > 0 ? Promise.reject(new IngressKeyUnavailableError("KMS no respondió")) : keyring.unwrap(ref, edk)),
    };
    let now = 0;
    const clock = { now: () => Promise.resolve(now), sleep: (ms: number) => ((now += ms), Promise.resolve()) };
    const errors: string[] = [];
    const result = await attemptUntil(() => applySubmission({ ...deps, keyring: flaky }, input(ORG_A, id, sub)), clock, 15 * 60_000, (err) =>
      errors.push(err instanceof Error ? err.name : "?"),
    );
    expect(errors).toEqual(["IngressKeyUnavailableError", "IngressKeyUnavailableError", "IngressKeyUnavailableError"]);
    expect(result).toMatchObject({ outcome: "applied" });
    expect(await integration(id)).toMatchObject({ status: "active", last_submission_id: sub, last_submission_result: "applied" });
    await expect(openSecret(ORG_A, (await integration(id)).secret_id ?? "")).resolves.toBe(GOOD_1);
    expect(await submissionExists(sub)).toBe(false);
  });
});

describe("la caducidad cuenta desde el envío (ADR 0055 §2; nit de V1 en #337)", () => {
  const TTL = 15 * 60_000;

  it("un envío de hace 14 min con KMS caído: se acaba el plazo (created_at + 15 min) y no se aplica", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const createdAt = new Date(Date.now() - 14 * 60_000);
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt });
    const down: IngressKeyring = { accepts: () => true, unwrap: () => Promise.reject(new IngressKeyUnavailableError("KMS no respondió")) };
    let now = Date.now();
    const clock = { now: () => Promise.resolve(now), sleep: (ms: number) => ((now += ms), Promise.resolve()) };
    const result = await attemptUntil(() => applySubmission({ ...deps, keyring: down }, input(ORG_A, id, sub)), clock, createdAt.getTime() + TTL, () => undefined);
    expect(result).toBeNull();
    // Ni un intento más allá del minuto 15 del envío.
    expect(now).toBeLessThan(createdAt.getTime() + TTL);
    expect(await integration(id)).toMatchObject({ status: "pending", secret_id: null, last_submission_id: null });
  });

  it("y si un último intento llega tarde (minuto 16), la transacción no lo aplica: «expired», y el envío se borra", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt: new Date(Date.now() - 16 * 60_000) });
    await expect(applySubmission({ ...deps, ttlMs: TTL }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "expired" });
    expect(await integration(id)).toMatchObject({ status: "pending", secret_id: null, last_submission_id: null, last_submission_result: null });
    expect(await submissionExists(sub)).toBe(false);
    const { rows } = await admin.query("select 1 from public.integration_secrets where organization_id = $1 and name like 'koibox.%'", [ORG_A]);
    expect(rows).toHaveLength(0);
  });

  it("uno de hace 14 min que sí se puede abrir todavía se aplica", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt: new Date(Date.now() - 14 * 60_000) });
    await expect(applySubmission({ ...deps, ttlMs: TTL }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
  });

  it("el plazo de la transacción es el que recibe el worker, no un literal del SQL: con 5 min, uno de hace 10 caduca", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt: new Date(Date.now() - 10 * 60_000) });
    await expect(applySubmission({ ...deps, ttlMs: 5 * 60_000 }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "expired" });
    expect(await integration(id)).toMatchObject({ status: "pending", secret_id: null, last_submission_id: null });
    expect(await submissionExists(sub)).toBe(false);
  });

  it("sin plazo explícito, el del worker es KEY_SUBMISSION_TTL_MS de @repo/config (el mismo de la web): un minuto después, caducado", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt: new Date(Date.now() - KEY_SUBMISSION_TTL_MS - 60_000) });
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "expired" });
  });

  it("y un minuto antes de KEY_SUBMISSION_TTL_MS, sin plazo explícito, todavía se aplica", async () => {
    const { id } = await koibox(ORG_A, "pending");
    const sub = await submit(ORG_A, id, GOOD_1, { createdAt: new Date(Date.now() - KEY_SUBMISSION_TTL_MS + 60_000) });
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
  });
});

describe("desconectar y reconectar", () => {
  it("al desconectar, el worker quita el secret_id y borra el secreto del evento", async () => {
    const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
    await admin.query(`update public.integrations set status = 'disconnected' where id = $1`, [id]);
    await expect(cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: id, secretId: secretId ?? "" })).resolves.toBe(true);
    expect(await integration(id)).toMatchObject({ status: "disconnected", secret_id: null });
    expect(await secret(secretId ?? "")).toBeNull();
  });

  it("si la persona reconectó antes de que llegara el evento, la limpieza igualmente borra el secreto que pidió quitar (y la deja en error)", async () => {
    const { id, secretId } = await koibox(ORG_A, "pending", GOOD_1);
    await expect(cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: id, secretId: secretId ?? "" })).resolves.toBe(true);
    expect(await integration(id)).toMatchObject({ status: "error", secret_id: null });
    expect(await secret(secretId ?? "")).toBeNull();
  });

  it("desconectar, reconectar y un envío nuevo que no llega a procesarse (solo caduca): el secreto viejo no se queda (M1 de V10)", async () => {
    const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
    await admin.query(`update public.integrations set status = 'disconnected' where id = $1`, [id]);
    await admin.query(`update public.integrations set status = 'pending' where id = $1`, [id]);
    const sub = await submit(ORG_A, id, GOOD_2);
    // Sin claves de ingreso (como hoy en staging): el envío no se abre y solo caducaría.
    await expect(applySubmission({ ...deps, keyring: null }, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "unopenable" });
    expect(await secret(secretId ?? "")).not.toBeNull();
    await expect(cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: id, secretId: secretId ?? "" })).resolves.toBe(true);
    expect(await integration(id)).toMatchObject({ status: "error", secret_id: null });
    expect(await secret(secretId ?? "")).toBeNull();
  });

  it("si el envío nuevo ya rotó ese secreto (activa), la limpieza no lo toca", async () => {
    const { id, secretId } = await koibox(ORG_A, "pending", GOOD_1);
    const sub = await submit(ORG_A, id, GOOD_2);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
    await expect(cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: id, secretId: secretId ?? "" })).resolves.toBe(false);
    expect(await integration(id)).toMatchObject({ status: "active", secret_id: secretId });
    await expect(openSecret(ORG_A, secretId ?? "")).resolves.toBe(GOOD_2);
  });

  it("un evento con el secret_id de otra organización no cambia ni borra nada", async () => {
    const { id: idA } = await koibox(ORG_A, "disconnected");
    const { secretId: secretB } = await koibox(ORG_B, "active", GOOD_2);
    await expect(cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: idA, secretId: secretB ?? "" })).resolves.toBe(false);
    expect(await secret(secretB ?? "")).not.toBeNull();
  });

  it("reconexión con el secreto viejo aún enlazado y una clave buena: cambia la clave de ese mismo secreto", async () => {
    const { id, secretId } = await koibox(ORG_A, "pending", GOOD_1);
    const sub = await submit(ORG_A, id, GOOD_2);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "applied" });
    expect(await integration(id)).toMatchObject({ status: "active", secret_id: secretId });
    await expect(openSecret(ORG_A, secretId ?? "")).resolves.toBe(GOOD_2);
  });

  it("reconexión con el secreto viejo y una clave mala: en error, sin secret_id, y el secreto viejo borrado", async () => {
    const { id, secretId } = await koibox(ORG_A, "pending", GOOD_1);
    const sub = await submit(ORG_A, id, BAD);
    await expect(applySubmission(deps, input(ORG_A, id, sub))).resolves.toMatchObject({ outcome: "rejected" });
    expect(await integration(id)).toMatchObject({ status: "error", secret_id: null });
    expect(await secret(secretId ?? "")).toBeNull();
  });

  it("cruce de la rotación con la limpieza (for update): en cualquier orden, ni secretos huérfanos ni activa sin secreto", async () => {
    for (let round = 0; round < 6; round++) {
      await cleanup();
      const { id, secretId } = await koibox(ORG_A, "active", GOOD_1);
      const sub = await submit(ORG_A, id, GOOD_2);
      // La persona desconecta y vuelve a conectar mientras llegan los dos workflows.
      await admin.query(`update public.integrations set status = 'disconnected' where id = $1`, [id]);
      if (round % 2 === 1) await admin.query(`update public.integrations set status = 'pending' where id = $1`, [id]);
      const results = await Promise.all([
        applySubmission(deps, input(ORG_A, id, sub)),
        cleanupDisconnected(db.forOrganization(ORG_A), { organizationId: ORG_A, integrationId: id, secretId: secretId ?? "" }),
      ]);
      const state = await integration(id);
      const { rows: secrets } = await admin.query<{ id: string }>(`select id from public.integration_secrets where organization_id = $1 and name like 'koibox.%'`, [ORG_A]);
      if (state.status === "active") expect(state.secret_id).not.toBeNull();
      // Ningún secreto sin integración que lo enlace.
      for (const s of secrets) expect(s.id).toBe(state.secret_id);
      if (state.secret_id) await expect(openSecret(ORG_A, state.secret_id)).resolves.toMatch(/^kbx_good/);
      expect(results[0].outcome).not.toBe("refused");
    }
  });
});
