// Organización activa (re-auditoría, hallazgo 1.6): una persona puede trabajar
// para varias organizaciones. La interfaz trabaja siempre con una, elegida por la
// persona y guardada en una cookie. Nunca da acceso por sí sola: solo se acepta
// una organización en la que la persona tiene membership (lo que RLS le deja ver),
// y RLS sigue siendo la barrera de los datos. Pura, para probarla sin Next.

import type { MembershipRole } from "./scope";

export const ACTIVE_ORG_COOKIE = "org";

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
  /** Idioma de la organización (BCP 47, p. ej. es-ES): el de la interfaz si la persona no ha elegido otro (ADR 0041). */
  defaultLocale: string;
}

/** Las memberships por nombre de organización (orden estable para el selector). */
export function sortMemberships(memberships: readonly OrgMembership[]): OrgMembership[] {
  return [...memberships].sort(
    (a, b) => a.organizationName.localeCompare(b.organizationName, "es") || a.organizationId.localeCompare(b.organizationId),
  );
}

/**
 * La organización de la cookie si la persona pertenece a ella; si no (cookie
 * vacía, manipulada o de una organización que ya no es suya), la primera por nombre.
 */
export function pickActiveOrg(memberships: readonly OrgMembership[], requested: string | undefined): OrgMembership | null {
  const sorted = sortMemberships(memberships);
  return sorted.find((m) => m.organizationId === requested) ?? sorted[0] ?? null;
}
