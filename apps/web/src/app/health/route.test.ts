import { describe, expect, it, vi } from "vitest";

describe("GET /health", () => {
  it("responde el JSON de salud con el código que toca y sin caché", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "degraded" });
    vi.unstubAllEnvs();
  });
});
