import type { PostgrestError } from "@supabase/supabase-js";

// PostgREST corta cada respuesta en `max_rows` (1.000 en config.toml y por
// defecto en Supabase alojado) sin avisar: una lista más larga perdería filas en
// silencio. fetchAll pide páginas con range() mientras vengan llenas.
//
// - La consulta tiene que ir ordenada por una columna única (p. ej. `id`): si
//   no, las páginas pueden solaparse o saltarse filas.
// - `pageSize` no puede pasar de `max_rows`: una página recortada parecería la última.

export const PAGE_SIZE = 1000;
/** Tope de seguridad: una lista de tenant más larga que esto es un error de diseño. */
export const MAX_ROWS = 100_000;

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

export async function fetchAll<T>(
  page: (from: number, to: number) => Page<T>,
  { pageSize = PAGE_SIZE, maxRows = MAX_ROWS }: { pageSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
  throw new Error(`La lista supera ${maxRows} filas: hace falta paginarla en la interfaz`);
}
