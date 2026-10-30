import { redirect } from "next/navigation";
import { settingsSection } from "@/lib/navigation";
import { withScope } from "@/lib/scope";

// /app/settings (la entrada «Ajustes» de la barra lateral) no tiene contenido
// propio: abre General, conservando el alcance elegido (MANUAL §9.4).
export default async function SettingsIndex({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  const { scope } = await searchParams;
  redirect(withScope(settingsSection("organization").href, typeof scope === "string" ? scope : null));
}
