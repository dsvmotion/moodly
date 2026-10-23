import { describe, expect, it } from "vitest";
import { appCookieOptions, isHttpsRequest } from "./cookie-options";

describe("cookies propias de la app (R-24)", () => {
  it("Secure solo cuando la petición llegó por https", () => {
    expect(appCookieOptions(true)).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
    expect(appCookieOptions(false)).toMatchObject({ secure: false, httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("detecta https por x-forwarded-proto, como la CSP del proxy", () => {
    expect(isHttpsRequest(new Headers({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isHttpsRequest(new Headers({ "x-forwarded-proto": "http" }))).toBe(false);
    expect(isHttpsRequest(new Headers())).toBe(false);
  });
});
