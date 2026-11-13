import { z } from "zod";

// Formas de entrada de los ajustes del negocio (OA04): servicios con su precio,
// equipo y recursos, y el horario de cada local. Solo validan la forma: quién
// escribe lo decide la base de datos (20261113140000_business_setup: org_admin
// con aal2; lo sincronizado desde una integración no se toca) y los límites
// son los de sus CHECK.

export const NAME_MAX = 120;
export const DURATION_MIN = 5;
export const DURATION_MAX = 600;
/** Céntimos: el CHECK de services.price_cents llega a 10.000.000 (100.000,00). */
export const PRICE_MAX_CENTS = 10_000_000;
/** Las monedas del CHECK de services.currency. */
export const CURRENCIES = ["EUR", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const RESOURCE_KINDS = ["staff", "room", "equipment"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type OpeningHours = Partial<Record<Day, [string, string]>>;

const name = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(NAME_MAX));

const duration = z.coerce.number().int().min(DURATION_MIN).max(DURATION_MAX);

/**
 * Un precio escrito por una persona («45», «45,5», «45.50») en céntimos.
 * Vacío: sin precio publicado (null). undefined si no se entiende.
 */
export function parsePrice(input: string): number | null | undefined {
  const value = input.trim();
  if (value === "") return null;
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
  return cents <= PRICE_MAX_CENTS ? cents : undefined;
}

/** Los céntimos como se escriben en el campo («45,50»); vacío si no hay precio. */
export function priceInputValue(cents: number | null): string {
  if (cents === null) return "";
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
}

const price = z.string().transform((value, ctx) => {
  const cents = parsePrice(value);
  if (cents === undefined) {
    ctx.addIssue({ code: "custom", message: "price" });
    return z.NEVER;
  }
  return cents;
});

const id = z.uuid();

export const createServiceSchema = z.object({
  name,
  durationMinutes: duration,
  price,
  currency: z.enum(CURRENCIES),
  /** Vacío: en todos los locales. */
  locationId: z.union([z.uuid(), z.literal("")]),
});

export const updateServiceSchema = z.object({ id, name, durationMinutes: duration, price, currency: z.enum(CURRENCIES) });

export const setActiveSchema = z.object({ id, active: z.enum(["true", "false"]).transform((value) => value === "true") });

const serviceIds = z.array(z.uuid()).max(200).transform((ids) => [...new Set(ids)]);

export const createResourceSchema = z.object({ name, kind: z.enum(RESOURCE_KINDS), locationId: z.uuid(), serviceIds });

export const updateResourceSchema = z.object({ id, name, kind: z.enum(RESOURCE_KINDS), serviceIds });

const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);

/** Un día del formulario: cerrado, o abierto de una hora a otra (la de cierre, después). */
const daySchema = z.union([
  z.object({ open: z.literal(false) }),
  z.object({ open: z.literal(true), from: time, to: time }).refine((day) => day.from < day.to, { message: "order" }),
]);

export const openingHoursSchema = z.object({
  locationId: z.uuid(),
  days: z.object(Object.fromEntries(DAYS.map((day) => [day, daySchema])) as Record<Day, typeof daySchema>),
});

/** El horario como lo guarda locations.opening_hours: solo los días abiertos. */
export function toOpeningHours(days: z.infer<typeof openingHoursSchema>["days"]): OpeningHours {
  const hours: OpeningHours = {};
  for (const day of DAYS) {
    const value = days[day];
    if (value.open) hours[day] = [value.from, value.to];
  }
  return hours;
}

/** Lee los siete días del formulario (`<day>.open`, `<day>.from`, `<day>.to`). */
export function daysFromForm(formData: FormData): Record<Day, unknown> {
  return Object.fromEntries(
    DAYS.map((day) =>
      formData.get(`${day}.open`) === "on"
        ? [day, { open: true, from: formData.get(`${day}.from`), to: formData.get(`${day}.to`) }]
        : [day, { open: false }],
    ),
  ) as Record<Day, unknown>;
}

/** Un horario guardado, día a día, para el formulario (lo que no tiene forma, cerrado). */
export function readOpeningHours(value: unknown): Record<Day, { open: boolean; from: string; to: string }> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    DAYS.map((day) => {
      const range = source[day];
      const valid = Array.isArray(range) && range.length === 2 && range.every((t) => typeof t === "string" && time.safeParse(t).success);
      return [day, valid ? { open: true, from: range[0] as string, to: range[1] as string } : { open: false, from: "09:00", to: "14:00" }];
    }),
  ) as Record<Day, { open: boolean; from: string; to: string }>;
}

export interface BusinessFormState {
  error: "invalid" | "not_allowed" | "synced" | null;
  /** Cuándo se guardó: el formulario se cierra o avisa al cambiar. */
  savedAt: number | null;
}
