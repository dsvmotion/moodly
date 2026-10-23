import { describe, expect, it } from "vitest";
import { assertLocalSupabaseUrl } from "./local-only.ts";

describe("assertLocalSupabaseUrl", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  ])("acepta %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).not.toThrow();
  });

  it.each([
    "https://abcdefghijklmnop.supabase.co",
    "https://db.example.com",
    "http://127.0.0.1.evil.test:54321",
    "http://localhost@evil.test:54321",
    "http://localhost.evil.test",
    "http://10.0.0.5:54321",
    "postgresql://postgres:secreto@db.abcdefghijklmnop.supabase.co:5432/postgres",
    "postgresql://postgres:secreto@127.0.0.1.evil.test:5432/postgres",
    "no-es-una-url",
    "",
  ])("rechaza %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow();
  });

  it("el error no incluye la URL (una de Postgres lleva la contraseña)", () => {
    expect(() => assertLocalSupabaseUrl("postgresql://postgres:secreto@db.example.com:5432/postgres")).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("secreto") }),
    );
    expect(() => assertLocalSupabaseUrl("postgresql://postgres:secreto@[mal")).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("secreto") }),
    );
  });
});
