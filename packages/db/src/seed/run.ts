// Seed idempotente para Supabase local y CI: `pnpm db:seed`.
//
// - Solo se ejecuta contra una instancia local (127.0.0.1 / localhost).
// - Usa la clave secreta local de `supabase status`: es un script de
//   plataforma, nunca código de apps/web.
// - Genera una contraseña nueva para cada usuario en cada ejecución y la
//   escribe solo en packages/db/.seed/credentials.local.json (ignorado por
//   git, permisos 0600). No se imprime por pantalla.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readLocalSupabase, type LocalSupabase } from "./local-supabase.ts";
import { totp } from "./totp.ts";
import {
  seedCustomAgentTypes,
  seedExtraMemberships,
  seedGuests,
  seedLocations,
  seedOrganizations,
  seedPlatformStaff,
  seedRegions,
  seedUsers,
  type PlatformStaffRole,
  type SeedUser,
} from "./data.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const credentialsFile = resolve(packageRoot, ".seed/credentials.local.json");
// Claves de servidor locales (p. ej. LOGIN_THROTTLE_KEY). Se reutilizan entre
// ejecuciones para no invalidar apps/web/.env.local; `pnpm --filter @repo/web
// env:local` las copia allí. Ignorado por git, permisos 0600.
const serverKeysFile = resolve(packageRoot, ".seed/server-keys.local.json");

function check(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function findAuthUserId(admin: SupabaseClient, email: string): Promise<string | undefined> {
  // Pocas decenas de usuarios en local: una página basta.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check("listUsers", error);
  return data.users.find((u) => u.email === email)?.id;
}

async function upsertAuthUser(admin: SupabaseClient, user: { email: string }, password: string): Promise<string> {
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
  /** null = identidad sin organización ni equipo interno (invitado). */
  role: SeedUser["role"] | PlatformStaffRole | null;
  /** null = equipo interno o invitado (sin organización). */
  organizationId: string | null;
  /** Secreto TOTP (base32) de los org_admin y de los invitados con `totp`: lo usan los e2e para el paso de MFA. */
  totpSecret?: string;
}

// Borra los factores de MFA que queden de ejecuciones anteriores (con la clave
// secreta local): cada ejecución empieza sin MFA.
async function resetFactors(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  check("mfa.listFactors", error);
  for (const factor of data?.factors ?? []) {
    const removed = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    check("mfa.deleteFactor", removed.error);
  }
}

// Alta y verificación de un factor TOTP como lo haría la persona desde la app
// (migración admin_mfa: un org_admin necesita aal2 para cualquier cambio).
// Devuelve el secreto, que solo se guarda en credentials.local.json.
async function enrollTotp(local: LocalSupabase, email: string, password: string): Promise<string> {
  const client = createClient(local.apiUrl, local.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  check(`signIn ${email}`, signIn.error);
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp", issuer: "Desarrollo local" });
  check("mfa.enroll", enrolled.error);
  if (!enrolled.data) throw new Error(`mfa.enroll no devolvió el factor de ${email}`);
  const verified = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret) });
  check("mfa.verify", verified.error);
  // Vacía los fallos del freno de este email (los suyos, como un login con
  // éxito): pasadas de e2e seguidas no deben depender de las anteriores (R-30).
  const cleared = await client.rpc("login_record_success");
  check("login_record_success", cleared.error);
  const signOut = await client.auth.signOut({ scope: "local" });
  check("signOut", signOut.error);
  return enrolled.data.totp.secret;
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

function readServerKeys(): Record<string, string> {
  if (!existsSync(serverKeysFile)) return {};
  return JSON.parse(readFileSync(serverKeysFile, "utf8")) as Record<string, string>;
}

async function main(): Promise<void> {
  const local = readLocalSupabase();
  const { apiUrl, secretKey } = local;
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

  // Agentes propios (ADR 0030). Los de serie los crea la base de datos al dar de
  // alta cada organización (20261023150000_agent_catalog).
  const agentTypes = await admin.from("agent_types").upsert(
    seedCustomAgentTypes.map((t) => ({
      id: t.id,
      organization_id: t.organizationId,
      origin: "custom",
      key: t.key,
      name: t.name,
      description: t.description,
      color: t.color,
    })),
  );
  check("agent_types", agentTypes.error);
  const customAgents = await admin.from("agents").upsert(
    seedCustomAgentTypes.map((t) => ({ organization_id: t.organizationId, agent_type_id: t.id })),
    { onConflict: "organization_id,agent_type_id", ignoreDuplicates: true },
  );
  check("agents", customAgents.error);

  // Clave de servidor del freno del login (migración login_throttle): en la
  // base de datos solo se registra su hash.
  const serverKeys = readServerKeys();
  const loginThrottleKey = serverKeys.login_throttle ?? randomBytes(32).toString("base64url");
  const registered = await admin.rpc("register_server_key", {
    p_name: "login_throttle",
    p_key_hash: createHash("sha256").update(loginThrottleKey).digest("hex"),
  });
  check("server_keys", registered.error);
  mkdirSync(dirname(serverKeysFile), { recursive: true });
  writeFileSync(serverKeysFile, JSON.stringify({ ...serverKeys, login_throttle: loginThrottleKey }, null, 2), { mode: 0o600 });

  const credentials: SeedCredential[] = [];
  const userIds = new Map<string, string>();
  for (const user of seedUsers) {
    // 24 caracteres aleatorios + minúscula, mayúscula y dígito garantizados
    // (config.toml exige lower_upper_letters_digits).
    const password = `${randomBytes(18).toString("base64url")}aA1`;
    const userId = await upsertAuthUser(admin, user, password);
    userIds.set(user.key, userId);

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

    await resetFactors(admin, userId);
    const totpSecret = user.role === "org_admin" ? await enrollTotp(local, user.email, password) : undefined;
    credentials.push({
      key: user.key,
      email: user.email,
      password,
      role: user.role,
      organizationId: user.organizationId,
      ...(totpSecret ? { totpSecret } : {}),
    });
  }

  // Una misma persona en varias organizaciones (e2e de organización activa).
  for (const extra of seedExtraMemberships) {
    const userId = userIds.get(extra.userKey);
    if (!userId) throw new Error(`seedExtraMemberships: no existe el usuario ${extra.userKey}`);
    const membership = await admin.from("memberships").upsert(
      {
        user_id: userId,
        organization_id: extra.organizationId,
        role: extra.role,
        scope_region_ids: extra.scopeRegionIds,
        scope_location_ids: extra.scopeLocationIds,
      },
      { onConflict: "user_id,organization_id" },
    );
    check("memberships (adicional)", membership.error);
  }

  for (const guest of seedGuests) {
    const password = `${randomBytes(18).toString("base64url")}aA1`;
    const userId = await upsertAuthUser(admin, guest, password);
    const profile = await admin.from("users").upsert({ id: userId, full_name: guest.fullName });
    check("users", profile.error);
    // Sin organización: se le quita lo que haya aceptado en ejecuciones anteriores.
    const cleanup = await admin.from("memberships").delete().eq("user_id", userId);
    check("memberships (invitado)", cleanup.error);
    await resetFactors(admin, userId);
    const totpSecret = guest.totp ? await enrollTotp(local, guest.email, password) : undefined;
    credentials.push({
      key: guest.key,
      email: guest.email,
      password,
      role: null,
      organizationId: null,
      ...(totpSecret ? { totpSecret } : {}),
    });
  }

  // Equipo interno (ADR 0021, D4): cuentas dedicadas, sin membership (D2).
  // Conceder o revocar es una operación de plataforma: aquí, con la clave
  // secreta local; nunca desde apps/web.
  for (const staff of seedPlatformStaff) {
    // Mismo formato que el resto: sin el sufijo, ~5 % de las contraseñas no
    // tenían dígito y Auth las rechazaba (el seed fallaba de forma intermitente).
    const password = `${randomBytes(18).toString("base64url")}aA1`;
    const userId = await upsertAuthUser(admin, staff, password);

    const profile = await admin.from("users").upsert({ id: userId, full_name: staff.fullName });
    check("users", profile.error);
    const row = await admin
      .from("platform_staff")
      .upsert({ user_id: userId, role: staff.role, revoked_at: staff.revokedAt }, { onConflict: "user_id" });
    check("platform_staff", row.error);

    credentials.push({ key: staff.key, email: staff.email, password, role: staff.role, organizationId: null });
  }

  mkdirSync(dirname(credentialsFile), { recursive: true });
  writeFileSync(credentialsFile, JSON.stringify({ generatedAt: new Date().toISOString(), users: credentials }, null, 2), {
    mode: 0o600,
  });

  console.log(
    `Seed aplicado: ${seedOrganizations.length} organizaciones, ${seedRegions.length} región, ` +
      `${seedLocations.length} locales, ${seedUsers.length} usuarios, ${seedPlatformStaff.length} del equipo interno, ` +
      `${seedGuests.length} sin organización. Credenciales en ${credentialsFile}`,
  );
}

await main();
