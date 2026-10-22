import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "./fetch-all";

// Simula PostgREST con max_rows: cada petición devuelve como mucho `pageSize` filas.
function table(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  return vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
}

describe("fetchAll", () => {
  it("una lista de más de una página llega entera (antes se cortaba en 1.000)", async () => {
    const page = table(2_345);
    const { data, error } = await fetchAll(page, { pageSize: 1000 });
    expect(error).toBeNull();
    expect(data).toHaveLength(2_345);
    expect(data.at(-1)).toEqual({ id: 2_344 });
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("una lista que cabe en una página hace una sola petición", async () => {
    const page = table(10);
    expect((await fetchAll(page, { pageSize: 1000 })).data).toHaveLength(10);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("si la última página viene justo llena, pide otra (vacía) y termina", async () => {
    const page = table(2_000);
    expect((await fetchAll(page, { pageSize: 1000 })).data).toHaveLength(2_000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("un error en cualquier página devuelve el error y ninguna fila a medias", async () => {
    const error = { message: "permiso denegado" } as PostgrestError;
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error });
    const result = await fetchAll(page, { pageSize: 1000 });
    expect(result).toEqual({ data: [], error });
  });

  it("corta con un error claro si la lista supera el tope", async () => {
    await expect(fetchAll(table(50), { pageSize: 10, maxRows: 30 })).rejects.toThrow(/supera 30 filas/);
  });
});
