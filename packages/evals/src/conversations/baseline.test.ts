import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBaseline, parseBaseline, readWithBaseline } from "./baseline.js";
import { conversationCases } from "./cases.js";
import { parse } from "./cli.js";
import { score, scriptedTransport } from "./runner.js";
import type { ConversationCase, ScriptStep } from "./runner.js";
import type { ModelTransport } from "@repo/agent-core";
import { runSet } from "./runset.js";
import { CABINA_1, LASER } from "./world.js";

// La línea base de K-01: no cambia la puntuación (la regla de producto de las
// 3 corridas sigue entera); solo dice si el rojo es de fallos conocidos.

const BASELINE = fileURLToPath(new URL("../../baseline.json", import.meta.url));
const quiet = () => undefined;
const known = (reason = "Falla por un motivo conocido que arregla otra sesión.", tracking = "#155") => ({ reason, tracking });
const byId = (id: string): ConversationCase => {
  const found = conversationCases.find((c) => c.id === id);
  if (!found) throw new Error(`no existe ${id}`);
  return found;
};
/** Un modelo que repite el mismo guion en cada corrida (también en las de confirmación). */
function everyRun(steps: ScriptStep[]): ModelTransport {
  let inner = scriptedTransport(steps);
  let n = 0;
  return {
    ...inner,
    generate(request) {
      if (n > 0 && n % steps.length === 0) inner = scriptedTransport(steps);
      n += 1;
      return inner.generate(request);
    },
  };
}
/** Un modelo que vuelve a pedir la cita: falla recepcion-no-duplica-solicitud en todas sus corridas. */
const rebook = () =>
  everyRun([
    { call: [{ name: "book_appointment", args: { service_id: LASER, resource_id: CABINA_1, starts_at: "2030-06-03T11:00:00+02:00" } }] },
    { say: "La he vuelto a pedir; una persona del equipo la confirmará." },
  ]);

describe("la línea base", () => {
  it("la del repo es válida: sus casos existen, ninguno es de seguridad y cada uno lleva su motivo y dónde se sigue", () => {
    const baseline = loadBaseline(BASELINE, conversationCases);
    expect(Object.keys(baseline.knownFailures)).toEqual(["recepcion-no-duplica-solicitud"]);
    expect(JSON.parse(readFileSync(BASELINE, "utf8"))).toEqual(baseline);
  });

  it("rechaza un caso de seguridad, un caso que no existe, sin motivo, sin issue o PR, y otras claves", () => {
    expect(() => parseBaseline({ knownFailures: { "recepcion-ya-esta-confirmada": known() } }, conversationCases)).toThrow(/seguridad/);
    expect(() => parseBaseline({ knownFailures: { "no-existe": known() } }, conversationCases)).toThrow(/no existe/);
    expect(() => parseBaseline({ knownFailures: { "recepcion-no-duplica-solicitud": known("") } }, conversationCases)).toThrow(/motivo/);
    expect(() => parseBaseline({ knownFailures: { "recepcion-no-duplica-solicitud": known(undefined, "mañana") } }, conversationCases)).toThrow(/issue o su PR/);
    expect(() => parseBaseline({ knownFailures: { "recepcion-no-duplica-solicitud": known(undefined, "https://example.com/x/pull/1") } }, conversationCases)).toThrow(/issue o su PR/);
    expect(parseBaseline({ knownFailures: { "recepcion-no-duplica-solicitud": known(undefined, "https://github.com/dsvmotion/moodly/issues/7") } }, conversationCases).knownFailures).toHaveProperty("recepcion-no-duplica-solicitud");
    expect(() => parseBaseline({ knownFailures: {}, thresholds: { behavior: 0.5 } }, conversationCases)).toThrow();
  });

  it("un fallo conocido sigue contando: se confirma con 3 corridas y bloquea; la línea base solo dice que el rojo es suyo", async () => {
    const failing = await runSet([byId("recepcion-no-duplica-solicitud")], { repeat: 1, model: null, transport: rebook(), out: quiet });
    expect(failing.runs).toHaveLength(3);
    const passing = await runSet([byId("recepcion-reservar")], { repeat: 1, model: null, out: quiet });
    const runs = [...failing.runs, ...passing.runs];
    const baseline = { knownFailures: { "recepcion-no-duplica-solicitud": known() } };

    // La puntuación es la misma con o sin línea base: rojo.
    expect(score(runs).behavior).toMatchObject({ ok: false, alwaysFailing: ["recepcion-no-duplica-solicitud"] });
    const reading = readWithBaseline(runs, baseline);
    expect(reading.onlyKnown).toBe(true);
    expect(reading.known).toEqual([{ id: "recepcion-no-duplica-solicitud", ...known(), passed: 0, runs: 3 }]);

    // Sin línea base, ese mismo rojo no se cuenta como conocido.
    expect(readWithBaseline(runs, { knownFailures: {} }).onlyKnown).toBe(false);
  });

  it("si además falla otro caso que no está en la línea base, el rojo ya no es solo de fallos conocidos", async () => {
    const duplica = await runSet([byId("recepcion-no-duplica-solicitud")], { repeat: 1, model: null, transport: rebook(), out: quiet });
    const reservar = await runSet([byId("recepcion-reservar")], { repeat: 1, model: null, transport: scriptedTransport([{ say: "Hecho, ya está reservada." }]), out: quiet });
    const reading = readWithBaseline([...duplica.runs, ...reservar.runs], { knownFailures: { "recepcion-no-duplica-solicitud": known() } });
    expect(reading.onlyKnown).toBe(false);
  });

  it("una corrida en verde no es «solo conocidos»", async () => {
    const ok = await runSet([byId("recepcion-reservar")], { repeat: 1, model: null, out: quiet });
    expect(readWithBaseline(ok.runs, { knownFailures: { "recepcion-no-duplica-solicitud": known() } })).toEqual({ known: [], onlyKnown: false });
  });

  it("--baseline lleva la ruta del archivo", () => {
    expect(parse(["--baseline", "baseline.json"]).baseline).toBe("baseline.json");
    expect(parse([]).baseline).toBeNull();
  });
});
