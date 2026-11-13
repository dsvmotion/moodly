import { describe, expect, it, vi } from "vitest";
import { KoiboxError, KOIBOX_DEFAULT_API_BASE, createKoiboxReader, parseKoiboxApiBase } from "./client.js";

// Contra un fetch falso con las formas de la referencia de la API de Koibox
// (docs.koibox.cloud/en/api-ref). Sin cuenta real.

const KEY = "kbx_test_key_not_secret_123";
const TZ = "Europe/Madrid";

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(handler: Handler) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(new URL(String(input)), init ?? {}));
}

function reader(handler: Handler, apiBase?: string) {
  const fetch = fakeFetch(handler);
  return { fetch, koibox: createKoiboxReader({ apiKey: KEY, timeZone: TZ, fetch, ...(apiBase ? { apiBase } : {}) }) };
}

const SERVICE = { id: 7, referencia: "C1", nombre: "Corte", duracion: "00:45:00", is_active: true, is_disponible_online: true, users: [{ value: 3, text: "Ana" }, 4] };

describe("parseKoiboxApiBase", () => {
  it("https, o http solo en loopback; por defecto, la de Koibox", () => {
    expect(parseKoiboxApiBase(undefined)).toBe(KOIBOX_DEFAULT_API_BASE);
    expect(parseKoiboxApiBase("http://127.0.0.1:3998/")).toBe("http://127.0.0.1:3998");
    for (const bad of ["http://api.koibox.cloud", "https://u:p@api.koibox.cloud", "https://api.koibox.cloud/?x=1", "ftp://x", "no-es-url"]) {
      expect(() => parseKoiboxApiBase(bad)).toThrow();
    }
  });
});

describe("createKoiboxReader", () => {
  it("no se crea con una clave sin forma de clave ni con una zona horaria que no existe", () => {
    expect(() => createKoiboxReader({ apiKey: "a b", timeZone: TZ })).toThrow();
    expect(() => createKoiboxReader({ apiKey: KEY, timeZone: "Marte/Olympus" })).toThrow();
  });

  it("la clave va solo en X-Koibox-Key, contra la URL base de la configuración, sin seguir redirecciones", async () => {
    const { fetch, koibox } = reader((url, init) => {
      expect(url.toString()).toBe("https://api.koibox.cloud/api/api-key/me/");
      expect((init.headers as Record<string, string>)["X-Koibox-Key"]).toBe(KEY);
      expect(init.redirect).toBe("error");
      return json({ name: "Moodly", centro: 12, centro_slug: "salon-ana" });
    });
    await expect(koibox.verifyKey()).resolves.toEqual({ centerId: "12", centerSlug: "salon-ana" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not_found"],
    [429, "transient"],
    [503, "transient"],
    [400, "rejected"],
  ] as const)("un %i es %s, y el error no lleva ni la clave ni el cuerpo", async (status, kind) => {
    const { koibox } = reader(() => json({ detail: `eco de ${KEY}` }, status));
    const err = await koibox.verifyKey().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KoiboxError);
    expect((err as KoiboxError).kind).toBe(kind);
    expect(String((err as Error).message)).not.toContain(KEY);
    expect(String((err as Error).message)).not.toContain("eco");
  });

  it("sin respuesta es transitorio", async () => {
    const { koibox } = reader(() => {
      throw new TypeError("fetch failed");
    });
    await expect(koibox.verifyKey()).rejects.toMatchObject({ kind: "transient" });
  });

  it("los servicios: pagina con limit/offset (nunca sigue «next»), limpia los nombres y salta los que no tienen forma", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({ ...SERVICE, id: i + 1, nombre: i === 0 ? `Corte\u0000‮ ${"x".repeat(300)}` : `S${i + 1}` }));
    const offsets: string[] = [];
    const { koibox } = reader((url) => {
      expect(url.pathname).toBe("/api/servicios/");
      offsets.push(url.searchParams.get("offset") ?? "");
      const offset = Number(url.searchParams.get("offset"));
      return offset === 0
        ? json({ count: 52, next: "https://evil.example/next", previous: null, results: page1 })
        : json({ count: 52, next: null, previous: null, results: [{ ...SERVICE, id: 51 }, { id: 52, nombre: "Sin duración" }] });
    });
    const services = await koibox.listServices();
    expect(offsets).toEqual(["0", "50"]);
    expect(services).toHaveLength(51);
    expect(services[0]?.name.length).toBe(200);
    // eslint-disable-next-line no-control-regex -- comprobar que no quedan caracteres de control
    expect(services[0]?.name).not.toMatch(/[\u0000‮]/);
    expect(services[50]).toEqual({ id: "51", name: "Corte", durationMinutes: 45, active: true, bookableOnline: true, employeeIds: ["3", "4"] });
  });

  it("una página con otra forma es un error, no una lista vacía", async () => {
    const { koibox } = reader(() => json({ results: "no" }));
    await expect(koibox.listServices()).rejects.toMatchObject({ kind: "rejected" });
  });

  it("las horas libres: una llamada por día en hora local, con un solo servicio, y fin = inicio + duración del servicio", async () => {
    const calls: string[] = [];
    const { koibox } = reader((url) => {
      if (url.pathname === "/api/servicio/7") return json(SERVICE);
      expect(url.pathname).toBe("/api/agenda/horas-disponibles/");
      calls.push(url.search);
      const fecha = url.searchParams.get("fecha");
      return json(
        fecha === "2026-11-13"
          ? [{ user: 3, hora: "08:00" }, { user: 3, hora: "10:00" }, { user: 4, hora: "10:30" }]
          : [{ user: 3, hora: "09:00" }, { user: 3, hora: "mañana" }],
      );
    });
    const slots = await koibox.findSlots({
      serviceId: "7",
      from: new Date("2026-11-13T08:00:00Z"), // 09:00 en Madrid: la de las 08:00 locales queda fuera
      to: new Date("2026-11-14T22:00:00Z"), // 23:00 en Madrid
      limit: 10,
    });
    expect(calls).toEqual(["?fecha=2026-11-13&servicios=7", "?fecha=2026-11-14&servicios=7"]);
    expect(slots).toEqual([
      { employeeId: "3", startsAt: new Date("2026-11-13T09:00:00Z"), endsAt: new Date("2026-11-13T09:45:00Z") },
      { employeeId: "4", startsAt: new Date("2026-11-13T09:30:00Z"), endsAt: new Date("2026-11-13T10:15:00Z") },
      { employeeId: "3", startsAt: new Date("2026-11-14T08:00:00Z"), endsAt: new Date("2026-11-14T08:45:00Z") },
    ]);
  });

  it("con empleado, lo pide y descarta las horas de otros", async () => {
    const { koibox } = reader((url) =>
      url.pathname === "/api/servicio/7"
        ? json(SERVICE)
        : (expect(url.searchParams.get("user")).toBe("3"), json([{ user: 3, hora: "10:00" }, { user: 4, hora: "11:00" }])),
    );
    const slots = await koibox.findSlots({ serviceId: "7", employeeId: "3", from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-13T20:00:00Z"), limit: 5 });
    expect(slots.map((s) => s.employeeId)).toEqual(["3"]);
  });

  it.each([
    [{ serviceId: "7; drop", from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-14T00:00:00Z"), limit: 5 }],
    [{ serviceId: "7", employeeId: "../x", from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-14T00:00:00Z"), limit: 5 }],
    [{ serviceId: "7", from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-12-13T00:00:00Z"), limit: 5 }],
    [{ serviceId: "7", from: new Date("2026-11-14T00:00:00Z"), to: new Date("2026-11-13T00:00:00Z"), limit: 5 }],
    [{ serviceId: "7", from: new Date("2026-11-13T00:00:00Z"), to: new Date("2026-11-14T00:00:00Z"), limit: 0 }],
  ])("rechaza una petición mal formada sin llamar a Koibox (%#)", async (request) => {
    const { fetch, koibox } = reader(() => json([]));
    await expect(koibox.findSlots(request)).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("las citas: filtro en hora local sin desfase, re-filtradas aquí, sin datos del cliente", async () => {
    const { koibox } = reader((url) => {
      expect(url.pathname).toBe("/api/agenda/");
      expect(url.searchParams.get("fecha__gte")).toBe("2026-11-13T10:00:00");
      expect(url.searchParams.get("fecha__lte")).toBe("2026-11-13T20:00:00");
      return json({
        count: 4,
        next: null,
        previous: null,
        results: [
          {
            id: 90,
            titulo: "Corte",
            fecha: "2026-11-13",
            hora_inicio: "11:00:00",
            hora_fin: "11:45:00",
            user: { value: 3, text: "Ana" },
            estado: { id: 1, nombre: "Confirmada‮" },
            servicios: [{ id: 7, nombre: "Corte" }],
            cliente: { value: 55, text: "Lucía Pérez", email: "lucia@example.com", movil: "600000000" },
          },
          // Fuera del rango pedido (otra lectura del filtro): no sale.
          { id: 91, titulo: "x", fecha: "2026-11-13", hora_inicio: "08:00:00", hora_fin: "08:30:00", user: 3 },
          // Sin hora de fin: la duración.
          { id: 92, titulo: "y", fecha: "2026-11-13", hora_inicio: "12:00:00", duracion: "00:30:00", user: 4, servicios: [7, 7] },
          // Sin forma: se salta.
          { id: 93, fecha: "ayer" },
        ],
      });
    });
    const appointments = await koibox.listAppointments({ from: new Date("2026-11-13T09:00:00Z"), to: new Date("2026-11-13T19:00:00Z"), limit: 10 });
    expect(appointments).toEqual([
      { id: "90", employeeId: "3", serviceIds: ["7"], startsAt: new Date("2026-11-13T10:00:00Z"), endsAt: new Date("2026-11-13T10:45:00Z"), state: "Confirmada" },
      { id: "92", employeeId: "4", serviceIds: ["7"], startsAt: new Date("2026-11-13T11:00:00Z"), endsAt: new Date("2026-11-13T11:30:00Z"), state: "" },
    ]);
    expect(JSON.stringify(appointments)).not.toMatch(/Lucía|lucia@|600000000/);
  });
});
