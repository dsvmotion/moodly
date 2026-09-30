import { describe, expect, it } from "vitest";
import { formatCount } from "./count";

describe("formatCount", () => {
  it.each([
    [undefined, null],
    [null, null],
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [1, "1"],
    [12, "12"],
    [99, "99"],
    [100, "99+"],
    [4.7, "4"],
  ])("%s → %j", (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });
});
