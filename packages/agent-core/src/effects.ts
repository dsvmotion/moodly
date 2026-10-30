// Clases de efecto y niveles de autonomía (MANUAL §1.6 y §5.6). Son los mismos
// valores que el catálogo en la base de datos (private.autonomy_rank y
// private.effect_class_ceiling, migración agent_catalog): un test lo vigila.

export const AUTONOMY_LEVELS = ["suggest", "draft", "execute", "autonomous"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const EFFECT_CLASSES = [
  "read",
  "internal_write",
  "external_message",
  "external_outreach",
  "financial",
  "destructive",
] as const;
export type EffectClass = (typeof EFFECT_CLASSES)[number];

/** Techo por defecto de cada clase (§5.6). Subirlo es un override auditado de un org_admin, no un cambio aquí. */
export const EFFECT_CLASS_CEILING: Readonly<Record<EffectClass, AutonomyLevel>> = {
  read: "autonomous",
  internal_write: "autonomous",
  external_message: "autonomous",
  external_outreach: "execute",
  financial: "draft",
  destructive: "draft",
};

export function autonomyRank(level: AutonomyLevel): number {
  return AUTONOMY_LEVELS.indexOf(level) + 1;
}

/** El nivel más bajo de los dados: la autonomía efectiva nunca supera ninguno de sus límites. */
export function minAutonomy(...levels: AutonomyLevel[]): AutonomyLevel {
  return levels.reduce((low, level) => (autonomyRank(level) < autonomyRank(low) ? level : low));
}
