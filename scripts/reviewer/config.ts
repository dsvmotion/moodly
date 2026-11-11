// Configuración fija de la Revisora automática (SE01, órdenes de M0 §5).
//
// Corre siempre desde la rama base (pull_request_target): un PR no puede
// cambiar estas reglas para sí mismo. Cambiarlas es un PR sensible
// (scripts/reviewer/ está en scripts/merge-guard/sensitive-paths.txt).

import { GATEWAY_MODELS, USD_TO_EUR, type ModelKey } from "../../packages/config/src/index.ts";

/** Nivel 0 sin modelo, nivel 1 con el rápido, nivel 2 con el potente. */
export type Level = 0 | 1 | 2;

/** Qué clave de modelo usa cada nivel con modelo. Hasta tener el set de prueba: `fast` y `smart`. */
export const MODEL_BY_LEVEL: Readonly<Record<1 | 2, ModelKey>> = { 1: "fast", 2: "smart" };

/**
 * Si el nivel 1 puede aprobar. Decisión de producto (2026-11-10): solo después
 * de que el modelo del nivel 1 acierte todos los casos de seguridad del set de
 * prueba. Hasta entonces revisa y comenta, pero no aprueba. Ponerlo a `true` es
 * un PR sensible con la corrida del set como evidencia.
 */
export const LEVEL1_CAN_APPROVE = false;

/** Rutas de documentación normativa: van al nivel 2 aunque no estén en la lista de la guarda. */
export const NORMATIVE_DOCS: readonly RegExp[] = [/^docs\/adr\//, /^docs\/MANUAL\.md$/];

/** Documentación no normativa: si un PR solo toca esto, es de nivel 0. */
export const NON_NORMATIVE_DOCS: readonly RegExp[] = [/^docs\/.+\.(md|ya?ml)$/, /^README\.md$/];

/** Tope de coste de una revisión, en euros. */
export const MAX_REVIEW_EUR = 0.5;
/** Tope de tokens de salida: veredicto y como mucho diez hallazgos. */
export const MAX_OUTPUT_TOKENS = 4000;
export const MAX_FINDINGS = 10;
/** Más de esto en el diff y no se manda al modelo: lo revisa producto. Unos 60.000 tokens. */
export const MAX_DIFF_CHARS = 240_000;
/** Estimación prudente de caracteres por token para el presupuesto previo. */
export const CHARS_PER_TOKEN = 3;

/** Marca en el cuerpo de cada revisión: el commit revisado, para revisar solo lo nuevo en el siguiente push. */
export const REVIEW_MARKER = "revisora:commit";

export interface LevelModel {
  key: ModelKey;
  id: string;
  inputEurPerMTok: number;
  outputEurPerMTok: number;
}

export function modelForLevel(level: 1 | 2): LevelModel {
  const key = MODEL_BY_LEVEL[level];
  const model = GATEWAY_MODELS[key];
  if (!model) throw new Error(`No hay modelo del gateway para la clave ${key}`);
  return {
    key,
    id: model.id,
    inputEurPerMTok: model.inputUsdPerMTok * USD_TO_EUR,
    outputEurPerMTok: model.outputUsdPerMTok * USD_TO_EUR,
  };
}
