import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createLocalIngressKeyring, openSubmission, type SealedSubmission } from "@repo/integrations/key-ingress";
import { describe, expect, it, vi } from "vitest";
import { insertErrorFor, submissionResult, submitKeyFlow, type KeyIntegrationStore } from "./key-flow";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PUBLIC = { keyRef: "local:v1", spkiDerBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64") };
const keyring = createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString() }]);
const KEY = "kbx_web_flow_test_0001";
const ORG = randomUUID();

function fakeStore(row: { id: string; status: string } | null, insert: "ok" | "too_many" | "not_allowed" = "ok") {
  const submissions: { id: string; integrationId: string; sealed: SealedSubmission }[] = [];
  const store = {
    find: vi.fn(() => Promise.resolve(row)),
    insertPending: vi.fn(() => Promise.resolve("new-integration")),
    setPending: vi.fn(() => Promise.resolve(true)),
    insertSubmission: vi.fn((s: { id: string; integrationId: string; sealed: SealedSubmission }) => {
      submissions.push(s);
      return Promise.resolve(insert);
    }),
    markDisconnected: vi.fn(() => Promise.resolve(true)),
  } satisfies KeyIntegrationStore;
  return { store, submissions };
}

const context = (submissionId = randomUUID()) => ({ organizationId: ORG, provider: "koibox", submissionId });

describe("submitKeyFlow", () => {
  it("primera conexión: crea la integración pendiente e inserta el envío cifrado hacia el worker", async () => {
    const { store, submissions } = fakeStore(null);
    const ctx = context();
    await expect(submitKeyFlow(store, PUBLIC, ctx, KEY)).resolves.toEqual({
      ok: true,
      integrationId: "new-integration",
      submissionId: ctx.submissionId,
    });
    expect(store.insertPending).toHaveBeenCalledOnce();
    const [sent] = submissions;
    if (!sent) throw new Error("no insertó el envío");
    expect(sent.id).toBe(ctx.submissionId);
    expect(JSON.stringify(sent)).not.toContain(KEY);
    // El worker lo abre con el contexto que pone el servidor…
    await expect(
      openSubmission(keyring, { organizationId: ORG, integrationId: "new-integration", submissionId: ctx.submissionId, provider: "koibox" }, sent.sealed),
    ).resolves.toBe(KEY);
    // …y no con otro.
    await expect(
      openSubmission(keyring, { organizationId: randomUUID(), integrationId: "new-integration", submissionId: ctx.submissionId, provider: "koibox" }, sent.sealed),
    ).rejects.toThrow();
  });

  it.each(["active", "pending", "error"])("una integración %s recibe la clave nueva sin cambiar de estado (rotar o reintentar)", async (status) => {
    const { store } = fakeStore({ id: "i1", status });
    await expect(submitKeyFlow(store, PUBLIC, context(), KEY)).resolves.toMatchObject({ ok: true, integrationId: "i1" });
    expect(store.insertPending).not.toHaveBeenCalled();
    expect(store.setPending).not.toHaveBeenCalled();
  });

  it("una desconectada vuelve a pendiente antes del envío (reconectar)", async () => {
    const { store } = fakeStore({ id: "i1", status: "disconnected" });
    await expect(submitKeyFlow(store, PUBLIC, context(), KEY)).resolves.toMatchObject({ ok: true, integrationId: "i1" });
    expect(store.setPending).toHaveBeenCalledWith("i1");
  });

  it("una clave con mala forma no toca nada", async () => {
    for (const bad of ["", "corta", "con espacios 123456", "x".repeat(513)]) {
      const { store } = fakeStore(null);
      await expect(submitKeyFlow(store, PUBLIC, context(), bad)).resolves.toEqual({ ok: false, error: "invalid_key" });
      expect(store.find).not.toHaveBeenCalled();
      expect(store.insertSubmission).not.toHaveBeenCalled();
    }
  });

  it("sin permiso (RLS no deja crear la fila, ni reconectarla) no inserta el envío", async () => {
    const a = fakeStore(null);
    a.store.insertPending.mockResolvedValue(null as unknown as string);
    await expect(submitKeyFlow(a.store, PUBLIC, context(), KEY)).resolves.toEqual({ ok: false, error: "not_allowed" });
    expect(a.store.insertSubmission).not.toHaveBeenCalled();
    const b = fakeStore({ id: "i1", status: "disconnected" });
    b.store.setPending.mockResolvedValue(false);
    await expect(submitKeyFlow(b.store, PUBLIC, context(), KEY)).resolves.toMatchObject({ ok: false, error: "not_allowed" });
    expect(b.store.insertSubmission).not.toHaveBeenCalled();
  });

  it("un estado desconocido no recibe clave", async () => {
    const { store } = fakeStore({ id: "i1", status: "otro" });
    await expect(submitKeyFlow(store, PUBLIC, context(), KEY)).resolves.toMatchObject({ ok: false, error: "not_allowed" });
    expect(store.insertSubmission).not.toHaveBeenCalled();
  });

  it("el freno de la base de datos llega como «too_many»", async () => {
    const { store } = fakeStore({ id: "i1", status: "active" }, "too_many");
    await expect(submitKeyFlow(store, PUBLIC, context(), KEY)).resolves.toEqual({ ok: false, error: "too_many", integrationId: "i1" });
  });

  it("los errores no llevan la clave", async () => {
    const { store } = fakeStore({ id: "i1", status: "active" }, "not_allowed");
    const outcome = await submitKeyFlow(store, PUBLIC, context(), KEY);
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });
});

describe("submissionResult", () => {
  const id = randomUUID();
  it("mientras la marca no apunte a este envío, se sigue comprobando", () => {
    expect(submissionResult(null, id)).toBe("checking");
    expect(submissionResult({ last_submission_id: null, last_submission_result: null }, id)).toBe("checking");
    expect(submissionResult({ last_submission_id: randomUUID(), last_submission_result: "applied" }, id)).toBe("checking");
  });
  it("cuando apunta, su resultado", () => {
    expect(submissionResult({ last_submission_id: id, last_submission_result: "applied" }, id)).toBe("applied");
    expect(submissionResult({ last_submission_id: id, last_submission_result: "rejected" }, id)).toBe("rejected");
  });
});

it("SQLSTATE 54000 (el freno) es «too_many»; lo demás, «not_allowed»", () => {
  expect(insertErrorFor("54000")).toBe("too_many");
  expect(insertErrorFor("42501")).toBe("not_allowed");
  expect(insertErrorFor(undefined)).toBe("not_allowed");
});
