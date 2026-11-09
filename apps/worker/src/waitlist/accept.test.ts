import { describe, expect, it } from "vitest";
import { APPROVAL_TTL_MS } from "../agents/approvals.ts";
import { acceptanceKey, acceptanceText, acceptedEntry, holdUntil, isYes } from "./accept.ts";

const ENTRY = "c5000000-0000-4000-8000-000000000001";
const MESSAGE = "e1000000-0000-4000-8000-000000000001";

describe("qué es un «sí» a la oferta", () => {
  it("un sí corto, sin importar mayúsculas, tildes, espacios ni signos", () => {
    for (const yes of ["Sí", "si", "¡SÍ!", " sí. ", "Yes!", "vale", "OK", "claro", "De acuerdo", "Sí, por favor", "lo quiero", "yes please"]) {
      expect(isYes(yes), yes).toBe(true);
    }
  });

  it("una frase más larga, una pregunta que lo contiene o un no, no: los contesta el agente", () => {
    for (const other of ["Sí, pero ¿puede ser a las 10?", "¿sí?no", "no", "no gracias", "si puedo mañana", "BAJA", "", "sí sí sí sí"]) {
      expect(isYes(other), other).toBe(false);
    }
  });
});

describe("la reserva que sale de aceptar", () => {
  it("su clave lleva la entrada y el mensaje: un «sí» repetido es otra reserva, la misma entrega no", () => {
    expect(acceptanceKey(ENTRY, MESSAGE)).toBe(`waitlist-accept:${ENTRY}:${MESSAGE}`);
  });

  it("de una ejecución de book_appointment con esa clave se saca la entrada; de cualquier otra, nada", () => {
    expect(acceptedEntry("book_appointment", acceptanceKey(ENTRY, MESSAGE))).toBe(ENTRY);
    expect(acceptedEntry("reply", acceptanceKey(ENTRY, MESSAGE))).toBeNull();
    expect(acceptedEntry("book_appointment", `run:0:0:book_appointment`)).toBeNull();
    expect(acceptedEntry("book_appointment", "waitlist-accept:no-es-un-uuid:x")).toBeNull();
  });

  it("el hueco se guarda lo que dura la aprobación, y nunca más allá de cuando empieza", () => {
    const now = new Date("2030-06-03T08:00:00Z");
    expect(holdUntil(now, new Date("2030-06-10T08:00:00Z"))).toEqual(new Date(now.getTime() + APPROVAL_TTL_MS));
    expect(holdUntil(now, new Date("2030-06-03T10:00:00Z"))).toEqual(new Date("2030-06-03T10:00:00Z"));
  });
});

describe("la respuesta al «sí»", () => {
  const offer = { service: "Láser", location: "Centro", timezone: "Europe/Madrid", locale: "es", startsAt: new Date("2030-06-03T07:00:00Z") };

  it("en español: pendiente del equipo, reservada o sin poder reservar, con el día y la hora del local", () => {
    expect(acceptanceText("pending", offer)).toMatch(/^¡Genial! Te guardamos el hueco del lunes, 3 de junio.*09:00 y el equipo te lo confirma enseguida\.$/);
    expect(acceptanceText("booked", offer)).toMatch(/^¡Hecho! Tienes cita de Láser en Centro el lunes, 3 de junio.*09:00\.$/);
    expect(acceptanceText("failed", offer)).toBe("Vaya, no hemos podido reservarlo. Una persona del equipo te escribe enseguida.");
  });

  it("en inglés, y un idioma que no tenemos sale en inglés", () => {
    expect(acceptanceText("booked", { ...offer, locale: "en", timezone: "Atlantic/Canary" })).toMatch(/^Done! You're booked for Láser at Centro on Monday 3 June.*08:00\.$/);
    expect(acceptanceText("pending", { ...offer, locale: "fr" })).toMatch(/^Great! We're holding the /);
  });
});
