import { describe, expect, it } from "vitest";
import { config } from "./proxy";

const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

describe("matcher del proxy", () => {
  it.each(["/sw.js", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/icons/apple-touch-icon.png", "/monitoring"])(
    "%s es público: el proxy no lo intercepta",
    (path) => expect(matches(path)).toBe(false),
  );
  it.each(["/", "/app", "/app/settings/general", "/login"])("%s sigue pasando por el proxy", (path) =>
    expect(matches(path)).toBe(true),
  );
});
