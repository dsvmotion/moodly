import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { isTransient, verifyTotp } from "./mfa";

type Result = { data: unknown; error: { status?: number; message: string } | null };

function fakeClient(results: Result[]) {
  const challengeAndVerify = vi.fn(async () => results.shift() ?? { data: null, error: { status: 500, message: "sin más respuestas" } });
  return { client: { auth: { mfa: { challengeAndVerify } } } as unknown as SupabaseClient, challengeAndVerify };
}

const ok: Result = { data: {}, error: null };
const deadlock: Result = { data: null, error: { status: 500, message: "deadlock detected" } };
const badCode: Result = { data: null, error: { status: 422, message: "Invalid TOTP code entered" } };
const noSleep = { sleep: async () => {} };

describe("verifyTotp", () => {
  it("un fallo transitorio (5xx) se reintenta hasta que pasa", async () => {
    const { client, challengeAndVerify } = fakeClient([deadlock, deadlock, ok]);
    const { error } = await verifyTotp(client, "factor", "123456", noSleep);
    expect(error).toBeNull();
    expect(challengeAndVerify).toHaveBeenCalledTimes(3);
  });

  it("un código incorrecto (4xx) no se reintenta", async () => {
    const { client, challengeAndVerify } = fakeClient([badCode, ok]);
    const { error } = await verifyTotp(client, "factor", "123456", noSleep);
    expect(error?.status).toBe(422);
    expect(challengeAndVerify).toHaveBeenCalledTimes(1);
  });

  it("deja de reintentar tras el número máximo de intentos", async () => {
    const { client, challengeAndVerify } = fakeClient([deadlock, deadlock, deadlock, deadlock, ok]);
    const { error } = await verifyTotp(client, "factor", "123456", { ...noSleep, attempts: 4 });
    expect(error && isTransient(error)).toBe(true);
    expect(challengeAndVerify).toHaveBeenCalledTimes(4);
  });

  it("sin status cuenta como transitorio (fallo de red)", () => {
    expect(isTransient({})).toBe(true);
    expect(isTransient({ status: 429 })).toBe(false);
  });
});
