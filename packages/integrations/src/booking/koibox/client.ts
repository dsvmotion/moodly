import { z } from "zod";
import { assertTimeZone, durationMinutes, localDate, localDateTime, localToUtc, nextDate } from "./time.js";

// Koibox (int-koibox, O-02): software de gestión de centros de belleza con API
// REST abierta (docs.koibox.cloud/en/api-ref). La clave la crea el centro
// (Ajustes → API Keys, plan Platinum) y va en la cabecera X-Koibox-Key.
//
// Solo lectura en este incremento: servicios, horas libres y citas. Lo que
// escribe llega con su skill y su política (ADR 0047).
//
// - Una instancia es de UNA conexión: la clave y la zona horaria del centro las
//   pone quien la crea (el worker, desde la fila de su organización), nunca lo
//   que genera el modelo.
// - La URL base es configuración (KOIBOX_API_BASE), nunca de una organización.
//   Tampoco se sigue el «next» de la paginación (una URL absoluta de fuera): se
//   pagina con limit/offset, con tope.
// - Lo que devuelve Koibox es un dato no confiable: se valida, se recorta y se
//   quitan los caracteres de control. De las citas no se devuelve nada del
//   cliente (ni nombre, ni teléfono, ni email).
// - La clave solo va en la cabecera: nunca en un error ni en un log. Los
//   errores llevan la operación y el estado HTTP, no el cuerpo.
//
// Sin verificar contra una cuenta real (no la tenemos): las formas salen de la
// referencia de la API. La zona horaria de las citas y el formato de
// fecha__gte/__lte no están documentados; ver listAppointments.

export const KOIBOX_DEFAULT_API_BASE = "https://api.koibox.cloud";
export const KOIBOX_KEY_HEADER = "X-Koibox-Key";
/** Koibox devuelve como mucho 50 por página. */
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
/** Días que se piden, como mucho, al buscar horas libres (una llamada por día). */
export const KOIBOX_MAX_SLOT_DAYS = 14;
const NAME_MAX = 200;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Valida la URL base de Koibox: https, o http solo en loopback (el stub de los
 * tests). Sin credenciales, parámetros ni fragmento. Devuelve la URL sin barra
 * final. Lanza si no vale (sin repetir el valor).
 */
export function parseKoiboxApiBase(value: string | undefined | null): string {
  const raw = value?.trim() || KOIBOX_DEFAULT_API_BASE;
  if (!URL.canParse(raw)) throw new Error("KOIBOX_API_BASE no es una URL");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("KOIBOX_API_BASE: sin credenciales, parámetros ni fragmento");
  }
  if (!(url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname)))) {
    throw new Error("KOIBOX_API_BASE: https://… (o http:// solo en loopback)");
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * - transient: vale la pena reintentar (red, 429, 5xx).
 * - unauthorized: la clave no vale (401/403): revocada, o el centro ya no tiene el plan.
 * - not_found: el recurso no existe en ese centro.
 * - rejected: otro 4xx, o la respuesta no tiene la forma esperada.
 */
export type KoiboxErrorKind = "transient" | "unauthorized" | "not_found" | "rejected";

export class KoiboxError extends Error {
  override readonly name = "KoiboxError";
  constructor(
    message: string,
    readonly status: number | null,
    readonly kind: KoiboxErrorKind,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.kind === "transient";
  }
}

export interface KoiboxKeyInfo {
  centerId: string;
  centerSlug: string;
}

export interface KoiboxService {
  id: string;
  /** Escrito por el centro: dato, nunca instrucción. */
  name: string;
  durationMinutes: number;
  active: boolean;
  bookableOnline: boolean;
  /** Los empleados que lo hacen. */
  employeeIds: string[];
}

export interface KoiboxSlot {
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface KoiboxAppointment {
  id: string;
  employeeId: string | null;
  serviceIds: string[];
  startsAt: Date;
  endsAt: Date;
  /** El nombre del estado en Koibox (p. ej. «Confirmada»), limpio. */
  state: string;
}

export interface KoiboxReader {
  /** La clave y su centro (GET /api/api-key/me/): para comprobar que vale. */
  verifyKey(): Promise<KoiboxKeyInfo>;
  listServices(): Promise<KoiboxService[]>;
  /** Horas libres de un servicio entre dos instantes (como mucho KOIBOX_MAX_SLOT_DAYS días), opcionalmente de un empleado. */
  findSlots(request: { serviceId: string; from: Date; to: Date; employeeId?: string; limit: number }): Promise<KoiboxSlot[]>;
  /** Citas que empiezan entre dos instantes, ordenadas. */
  listAppointments(request: { from: Date; to: Date; limit: number }): Promise<KoiboxAppointment[]>;
}

export interface KoiboxReaderOptions {
  apiKey: string;
  /** La zona horaria del centro (IANA), de locations.timezone. */
  timeZone: string;
  /** La URL base; por defecto, la de Koibox. Pasa por parseKoiboxApiBase. */
  apiBase?: string | null;
  fetch?: typeof globalThis.fetch;
}

const ID = z.union([z.number().int().nonnegative(), z.string().regex(/^\d{1,18}$/)]).transform((v) => String(v));
/** Un usuario (empleado) puede venir como id o como objeto {value, text…}. */
const userRef = z.union([ID, z.object({ value: ID }).passthrough().transform((o) => o.value)]);

const keyInfo = z.object({ centro: ID, centro_slug: z.string().max(200) }).passthrough();

const service = z
  .object({
    id: ID,
    nombre: z.string(),
    duracion: z.string().max(16),
    is_active: z.boolean().optional(),
    is_disponible_online: z.boolean().optional(),
    users: z.array(userRef).max(500).optional(),
  })
  .passthrough();
const pageShape = z.object({ count: z.number().int().nonnegative().optional(), results: z.array(z.unknown()).max(PAGE_SIZE) });

const freeHours = z.array(z.object({ user: ID, hora: z.string().max(16) }).passthrough()).max(2000);

const appointment = z
  .object({
    id: ID,
    fecha: z.string().max(16),
    hora_inicio: z.string().max(16),
    hora_fin: z.string().max(16).nullish(),
    duracion: z.string().max(16).nullish(),
    user: userRef.nullish(),
    estado: z.union([ID, z.object({ nombre: z.string().max(500).nullish() }).passthrough()]).nullish(),
    servicios: z.array(z.union([ID, z.object({ id: ID }).passthrough().transform((o) => o.id)])).max(100).nullish(),
  })
  .passthrough();

function clean(value: string | null | undefined): string {
  return (value ?? "")
    // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

function kindFor(status: number): KoiboxErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429 || status >= 500) return "transient";
  return "rejected";
}

function assertLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("limit: entre 1 y 50");
}

function assertRange(from: Date, to: Date) {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new RangeError("from y to tienen que ser fechas");
  if (to.getTime() <= from.getTime()) throw new RangeError("to tiene que ser posterior a from");
}

function assertKoiboxId(value: string, name: string) {
  if (!/^\d{1,18}$/.test(value)) throw new RangeError(`${name}: un id de Koibox (solo dígitos)`);
}

export function createKoiboxReader({ apiKey, timeZone, apiBase, fetch = globalThis.fetch }: KoiboxReaderOptions): KoiboxReader {
  if (!/^[\x21-\x7e]{8,512}$/.test(apiKey)) throw new Error("La clave de Koibox no tiene forma de clave");
  assertTimeZone(timeZone);
  const base = parseKoiboxApiBase(apiBase);

  async function get(operation: string, path: string, query: Record<string, string> = {}): Promise<unknown> {
    const search = Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";
    let response: Response;
    try {
      response = await fetch(`${base}${path}${search}`, {
        method: "GET",
        headers: { [KOIBOX_KEY_HEADER]: apiKey, Accept: "application/json" },
        redirect: "error",
      });
    } catch {
      throw new KoiboxError(`Koibox no respondió (${operation})`, null, "transient");
    }
    if (!response.ok) {
      // El cuerpo no se lee para el error: puede repetir datos del centro.
      await response.body?.cancel().catch(() => undefined);
      throw new KoiboxError(`Koibox rechazó ${operation} (${response.status})`, response.status, kindFor(response.status));
    }
    try {
      return await response.json();
    } catch {
      throw new KoiboxError(`Koibox devolvió algo que no es JSON (${operation})`, response.status, "rejected");
    }
  }

  function parse<T>(operation: string, schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new KoiboxError(`Koibox devolvió algo inesperado (${operation})`, null, "rejected");
    return parsed.data;
  }

  function toService(raw: unknown): KoiboxService | null {
    const s = service.safeParse(raw);
    if (!s.success) return null;
    const minutes = durationMinutes(s.data.duracion);
    if (minutes === null) return null;
    return {
      id: s.data.id,
      name: clean(s.data.nombre),
      durationMinutes: minutes,
      active: s.data.is_active !== false,
      bookableOnline: s.data.is_disponible_online === true,
      employeeIds: [...new Set(s.data.users ?? [])],
    };
  }

  return {
    async verifyKey() {
      const info = parse("la comprobación de la clave", keyInfo, await get("la comprobación de la clave", "/api/api-key/me/"));
      return { centerId: info.centro, centerSlug: clean(info.centro_slug) };
    },

    async listServices() {
      const services: KoiboxService[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const body = parse(
          "la lista de servicios",
          pageShape,
          await get("la lista de servicios", "/api/servicios/", { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }),
        );
        for (const raw of body.results) {
          // Un servicio con otra forma se salta; no tumba la lista.
          const item = toService(raw);
          if (item) services.push(item);
        }
        if (body.results.length < PAGE_SIZE) break;
      }
      return services;
    },

    async findSlots({ serviceId, from, to, employeeId, limit }) {
      assertKoiboxId(serviceId, "serviceId");
      if (employeeId !== undefined) assertKoiboxId(employeeId, "employeeId");
      assertLimit(limit);
      assertRange(from, to);
      if (to.getTime() - from.getTime() > KOIBOX_MAX_SLOT_DAYS * 24 * 60 * 60 * 1000) {
        throw new RangeError(`como mucho ${KOIBOX_MAX_SLOT_DAYS} días`);
      }
      // La duración sale del servicio (las horas libres solo traen la de inicio).
      const svc = toService(await get("el servicio", `/api/servicio/${serviceId}`));
      if (!svc) throw new KoiboxError("Koibox devolvió algo inesperado (el servicio)", null, "rejected");
      const slots: KoiboxSlot[] = [];
      const last = localDate(to, timeZone);
      for (let day = localDate(from, timeZone), n = 0; day <= last && n <= KOIBOX_MAX_SLOT_DAYS; day = nextDate(day), n++) {
        // Un solo valor por parámetro: la codificación de los arrays no está documentada.
        const query: Record<string, string> = { fecha: day, servicios: serviceId };
        if (employeeId !== undefined) query["user"] = employeeId;
        const hours = parse("las horas libres", freeHours, await get("las horas libres", "/api/agenda/horas-disponibles/", query));
        for (const hour of hours) {
          const startsAt = localToUtc(day, hour.hora, timeZone);
          if (!startsAt || startsAt < from || startsAt >= to) continue;
          if (employeeId !== undefined && hour.user !== employeeId) continue;
          slots.push({ employeeId: hour.user, startsAt, endsAt: new Date(startsAt.getTime() + svc.durationMinutes * 60_000) });
        }
        if (slots.length >= limit) break;
      }
      return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, limit);
    },

    async listAppointments({ from, to, limit }) {
      assertLimit(limit);
      assertRange(from, to);
      // El formato y la zona de fecha__gte/__lte no están documentados: se mandan
      // en hora local del centro, sin desfase, y se vuelve a filtrar aquí con la
      // fecha y la hora de cada cita. Otra lectura de Koibox solo puede traer de
      // más, nunca citas equivocadas.
      const query = { fecha__gte: localDateTime(from, timeZone), fecha__lte: localDateTime(to, timeZone) };
      const appointments: KoiboxAppointment[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const body = parse(
          "la lista de citas",
          pageShape,
          await get("la lista de citas", "/api/agenda/", { ...query, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }),
        );
        for (const raw of body.results) {
          const a = appointment.safeParse(raw);
          if (!a.success) continue;
          const startsAt = localToUtc(a.data.fecha, a.data.hora_inicio, timeZone);
          if (!startsAt || startsAt < from || startsAt >= to) continue;
          const byEnd = a.data.hora_fin ? localToUtc(a.data.fecha, a.data.hora_fin, timeZone) : null;
          const minutes = durationMinutes(a.data.duracion);
          const endsAt = byEnd && byEnd > startsAt ? byEnd : minutes ? new Date(startsAt.getTime() + minutes * 60_000) : null;
          if (!endsAt) continue;
          const estado = a.data.estado;
          appointments.push({
            id: a.data.id,
            employeeId: a.data.user ?? null,
            serviceIds: [...new Set(a.data.servicios ?? [])],
            startsAt,
            endsAt,
            state: typeof estado === "object" && estado !== null ? clean(estado.nombre) : "",
          });
        }
        if (body.results.length < PAGE_SIZE) break;
      }
      return appointments.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, limit);
    },
  };
}
