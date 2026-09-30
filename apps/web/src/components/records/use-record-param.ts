"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RECORD_PARAM, withRecord } from "@/lib/records";

/**
 * Registro abierto en la vista previa (P4), en la URL (?record=<id>) para que
 * el enlace se pueda compartir y sobreviva a una recarga (MANUAL §9.4).
 */
export function useRecordParam<T extends { id: string }>(rows: readonly T[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get(RECORD_PARAM);
  // Solo abre registros que están en la tabla (lo que el usuario ve y el alcance).
  const selected = rows.find((row) => row.id === requested) ?? null;

  const navigate = (id: string | null) =>
    router.replace(withRecord(`${pathname}?${searchParams.toString()}`, id), { scroll: false });

  return { selected, open: (row: T) => navigate(row.id), close: () => navigate(null) };
}
