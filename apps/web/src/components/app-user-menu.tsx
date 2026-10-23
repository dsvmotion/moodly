"use client";

import {
  Building2Icon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
} from "@repo/ui/lib/icons";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useTransition, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useSidebar } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { LOCALES } from "@/i18n/config";
import { settingsSection } from "@/lib/navigation";
import type { Theme } from "@/lib/preferences";
import { displayName, initials } from "@/lib/user-display";
import { setLocale, setTheme } from "@/app/preferences-actions";

const SECURITY_HREF = settingsSection("security").href;
const ORGANIZATION_HREF = settingsSection("organization").href;

/**
 * Menú de usuario del pie de la barra lateral (MANUAL §9.2; auditoría del
 * frontend, F-4): quién es y en qué organización, seguridad de la cuenta,
 * ajustes, tema, idioma y cerrar sesión, en un solo desplegable.
 */
export function AppUserMenu({
  name,
  email,
  context,
  theme,
  signOutAction,
}: {
  name: string | null;
  email: string;
  /** Rol y organización activa ("Administración · Demo A"), si tiene. */
  context: string | null;
  theme: Theme;
  signOutAction: () => Promise<void>;
}) {
  const t = useTranslations("userMenu");
  const tNav = useTranslations("nav");
  const tLanguage = useTranslations("language");
  const locale = useLocale();
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();
  // El formulario vive fuera del menú: al elegir «Cerrar sesión» el menú se
  // cierra y desmonta su contenido, y el envío no debe depender de él.
  const signOutForm = useRef<HTMLFormElement>(null);
  const shown = displayName(name, email);

  const themes: Array<{ value: Theme; label: string; icon: ReactNode }> = [
    { value: "system", label: tNav("themeSystem"), icon: <MonitorIcon aria-hidden="true" /> },
    { value: "light", label: tNav("themeLight"), icon: <SunIcon aria-hidden="true" /> },
    { value: "dark", label: tNav("themeDark"), icon: <MoonIcon aria-hidden="true" /> },
  ];

  return (
    <>
      <form ref={signOutForm} action={signOutAction} hidden />
      {/* No modal, como el selector de alcance: un menú modal marca el resto de la página con aria-hidden. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          data-testid="user-menu"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-border"
          >
            {initials(name, email)}
          </span>
          <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
            <span data-testid="user-name" className="block truncate text-sm text-sidebar-foreground">
              {shown}
            </span>
            <span data-testid="current-user" className="block truncate text-xs text-sidebar-muted-foreground">
              {email}
            </span>
          </span>
          {collapsed ? null : <ChevronsUpDownIcon className="size-4 shrink-0 text-sidebar-muted-foreground" aria-hidden="true" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64" data-testid="user-menu-content">
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="truncate text-sm text-foreground">{shown}</span>
            {context ? (
              <span data-testid="user-context" className="truncate">
                {context}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={SECURITY_HREF}>
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
              {t("security")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={ORGANIZATION_HREF}>
              <Building2Icon className="size-4" aria-hidden="true" />
              {t("organization")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{tNav("theme")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            data-testid="theme-switcher"
            aria-label={tNav("theme")}
            value={theme}
            onValueChange={(value) => startTransition(() => setTheme(value))}
          >
            {themes.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} disabled={pending} className="[&_svg]:size-4">
                {option.icon}
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{tLanguage("label")}</DropdownMenuLabel>
          {/* Cada idioma, en su propio idioma (MANUAL §9.9). */}
          <DropdownMenuRadioGroup
            data-testid="language-switcher"
            aria-label={tLanguage("label")}
            value={locale}
            onValueChange={(value) => startTransition(() => setLocale(value))}
          >
            {LOCALES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option} lang={option} disabled={pending}>
                {tLanguage(option)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
            <LogOutIcon className="size-4" aria-hidden="true" />
            {tNav("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
