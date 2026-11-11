import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  formatLocalTime,
  needsZoneLabel,
  validTimeZone,
  zoneForLocation,
  type ZonedLocation,
} from "./time-zone";

// Auditoría de preproducción, M-08, y decisión de producto del 2026-11-10: cada
// hora va en la zona de su local, con la zona escrita al lado cuando la
// organización tiene más de una o cuando quien mira está en otra zona.

const madrid: ZonedLocation = { id: "l1", name: "Madrid Centro", regionId: "rn", timeZone: "Europe/Madrid" };
const bilbao: ZonedLocation = { id: "l2", name: "Bilbao", regionId: "rn", timeZone: "Europe/Madrid" };
const canarias: ZonedLocation = { id: "l3", name: "Las Palmas", regionId: "rs", timeZone: "Atlantic/Canary" };

describe("validTimeZone", () => {
  it("deja pasar una zona IANA", () => {
    expect(validTimeZone("Atlantic/Canary")).toBe("Atlantic/Canary");
    expect(validTimeZone("UTC")).toBe("UTC");
  });

  it.each([null, undefined, "", "Marte/Olympus", "GMT+99", 42])(
    "%j no es una zona: se usa la de por defecto de los locales",
    (value) => {
      expect(validTimeZone(value)).toBe(DEFAULT_TIME_ZONE);
    },
  );
});

describe("zoneForLocation", () => {
  const locations = [madrid, bilbao, canarias];

  it("lo de un local, en la zona de ese local", () => {
    expect(zoneForLocation("l3", { kind: "all" }, locations)).toBe("Atlantic/Canary");
    expect(zoneForLocation("l1", { kind: "location", locationId: "l3" }, locations)).toBe("Europe/Madrid");
  });

  it("lo de toda la organización, en la zona del local elegido en el selector", () => {
    expect(zoneForLocation(null, { kind: "location", locationId: "l3" }, locations)).toBe("Atlantic/Canary");
  });

  it("con una región, la del primer local de la región por nombre", () => {
    expect(zoneForLocation(null, { kind: "region", regionId: "rs" }, locations)).toBe("Atlantic/Canary");
    expect(zoneForLocation(null, { kind: "region", regionId: "rn" }, locations)).toBe("Europe/Madrid");
  });

  it("con toda la organización, la del primer local por nombre", () => {
    expect(zoneForLocation(null, { kind: "all" }, locations)).toBe("Europe/Madrid");
    expect(zoneForLocation(null, { kind: "all" }, [madrid, canarias])).toBe("Atlantic/Canary");
  });

  it("sin locales, o con un local que no se ve, la de por defecto", () => {
    expect(zoneForLocation(null, { kind: "all" }, [])).toBe(DEFAULT_TIME_ZONE);
    expect(zoneForLocation("otro", { kind: "all" }, locations)).toBe(DEFAULT_TIME_ZONE);
  });
});

describe("needsZoneLabel", () => {
  it("con una sola zona en la organización no hace falta escribirla", () => {
    expect(needsZoneLabel([madrid, bilbao])).toBe(false);
    expect(needsZoneLabel([])).toBe(false);
  });

  it("con más de una zona, siempre", () => {
    expect(needsZoneLabel([madrid, bilbao, canarias])).toBe(true);
  });
});

describe("formatLocalTime", () => {
  // 09:30 en UTC el 10 de noviembre de 2026: 10:30 en Madrid y 09:30 en Canarias.
  const instant = "2026-11-10T09:30:00Z";

  it("escribe la hora en la zona del local, no en la del servidor", () => {
    expect(formatLocalTime(instant, { locale: "es", timeZone: "Europe/Madrid", withZone: false })).toBe("10/11/26, 10:30");
    expect(formatLocalTime(instant, { locale: "es", timeZone: "Atlantic/Canary", withZone: false })).toBe("10/11/26, 9:30");
  });

  it("con la zona al lado cuando se pide", () => {
    expect(formatLocalTime(instant, { locale: "es", timeZone: "Europe/Madrid", withZone: true })).toBe("10/11/26, 10:30 CET");
    expect(formatLocalTime(instant, { locale: "es", timeZone: "Atlantic/Canary", withZone: true })).toBe("10/11/26, 9:30 WET");
    // En inglés, entre la hora y «AM» va un espacio estrecho según la versión de ICU.
    expect(formatLocalTime(instant, { locale: "en", timeZone: "Atlantic/Canary", withZone: true })).toMatch(
      /^11\/10\/26, 9:30\sAM GMT\+0$/,
    );
  });

  it("respeta el horario de verano de cada zona", () => {
    // 1 de julio a las 09:30 UTC: 11:30 en Madrid (CEST).
    expect(formatLocalTime("2026-07-01T09:30:00Z", { locale: "es", timeZone: "Europe/Madrid", withZone: true })).toBe(
      "1/7/26, 11:30 CEST",
    );
  });
});
