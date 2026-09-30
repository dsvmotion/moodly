// Atajos de teclado globales (MANUAL §9.2 y §9.9): ⌘K / Ctrl+K abre la paleta
// de comandos y "/" la búsqueda. Lógica pura para poder probarla sin DOM.

export interface ShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** ¿El foco está en un sitio donde el usuario escribe? */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: string; isContentEditable?: boolean; getAttribute?: (name: string) => string | null };
  if (element.isContentEditable) return true;
  const tag = element.tagName?.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = (element.getAttribute?.("type") ?? "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset"].includes(type);
  }
  return element.getAttribute?.("role") === "textbox";
}

/** ⌘K en macOS o Ctrl+K en el resto; funciona también mientras se escribe. */
export function isCommandPaletteShortcut(event: ShortcutEvent): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}

/** "/" abre la búsqueda, salvo si el usuario ya está escribiendo. */
export function isSearchShortcut(event: ShortcutEvent): boolean {
  return (
    event.key === "/" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isEditableTarget(event.target)
  );
}
