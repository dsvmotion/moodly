import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co/",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  VERCEL_GIT_COMMIT_SHA: "3f2c1ab9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("checkHealth", () => {
  it("200 si la API responde 'permission denied' de Postgres a anon (lo normal: anon no ve tablas)", async () => {
    const doFetch = vi.fn(async () => json(401, { code: "42501", message: "permission denied for table organizations" }));
    const result = await checkHealth({ env, fetch: doFetch as unknown as typeof fetch });
    expect(result).toEqual({ httpStatus: 200, body: { status: "ok", checks: { database: "ok" }, version: "3f2c1ab" } });
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ref.supabase.co/rest/v1/organizations?select=id&limit=1");
    expect(init.headers).toEqual({ apikey: "sb_publishable_test" });
  });

  it("200 también con una respuesta vacía correcta", async () => {
    const result = await checkHealth({ env, fetch: (async () => json(200, [])) as unknown as typeof fetch });
    expect(result.httpStatus).toBe(200);
  });

  it.each([500, 502, 503, 504])("503 si la API responde %i", async (status) => {
    const result = await checkHealth({ env, fetch: (async () => json(status, { message: "boom" })) as unknown as typeof fetch });
    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({ status: "degraded", checks: { database: "fail" } });
  });

  it("503 ante una clave que Supabase rechaza (401 sin código de Postgres)", async () => {
    const result = await checkHealth({ env, fetch: (async () => json(401, { message: "Invalid API key" })) as unknown as typeof fetch });
    expect(result.httpStatus).toBe(503);
  });

  it("503 si la red falla o el tiempo se agota", async () => {
    const result = await checkHealth({
      env,
      fetch: (async () => {
        throw new Error("fetch failed");
      }) as unknown as typeof fetch,
    });
    expect(result.httpStatus).toBe(503);
  });

  it("503 sin variables de Supabase, sin llamar a nadie", async () => {
    const doFetch = vi.fn();
    const result = await checkHealth({ env: {}, fetch: doFetch as unknown as typeof fetch });
    expect(result.httpStatus).toBe(503);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("no filtra la URL, la clave ni errores en el cuerpo", async () => {
    const result = await checkHealth({ env, fetch: (async () => json(500, { message: "secreto" })) as unknown as typeof fetch });
    const text = JSON.stringify(result.body);
    expect(text).not.toMatch(/supabase|sb_publishable|secreto/);
  });
});
