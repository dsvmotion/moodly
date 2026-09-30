import { describe, expect, it } from "vitest";
import { isCommandPaletteShortcut, isEditableTarget, isSearchShortcut, type ShortcutEvent } from "./keyboard";

const target = (tagName: string, attrs: Record<string, string> = {}, isContentEditable = false): EventTarget =>
  ({ tagName, isContentEditable, getAttribute: (name: string) => attrs[name] ?? null }) as unknown as EventTarget;

const event = (overrides: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: "",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  target: target("body"),
  ...overrides,
});

describe("isEditableTarget", () => {
  it.each([
    [target("input"), true],
    [target("input", { type: "search" }), true],
    [target("input", { type: "checkbox" }), false],
    [target("textarea"), true],
    [target("select"), true],
    [target("div", {}, true), true],
    [target("div", { role: "textbox" }), true],
    [target("button"), false],
    [null, false],
  ])("%j → %s", (value, expected) => {
    expect(isEditableTarget(value)).toBe(expected);
  });
});

describe("isCommandPaletteShortcut", () => {
  it("⌘K y Ctrl+K, también escribiendo", () => {
    expect(isCommandPaletteShortcut(event({ key: "k", metaKey: true }))).toBe(true);
    expect(isCommandPaletteShortcut(event({ key: "K", ctrlKey: true }))).toBe(true);
    expect(isCommandPaletteShortcut(event({ key: "k", metaKey: true, target: target("input") }))).toBe(true);
  });

  it("no con otra tecla ni con modificadores extra", () => {
    expect(isCommandPaletteShortcut(event({ key: "k" }))).toBe(false);
    expect(isCommandPaletteShortcut(event({ key: "j", metaKey: true }))).toBe(false);
    expect(isCommandPaletteShortcut(event({ key: "k", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isCommandPaletteShortcut(event({ key: "k", ctrlKey: true, altKey: true }))).toBe(false);
  });
});

describe("isSearchShortcut", () => {
  it("/ fuera de campos de texto", () => {
    expect(isSearchShortcut(event({ key: "/" }))).toBe(true);
    expect(isSearchShortcut(event({ key: "/", target: target("button") }))).toBe(true);
  });

  it("no mientras se escribe ni con modificadores", () => {
    expect(isSearchShortcut(event({ key: "/", target: target("input") }))).toBe(false);
    expect(isSearchShortcut(event({ key: "/", target: target("textarea") }))).toBe(false);
    expect(isSearchShortcut(event({ key: "/", metaKey: true }))).toBe(false);
  });
});
