// En los pushes siguientes se revisa solo lo que cambió desde el último commit
// revisado, sin lo que entra al traer `main` (órdenes de M0 §5). Si no se puede
// calcular, se revisa entero.

import { REVIEW_MARKER } from "./config.ts";

export function marker(sha: string, level: number): string {
  return `<!-- ${REVIEW_MARKER}=${sha} level=${level} -->`;
}

export interface PastReview {
  user: { login: string; type: string } | null;
  body: string | null;
  commit_id: string | null;
  /** APPROVED, CHANGES_REQUESTED, COMMENTED… */
  state?: string;
}

export interface LastReview {
  sha: string;
  state: string | null;
}

/**
 * El último commit que revisó la Revisora: el de su revisión más reciente con
 * marca. Solo cuentan las revisiones de su propia App (`botLogin`): cualquiera
 * con permiso de escritura podría pegar una marca en otro comentario.
 */
export function lastReview(reviews: readonly PastReview[], botLogin: string): LastReview | null {
  const re = new RegExp(`<!-- ${REVIEW_MARKER}=([0-9a-f]{40}) level=\\d -->`);
  for (let i = reviews.length - 1; i >= 0; i--) {
    const review = reviews[i];
    if (!review?.user || review.user.type !== "Bot" || review.user.login !== botLogin) continue;
    const sha = re.exec(review.body ?? "")?.[1];
    if (sha) return { sha, state: review.state ?? null };
  }
  return null;
}

export function lastReviewedSha(reviews: readonly PastReview[], botLogin: string): string | null {
  return lastReview(reviews, botLogin)?.sha ?? null;
}

/** Trozos de un diff unificado, uno por archivo (la ruta nueva). */
export function splitDiff(diff: string): Map<string, string> {
  const files = new Map<string, string>();
  const parts = diff.split(/^(?=diff --git )/m).filter((part) => part.startsWith("diff --git "));
  for (const part of parts) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/m.exec(part);
    const path = header?.[2];
    if (path) files.set(path, (files.get(path) ?? "") + part);
  }
  return files;
}

/**
 * Del diff entre el último commit revisado y el head, solo los archivos del PR.
 * Lo que trajo un merge de `main` en otros archivos queda fuera; en un archivo
 * del PR que también cambió en `main` entra entero (se revisa de más, nunca de
 * menos).
 */
export function restrictToPrFiles(compareDiff: string, prFiles: readonly string[]): string {
  const wanted = new Set(prFiles);
  return [...splitDiff(compareDiff)].filter(([path]) => wanted.has(path)).map(([, chunk]) => chunk).join("");
}

export type DeltaPlan =
  | { kind: "full" }
  | { kind: "delta"; since: string }
  | { kind: "nothing-new" };

/**
 * Qué revisar. `compareStatus` es el `status` de GitHub para
 * `compare/{since}...{head}`: `ahead` si el head desciende del último revisado,
 * `identical` si es el mismo, `diverged` o `behind` si se reescribió la historia.
 */
export function planDelta(input: {
  since: string | null;
  head: string;
  compareStatus: string | null;
  /** El estado de la última revisión de la Revisora. */
  lastState?: string | null;
}): DeltaPlan {
  if (!input.since) return { kind: "full" };
  if (input.since === input.head || input.compareStatus === "identical") return { kind: "nothing-new" };
  // Si pidió cambios, el siguiente push se revisa entero: revisando solo lo
  // nuevo, un approve podría tapar unos cambios pedidos que siguen sin hacerse.
  if (input.lastState === "CHANGES_REQUESTED") return { kind: "full" };
  if (input.compareStatus === "ahead") return { kind: "delta", since: input.since };
  return { kind: "full" };
}
