"use client";

import { Building2Icon, ChevronsUpDownIcon, MapIcon, StoreIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useSidebar } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";

export interface ScopeOption {
  /** Valor que viaja en la URL (p. ej. "all", "region:<id>", "location:<id>"). */
  value: string;
  label: string;
  kind: "all" | "region" | "location";
}

/**
 * Selector de alcance (MANUAL §9.2): toda la organización, una región o un
 * local. Solo muestra las opciones que recibe; quien lo usa debe pasar
 * únicamente lo que el usuario puede ver (RLS).
 */
export function ScopeSwitcher({
  options,
  value,
  onValueChange,
  labels,
}: {
  options: ScopeOption[];
  value: string;
  onValueChange: (value: string) => void;
  labels: { trigger: string; regions: string; locations: string };
}) {
  const { collapsed } = useSidebar();
  const current = options.find((option) => option.value === value) ?? options[0];
  const regions = options.filter((option) => option.kind === "region");
  const locations = options.filter((option) => option.kind === "location");
  const all = options.filter((option) => option.kind === "all");

  const icon = (kind: ScopeOption["kind"]) =>
    kind === "all" ? <Building2Icon aria-hidden="true" /> : kind === "region" ? <MapIcon aria-hidden="true" /> : <StoreIcon aria-hidden="true" />;

  return (
    // No modal: un menú modal marca el resto de la página con aria-hidden aunque
    // siga siendo enfocable (axe: aria-hidden-focus, WCAG 4.1.2).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-testid="scope-switcher"
        aria-label={`${labels.trigger}: ${current?.label ?? ""}`}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-2 text-left text-sm hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0",
          collapsed && "justify-center px-0",
        )}
      >
        {current ? icon(current.kind) : null}
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{current?.label}</span>
            <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" data-testid="scope-options">
        <DropdownMenuRadioGroup value={current?.value ?? ""} onValueChange={onValueChange}>
          {all.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
          {regions.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{labels.regions}</DropdownMenuLabel>
              {regions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </>
          ) : null}
          {locations.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{labels.locations}</DropdownMenuLabel>
              {locations.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </>
          ) : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
