// Salud de la web para la alerta de staging (PL-health). Sin datos de ninguna
// organización: una lectura inocua por la vía pública (la clave publicable, rol
// anon) contra la API de Supabase. `anon` no tiene permiso sobre ninguna tabla
// (revoke all, migración tenants_rls), así que la respuesta sana es un
// «permission denied» (42501) de Postgres o un 200 vacío: las dos prueban que la
// API y la base de datos responden. Un 5xx, un corte o un tiempo agotado, no.

export interface HealthReport {
  status: "ok" | "degraded";
  checks: { database: "ok" | "fail" };
  version: string | null;
}

export interface HealthResult {
  httpStatus: 200 | 503;
  body: HealthReport;
}

export interface HealthDeps {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

async function databaseReachable({ env = process.env, fetch: doFetch = fetch, timeoutMs = 3_000 }: HealthDeps): Promise<boolean> {
  const url = env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;
  try {
    const response = await doFetch(`${url.replace(/\/+$/, "")}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (response.ok) return true;
    if (response.status === 401 || response.status === 403) {
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
      return body?.code === "42501";
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkHealth(deps: HealthDeps = {}): Promise<HealthResult> {
  const env = deps.env ?? process.env;
  const database = await databaseReachable(deps);
  return {
    httpStatus: database ? 200 : 503,
    body: {
      status: database ? "ok" : "degraded",
      checks: { database: database ? "ok" : "fail" },
      // Commit desplegado por Vercel: solo los 7 primeros caracteres.
      version: env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ?? null,
    },
  };
}
