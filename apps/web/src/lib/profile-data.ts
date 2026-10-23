import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Nombre de la persona (public.users.full_name), leído con su JWT: RLS le deja
 * ver su propio perfil. null si no lo ha puesto. Una vez por petición.
 */
export const getProfileName = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("full_name").eq("id", userId).maybeSingle();
  if (error) throw new Error("No se pudo cargar tu perfil", { cause: error });
  return data?.full_name ?? null;
});
