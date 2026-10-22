// Seed idempotente para Supabase local y CI: `pnpm db:seed`.
//
// - Solo se ejecuta contra una instancia local (127.0.0.1 / localhost).
// - Usa la clave secreta local de `supabase status`: es un script de
//   plataforma, nunca código de apps/web.
// - Genera una contraseña nueva para cada usuario en cada ejecución y la
//   escribe solo en packages/db/.seed/credentials.local.json (ignorado por
//   git, permisos 0600). No se imprime por pantalla.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "./local-only.ts";
import { seedLocations, seedOrganizations, seedRegions, seedUsers, type SeedUser } from "./data.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const credentialsFile = resolve(packageRoot, ".seed/credentials.local.json");

interface LocalSupabase {
  apiUrl: string;
  secretKey: string;
}

function readLocalSupabase(): LocalSupabase {
  const raw = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(raw) as Record<string, string | undefined>;
  const apiUrl = status["API_URL"];
  const secretKey = status["SECRET_KEY"] ?? status["SERVICE_ROLE_KEY"];
  if (!apiUrl || !secretKey) throw new Error("supabase status no devuelve API_URL/SECRET_KEY: ¿está levantado (pnpm db:start)?");

  assertLocalSupabaseUrl(apiUrl);
  return { apiUrl, secretKey };
}

function check(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function findAuthUserId(admin: SupabaseClient, email: string): Promise<string | undefined> {
  // Pocas decenas de usuarios en local: una página basta.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check("listUsers", error);
  return data.users.find((u) => u.email === email)?.id;
}

async function upsertAuthUser(admin: SupabaseClient, user: SeedUser, password: string): Promise<string> {
  const existing = await findAuthUserId(admin, user.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
    check("updateUserById", error);
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({ email: user.email, password, email_confirm: true });
  check("createUser", error);
  if (!data.user) throw new Error(`createUser no devolvió el usuario ${user.email}`);
  return data.user.id;
}

interface SeedCredential {
  key: string;
  email: string;
  password: string;
  role: SeedUser["role"];
  organizationId: string;
}

// Tras `supabase db reset` se reinician los contenedores y Auth y PostgREST
// tardan unos segundos en responder: sin esperar, el seed fallaba justo
// después del reset (primero en Auth y después en la API REST).
async function waitForServices(apiUrl: string, secretKey: string, timeoutMs = 60_000): Promise<void> {
  const endpoints = [`${apiUrl}/auth/v1/health`, `${apiUrl}/rest/v1/organizations?select=id&limit=1`];
  const deadline = Date.now() + timeoutMs;
  let lastError = "sin respuesta";
  while (Date.now() < deadline) {
    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint, { headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` } });
          return response.ok ? null : `${new URL(endpoint).pathname} → HTTP ${response.status}`;
        } catch (error) {
          return `${new URL(endpoint).pathname} → ${error instanceof Error ? error.message : String(error)}`;
        }
      }),
    );
    const pending = results.filter((r): r is string => r !== null);
    if (pending.length === 0) return;
    lastError = pending.join("; ");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Supabase local no responde tras ${timeoutMs / 1000}s (${lastError}): ¿está levantado (pnpm db:start)?`);
}

async function main(): Promise<void> {
  const { apiUrl, secretKey } = readLocalSupabase();
  await waitForServices(apiUrl, secretKey);
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const orgs = await admin.from("organizations").upsert(
    seedOrganizations.map((o) => ({ id: o.id, name: o.name, vertical: o.vertical })),
  );
  check("organizations", orgs.error);
  const regions = await admin.from("regions").upsert(
    seedRegions.map((r) => ({ id: r.id, organization_id: r.organizationId, name: r.name })),
  );
  check("regions", regions.error);
  const locations = await admin.from("locations").upsert(
    seedLocations.map((l) => ({ id: l.id, organization_id: l.organizationId, region_id: l.regionId, name: l.name })),
  );
  check("locations", locations.error);

  const credentials: SeedCredential[] = [];
  for (const user of seedUsers) {
    // 24 caracteres aleatorios + minúscula, mayúscula y dígito garantizados
    // (config.toml exige lower_upper_letters_digits).
    const password = `${randomBytes(18).toString("base64url")}aA1`;
    const userId = await upsertAuthUser(admin, user, password);

    const profile = await admin.from("users").upsert({ id: userId, full_name: user.fullName });
    check("users", profile.error);
    const membership = await admin.from("memberships").upsert(
      {
        user_id: userId,
        organization_id: user.organizationId,
        role: user.role,
        scope_region_ids: user.scopeRegionIds,
        scope_location_ids: user.scopeLocationIds,
      },
      { onConflict: "user_id,organization_id" },
    );
    check("memberships", membership.error);

    credentials.push({ key: user.key, email: user.email, password, role: user.role, organizationId: user.organizationId });
  }

  mkdirSync(dirname(credentialsFile), { recursive: true });
  writeFileSync(credentialsFile, JSON.stringify({ generatedAt: new Date().toISOString(), users: credentials }, null, 2), {
    mode: 0o600,
  });

  console.log(
    `Seed aplicado: ${seedOrganizations.length} organizaciones, ${seedRegions.length} región, ` +
      `${seedLocations.length} locales, ${seedUsers.length} usuarios. Credenciales en ${credentialsFile}`,
  );
}

await main();
