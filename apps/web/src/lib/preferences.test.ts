import { describe, expect, it } from "vitest";
import { isActive } from "./navigation";
import { parseSidebarCollapsed, parseTheme, themeAttribute } from "./preferences";

describe("preferencias", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    ["DARK", "system"],
    ["", "system"],
    [undefined, "system"],
    ["<script>", "system"],
  ])("parseTheme(%j) = %j", (value, expected) => {
    expect(parseTheme(value)).toBe(expected);
  });

  it("el tema del sistema no fija data-theme", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("light")).toBe("light");
  });

  it("barra lateral compacta solo con '1'", () => {
    expect(parseSidebarCollapsed("1")).toBe(true);
    expect(parseSidebarCollapsed("0")).toBe(false);
    expect(parseSidebarCollapsed(undefined)).toBe(false);
  });
});

describe("isActive", () => {
  it("Inicio solo coincide con /app exacto", () => {
    expect(isActive("/app", "/app")).toBe(true);
    expect(isActive("/app/inbox", "/app")).toBe(false);
  });

  it("una sección coincide consigo misma y sus subrutas, no con prefijos parecidos", () => {
    expect(isActive("/app/records/locations", "/app/records/locations")).toBe(true);
    expect(isActive("/app/records/locations/abc", "/app/records/locations")).toBe(true);
    expect(isActive("/app/records/locationsx", "/app/records/locations")).toBe(false);
  });

  it("Ajustes coincide con cualquier subruta de /app/settings", () => {
    expect(isActive("/app/settings/organization", "/app/settings/organization")).toBe(true);
    expect(isActive("/app/settings/users", "/app/settings/organization")).toBe(true);
  });
});
