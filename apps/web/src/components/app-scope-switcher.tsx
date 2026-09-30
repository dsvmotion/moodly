"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScopeSwitcher } from "@repo/ui/components/scope-switcher";
import { SCOPE_PARAM, withScope, type ScopeOption } from "@/lib/scope";

/**
 * Selector de alcance conectado a la URL (?scope=). Las opciones llegan del
 * servidor y son solo lo que el usuario ve según RLS; un valor de la URL que
 * no esté entre ellas se muestra como "todo".
 */
export function AppScopeSwitcher({ options }: { options: ScopeOption[] }) {
  const t = useTranslations("scope");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get(SCOPE_PARAM);
  const value = options.some((option) => option.value === requested) ? (requested ?? "all") : "all";

  return (
    <ScopeSwitcher
      options={options}
      value={value}
      onValueChange={(next) => router.push(withScope(`${pathname}?${searchParams.toString()}`, next))}
      labels={{ trigger: t("label"), regions: t("regions"), locations: t("locations") }}
    />
  );
}
