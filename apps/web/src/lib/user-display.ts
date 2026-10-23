// Cómo se muestra a la persona en el menú de usuario (auditoría del frontend,
// F-4): nombre si lo tiene; si no, su email.

/** Iniciales para el avatar: primera letra del primer y del último nombre, o las dos primeras del email. */
export function initials(name: string | null | undefined, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  if (first) return `${first.charAt(0)}${last?.charAt(0) ?? ""}`.toLocaleUpperCase("es");
  const local = email.split("@")[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  return local.slice(0, 2).toLocaleUpperCase("es") || "?";
}

/** Nombre visible: el nombre si existe y no está vacío; si no, el email. */
export function displayName(name: string | null | undefined, email: string): string {
  return name?.trim() || email;
}
