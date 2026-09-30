import { describe, expect, it } from "vitest";
import { assertLocalSupabaseUrl } from "./local-only.ts";

describe("assertLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])("acepta %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).not.toThrow();
  });

  it.each([
    "https://abcdefghijklmnop.supabase.co",
    "https://db.example.com",
    "http://127.0.0.1.evil.test:54321",
    "http://localhost@evil.test:54321",
    "http://localhost.evil.test",
    "http://10.0.0.5:54321",
    "no-es-una-url",
    "",
  ])("rechaza %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow();
  });
});
