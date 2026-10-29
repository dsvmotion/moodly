import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { PreferencesForm } from "@/components/preferences-form";
import { requireUser } from "@/lib/auth/session";
import { parseTheme, THEME_COOKIE } from "@/lib/preferences";

// Ajustes → Preferencias (P6): tema e idioma de la interfaz. Son cookies de
// este navegador (preferences-actions.ts), no datos de la organización.
export default async function PreferencesPage() {
  await requireUser();
  const [cookieStore, t] = await Promise.all([cookies(), getTranslations("preferencesPage")]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <PreferencesForm theme={parseTheme(cookieStore.get(THEME_COOKIE)?.value)} />
    </div>
  );
}
