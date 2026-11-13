import { describe, expect, it, vi } from "vitest";
import { DEAD_LETTER, errorCode, runAttempts } from "./attempts.ts";

function hooks() {
  return { recordFailure: vi.fn().mockResolvedValue(undefined), sleep: vi.fn().mockResolvedValue(undefined) };
}

describe("los intentos acotados de la entrada", () => {
  it("si sale bien a la primera, ni apunta fallos ni espera", async () => {
    const h = hooks();
    await expect(runAttempts(() => Promise.resolve("ok"), h)).resolves.toEqual({ ok: true, value: "ok", attempts: 1 });
    expect(h.recordFailure).not.toHaveBeenCalled();
    expect(h.sleep).not.toHaveBeenCalled();
  });

  it("cada fallo se apunta con su código y se espera cada vez más antes de reintentar", async () => {
    const h = hooks();
    let calls = 0;
    const flaky = () => {
      calls += 1;
      return calls < 3 ? Promise.reject(Object.assign(new Error("con datos del cliente"), { code: "57014" })) : Promise.resolve("ok");
    };
    await expect(runAttempts(flaky, h, 5, [10, 20, 30])).resolves.toEqual({ ok: true, value: "ok", attempts: 3 });
    expect(h.recordFailure.mock.calls).toEqual([[1, "57014"], [2, "57014"]]);
    expect(h.sleep.mock.calls).toEqual([[10], [20]]);
  });

  it("al agotar los intentos, el último se apunta como dead_letter y no se vuelve a intentar", async () => {
    const h = hooks();
    const always = vi.fn().mockRejectedValue(new TypeError("x"));
    await expect(runAttempts(always, h, 3, [1])).resolves.toEqual({ ok: false, deadLetter: true, attempts: 3, lastError: "TypeError" });
    expect(always).toHaveBeenCalledTimes(3);
    expect(h.recordFailure.mock.calls).toEqual([[1, "TypeError"], [2, "TypeError"], [3, DEAD_LETTER]]);
    expect(h.sleep).toHaveBeenCalledTimes(2);
  });

  it("el código de un error nunca lleva su mensaje", () => {
    expect(errorCode(Object.assign(new Error("email@cliente.test"), { code: "23514" }))).toBe("23514");
    expect(errorCode(new RangeError("datos"))).toBe("RangeError");
    expect(errorCode({ code: "con espacios y datos" })).toBe("Error");
    expect(errorCode(null)).toBe("Error");
  });
});
