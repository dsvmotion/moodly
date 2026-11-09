import { z } from "zod";

// Formas de entrada de la pantalla de conocimiento (paso B20-3, MANUAL §6.1).
// Solo validan la forma: quién puede escribir lo decide la base de datos (RLS
// de knowledge_sources: org_admin con aal2) y sus límites son los mismos que
// los CHECK de la tabla (título de 1 a 200, texto de 1 a 20.000, sin contar los
// espacios de los extremos).

/** Los tipos que se escriben a mano. Documentos, web y respuestas del equipo llegan por otras vías. */
export const TEXT_SOURCE_TYPES = ["faq", "pricing", "policy", "catalog"] as const;
export const TITLE_MAX = 200;
export const BODY_MAX = 20_000;

/** El navegador manda los saltos de línea de un textarea como \r\n: se guardan como \n. */
const text = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1).max(max));

export const createSourceSchema = z.object({
  type: z.enum(TEXT_SOURCE_TYPES),
  /** Vacío: toda la organización. */
  locationId: z.union([z.uuid(), z.literal("")]),
  title: text(TITLE_MAX),
  body: text(BODY_MAX),
});

export const updateSourceSchema = z.object({
  id: z.uuid(),
  title: text(TITLE_MAX),
  body: text(BODY_MAX),
});

export const deleteSourceSchema = z.object({ id: z.uuid() });

export interface KnowledgeFormState {
  error: "invalid" | "not_allowed" | null;
  /** Cuándo se guardó: el formulario se vacía o se cierra al cambiar. */
  savedAt: number | null;
}
