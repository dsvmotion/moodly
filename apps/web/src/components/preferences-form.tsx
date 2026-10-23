"use client";

import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { cn } from "@repo/ui/lib/utils";
import { setLocale, setTheme } from "@/app/preferences-actions";
import { LOCALES } from "@/i18n/config";
import { THEMES, type Theme } from "@/lib/preferences";

const THEME_LABEL = { system: "themeSystem", light: "themeLight", dark: "themeDark" } as const satisfies Record<Theme, string>;

/**
 * Ajustes → Preferencias: tema e idioma con botones de radio nativos (los
 * mismos valores y acciones que el menú de usuario). Se aplican al elegir; la
 * opción se marca al momento (optimista) mientras el servidor guarda la cookie
 * y vuelve a pintar.
 */
export function PreferencesForm({ theme: savedTheme }: { theme: Theme }) {
  const tNav = useTranslations("nav");
  const tLanguage = useTranslations("language");
  const savedLocale = useLocale();
  const [pending, startTransition] = useTransition();
  const [theme, setOptimisticTheme] = useOptimistic(savedTheme);
  const [locale, setOptimisticLocale] = useOptimistic<string>(savedLocale);

  const option = (checked: boolean) =>
    cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", checked && "border-foreground font-medium");

  return (
    <div className="flex flex-col gap-6">
      <fieldset data-testid="preferences-theme" aria-busy={pending} className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{tNav("theme")}</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((value) => (
            <label key={value} className={option(theme === value)}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() =>
                  startTransition(async () => {
                    setOptimisticTheme(value);
                    await setTheme(value);
                  })
                }
              />
              {tNav(THEME_LABEL[value])}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset data-testid="preferences-language" aria-busy={pending} className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{tLanguage("label")}</legend>
        <div className="flex flex-wrap gap-2">
          {/* Cada idioma, en su propio idioma (MANUAL §9.9). */}
          {LOCALES.map((value) => (
            <label key={value} lang={value} className={option(locale === value)}>
              <input
                type="radio"
                name="language"
                value={value}
                checked={locale === value}
                onChange={() =>
                  startTransition(async () => {
                    setOptimisticLocale(value);
                    await setLocale(value);
                  })
                }
              />
              {tLanguage(value)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
