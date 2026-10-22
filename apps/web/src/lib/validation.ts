import { z } from "zod";

// Esquemas de entrada de las Server Actions (re-auditoría, A3). Validan formas;
// los permisos los decide la base de datos (RLS y funciones). En un módulo
// aparte porque un archivo "use server" solo puede exportar funciones async.

export const ROLES = ["org_admin", "region_manager", "location_manager", "staff"] as const;

export const idSchema = z.uuid();

export const inviteSchema = z.object({
  organizationId: z.uuid(),
  email: z.string().max(320).pipe(z.email()),
  role: z.enum(ROLES),
  scopeId: z.union([z.uuid(), z.literal("")]).default(""),
});

/** Token de invitación en claro (base64url de 32 bytes: 43 caracteres). */
export const tokenSchema = z.string().min(1).max(128);

/** Email y contraseña del login: solo forma; el error al usuario es siempre genérico. */
export const signInSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
});

/** Código TOTP de 6 cifras (se toleran espacios al pegarlo). */
export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));
