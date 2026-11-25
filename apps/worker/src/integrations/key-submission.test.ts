import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import type { ServiceDb, TenantSql } from "@repo/db/service";
import { IngressKeyUnavailableError, createLocalIngressKeyring, sealSubmission } from "@repo/integrations/key-ingress";
import { describe, expect, it, vi } from "vitest";
import { createLocalKeyProvider, createSecretVault } from "../secrets/vault.ts";
import { APPLY_RETRY_DELAYS_MS, applySubmission, attemptUntil, createKoiboxVerifier, keySubmissionWorkflowId } from "./key-submission.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString() }]);
const vault = createSecretVault(createLocalKeyProvider(randomBytes(32).toString("base64")));
const KEY = "kbx_unit_test_key_0000001";

function fakeDb(onWrite: (sql: string) => unknown) {
  const ctx = { organizationId: randomUUID(), integrationId: randomUUID(), submissionId: randomUUID(), provider: "koibox" };
  const sealed = sealSubmission(
    { keyRef: "local:v1", spkiDerBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    ctx,
    KEY,
  );
  let call = 0;
  const transaction = vi.fn(<T>(fn: (sql: TenantSql) => Promise<T>): Promise<T> => {
    call += 1;
    if (call === 1) {
      const sql: TenantSql = {
        query: <R>() =>
          Promise.resolve([{ key_ref: sealed.keyRef, encrypted_data_key: sealed.encryptedDataKey, ciphertext: sealed.ciphertext, created_at: new Date() }] as R[]),
      };
      return fn(sql);
    }
    const sql: TenantSql = { query: (text: string) => Promise.reject(onWrite(text) as Error) };
    return fn(sql);
  });
  const db = { forOrganization: () => ({ transaction }) } as unknown as ServiceDb;
  return { db, ctx, transaction };
}

describe("applySubmission", () => {
  it("un 42501 de las guardas es un rechazo definitivo: no lanza (DBOS no lo reintenta) y dice «refused» (nota de V10)", async () => {
    const refusal = Object.assign(new Error("una integración desconectada no recibe un secreto"), { code: "42501" });
    const { db, ctx } = fakeDb(() => refusal);
    await expect(applySubmission({ db, keyring, vault, verify: () => Promise.resolve("valid") }, ctx)).resolves.toMatchObject({ outcome: "refused" });
  });

  it("otro fallo de la base de datos sí se lanza: el paso lo reintenta", async () => {
    const { db, ctx } = fakeDb(() => Object.assign(new Error("connection reset"), { code: "08006" }));
    await expect(applySubmission({ db, keyring, vault, verify: () => Promise.resolve("valid") }, ctx)).rejects.toThrow("connection reset");
  });

  it("un fallo pasajero del proveedor se lanza (el paso lo reintenta) y no toca la base de datos", async () => {
    const { db, ctx, transaction } = fakeDb(() => new Error("no debería escribir"));
    await expect(applySubmission({ db, keyring, vault, verify: () => Promise.reject(new Error("503")) }, ctx)).rejects.toThrow("503");
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("si la clave de ingreso no responde (KMS), se lanza para reintentar: ni «unopenable» ni comprobación", async () => {
    const { db, ctx } = fakeDb(() => new Error("no debería escribir"));
    const verify = vi.fn();
    const down = { accepts: () => true, unwrap: () => Promise.reject(new IngressKeyUnavailableError("KMS no respondió")) };
    await expect(applySubmission({ db, keyring: down, vault, verify }, ctx)).rejects.toBeInstanceOf(IngressKeyUnavailableError);
    expect(verify).not.toHaveBeenCalled();
  });

  it("un proveedor que el worker no sabe comprobar no se abre", async () => {
    const { db, ctx } = fakeDb(() => new Error("no debería escribir"));
    const verify = vi.fn();
    await expect(applySubmission({ db, keyring, vault, verify }, { ...ctx, provider: "otro" })).resolves.toMatchObject({ outcome: "unopenable" });
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("createKoiboxVerifier", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("200 vale; solo 401 y 403 dicen que la clave no vale; 404, 400, 5xx y sin respuesta se lanzan (no son culpa de la clave)", async () => {
    const verifier = (response: () => Response) =>
      createKoiboxVerifier({ apiBase: "https://api.koibox.cloud", fetch: () => Promise.resolve(response()) })("koibox", KEY);
    await expect(verifier(() => json(200, { name: "Moodly", centro: 1, centro_slug: "demo" }))).resolves.toBe("valid");
    for (const status of [401, 403]) await expect(verifier(() => json(status, {}))).resolves.toBe("invalid");
    for (const status of [404, 400]) await expect(verifier(() => json(status, {}))).rejects.toThrow();
    await expect(verifier(() => json(503, {}))).rejects.toThrow();
    await expect(
      createKoiboxVerifier({ apiBase: "https://api.koibox.cloud", fetch: () => Promise.reject(new TypeError("fetch failed")) })("koibox", KEY),
    ).rejects.toThrow();
  });

  it("solo sabe comprobar Koibox", async () => {
    await expect(createKoiboxVerifier({ apiBase: "https://api.koibox.cloud", fetch: vi.fn() })("otro", KEY)).rejects.toThrow(/otro/);
  });
});

it("el ID del workflow es solo el id del envío", () => {
  const id = randomUUID();
  expect(keySubmissionWorkflowId(id)).toBe(`key-submission:${id}`);
});

describe("attemptUntil (M1 de V10 en #337)", () => {
  function fakeClock(start = 0) {
    let now = start;
    const slept: number[] = [];
    return {
      clock: { now: () => Promise.resolve(now), sleep: (ms: number) => ((slept.push(ms), (now += ms)), Promise.resolve()) },
      slept,
    };
  }

  it("una caída de unos minutos no descarta el envío: reintenta con pausas crecientes y acaba bien", async () => {
    const { clock, slept } = fakeClock();
    let calls = 0;
    const attempt = () => (++calls <= 4 ? Promise.reject(new IngressKeyUnavailableError("KMS no respondió")) : Promise.resolve("applied"));
    const errors: number[] = [];
    await expect(attemptUntil(attempt, clock, 15 * 60_000, (_e, n) => errors.push(n))).resolves.toBe("applied");
    expect(slept).toEqual([15_000, 30_000, 60_000, 120_000]);
    expect(errors).toEqual([1, 2, 3, 4]);
  });

  it("la pausa se queda en la última (2 min) y para antes de pasar la caducidad: null", async () => {
    const { clock, slept } = fakeClock();
    const attempt = vi.fn(() => Promise.reject(new Error("caído")));
    await expect(attemptUntil(attempt, clock, 15 * 60_000, () => undefined)).resolves.toBeNull();
    expect(slept.slice(0, 4)).toEqual([...APPLY_RETRY_DELAYS_MS]);
    expect(new Set(slept.slice(4))).toEqual(new Set([120_000]));
    expect(slept.reduce((a, b) => a + b, 0)).toBeLessThan(15 * 60_000);
    expect(attempt).toHaveBeenCalledTimes(slept.length + 1);
  });

  it("a la primera, sin esperar", async () => {
    const { clock, slept } = fakeClock();
    await expect(attemptUntil(() => Promise.resolve(1), clock, 1000, () => undefined)).resolves.toBe(1);
    expect(slept).toEqual([]);
  });
});
