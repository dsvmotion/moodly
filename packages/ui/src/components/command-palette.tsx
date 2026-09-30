"use client";

import { useEffect, type ReactNode } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { isCommandPaletteShortcut, isSearchShortcut } from "@repo/ui/lib/keyboard";

export interface CommandPaletteItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Palabras extra para la búsqueda (sinónimos, nombre en otro idioma…). */
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteGroup {
  heading: string;
  items: CommandPaletteItem[];
}

/**
 * Paleta de comandos (MANUAL §9.2): ⌘K / Ctrl+K para abrirla desde cualquier
 * sitio y "/" (fuera de campos de texto) para buscar. Controlada: la app
 * decide qué grupos y acciones ofrece.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandPaletteGroup[];
  labels: { title: string; description: string; placeholder: string; empty: string };
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isCommandPaletteShortcut(event)) {
        event.preventDefault();
        onOpenChange(!open);
      } else if (!open && isSearchShortcut(event)) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const select = (item: CommandPaletteItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={labels.title} description={labels.description} label={labels.title}>
      <CommandInput placeholder={labels.placeholder} aria-label={labels.placeholder} />
      <CommandList>
        <CommandEmpty>{labels.empty}</CommandEmpty>
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.id}`}
                  keywords={item.keywords ?? []}
                  onSelect={() => select(item)}
                >
                  {item.icon}
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
      </CommandList>
    </CommandDialog>
  );
}
