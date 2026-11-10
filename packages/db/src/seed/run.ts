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
import pg from "pg";
import { readLocalSupabase, type LocalSupabase } from "./local-supabase.ts";
import { totp } from "./totp.ts";
import {
  SEED_APPROVALS_ORG,
  SEED_VOLUME,
  seedApprovals,
  seedCustomAgentTypes,
  seedExtraMemberships,
  seedGuests,
  seedInboxConversations,
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
// Claves de servidor locales (p. ej. LOGIN_THROTTLE_KEY y la contraseña local de
// dbos_worker). Se reutilizan entre ejecuciones para no invalidar los .env.local;
// `pnpm --filter @repo/web env:local` y `pnpm --filter @repo/worker env:local`
// las copian allí. Ignorado por git, permisos 0600.
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
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
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

// Rol del worker (migración dbos_worker_role): nace sin login. En local, el
// seed se lo da con una contraseña que se reutiliza entre ejecuciones, como las
// claves de servidor, para no invalidar apps/worker/.env.local.
async function enableWorkerDbLogin(dbUrl: string, password: string): Promise<void> {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // ALTER ROLE no admite parámetros: format(%L) entrecomilla la contraseña.
    const { rows } = await client.query<{ stmt: string }>(
      "select format('alter role dbos_worker with login password %L', $1::text) as stmt",
      [password],
    );
    const stmt = rows[0]?.stmt;
    if (!stmt) throw new Error("no se pudo preparar el ALTER ROLE de dbos_worker");
    await client.query(stmt);
  } finally {
    await client.end();
  }
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

  const orgs = await admin
    .from("organizations")
    .upsert(seedOrganizations.map((o) => ({ id: o.id, name: o.name, vertical: o.vertical, default_locale: o.defaultLocale })));
  check("organizations", orgs.error);
  const regions = await admin
    .from("regions")
    .upsert(seedRegions.map((r) => ({ id: r.id, organization_id: r.organizationId, name: r.name })));
  check("regions", regions.error);
  const locations = await admin
    .from("locations")
    .upsert(seedLocations.map((l) => ({ id: l.id, organization_id: l.organizationId, region_id: l.regionId, name: l.name })));
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
  const workerDbPassword = serverKeys.worker_db_password ?? randomBytes(24).toString("base64url");
  await enableWorkerDbLogin(local.dbUrl, workerDbPassword);
  writeFileSync(
    serverKeysFile,
    JSON.stringify({ ...serverKeys, login_throttle: loginThrottleKey, worker_db_password: workerDbPassword }, null, 2),
    { mode: 0o600 },
  );

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

  // Aprobaciones pendientes de Demo A (paso 4d-3d). Se borran y se vuelven a
  // crear: una decidida no vuelve a pendiente. El agente es el que reserva
  // (tiene book_appointment), sin escribir aquí la clave de ningún agente.
  const bookSkill = await admin.from("skills").select("id").eq("key", "book_appointment").is("organization_id", null).single();
  check("skills", bookSkill.error);
  const bookingAgent = await admin
    .from("agent_skills")
    .select("agent_id")
    .eq("organization_id", SEED_APPROVALS_ORG)
    .eq("skill_id", bookSkill.data?.id ?? "")
    .limit(1)
    .single();
  check("agent_skills", bookingAgent.error);
  const removed = await admin
    .from("agent_runs")
    .delete()
    .in(
      "id",
      seedApprovals.map((approval) => approval.runId),
    );
  check("agent_runs", removed.error);
  const expiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
  for (const approval of seedApprovals) {
    const inputHash = createHash("sha256").update(`seed:${approval.key}`).digest("hex");
    const run = await admin.from("agent_runs").insert({
      id: approval.runId,
      organization_id: SEED_APPROVALS_ORG,
      location_id: approval.locationId,
      agent_id: bookingAgent.data?.agent_id ?? "",
      trigger: "inbound_message",
      status: "awaiting_approval",
    });
    check("agent_runs", run.error);
    const execution = await admin.from("executions").insert({
      id: approval.executionId,
      organization_id: SEED_APPROVALS_ORG,
      location_id: approval.locationId,
      run_id: approval.runId,
      skill_key: approval.skillKey,
      skill_version: 1,
      effect_class: approval.effectClass,
      autonomy_applied: "draft",
      input: approval.input,
      target: { kind: "none" },
      input_hash: inputHash,
      preview: { summary: approval.summary },
      status: "drafted",
      idempotency_key: `seed:${approval.key}`,
    });
    check("executions", execution.error);
    const pending = await admin.from("approvals").insert({
      id: approval.approvalId,
      execution_id: approval.executionId,
      organization_id: SEED_APPROVALS_ORG,
      location_id: approval.locationId,
      effect_class: approval.effectClass,
      input_hash: inputHash,
      required_role: "staff",
      reason: approval.summary,
      expires_at: expiresAt,
    });
    check("approvals", pending.error);
  }

  // La bandeja de conversaciones (V2): las de Demo A y la de C1 para tomar el
  // control. Las conversaciones se borran y se vuelven a crear con sus mensajes
  // (que caen en cascada), así que cada ejecución deja los mismos modos y el
  // mismo orden. Las lleva, en cada organización, el agente que reserva (el de
  // las aprobaciones), sin escribir aquí la clave de ningún agente.
  const inboxAgents = new Map<string, { id: string; key: string }>();
  for (const organizationId of new Set(seedInboxConversations.map((conversation) => conversation.organizationId))) {
    const skill = await admin
      .from("agent_skills")
      .select("agent_id")
      .eq("organization_id", organizationId)
      .eq("skill_id", bookSkill.data?.id ?? "")
      .limit(1)
      .single();
    check("agent_skills", skill.error);
    const agent = await admin
      .from("agents")
      .select("agent_type_id")
      .eq("id", skill.data?.agent_id ?? "")
      .single();
    check("agents", agent.error);
    const type = await admin
      .from("agent_types")
      .select("key")
      .eq("id", agent.data?.agent_type_id ?? "")
      .single();
    check("agent_types", type.error);
    inboxAgents.set(organizationId, { id: skill.data?.agent_id ?? "", key: type.data?.key ?? "" });
  }
  const removedConversations = await admin
    .from("conversations")
    .delete()
    .in(
      "id",
      seedInboxConversations.map((conversation) => conversation.id),
    );
  check("conversations", removedConversations.error);
  const seededAt = Date.now();
  for (const conversation of seedInboxConversations) {
    const organizationId = conversation.organizationId;
    const agent = inboxAgents.get(organizationId) ?? { id: "", key: "" };
    // La cuenta del canal: la de pruebas es la misma que crea send_test_message
    // para ese local; las demás, una por canal y local del seed.
    const place = conversation.locationId ?? "org";
    const externalId =
      conversation.channel === "test" ? `test:${organizationId}:${place}` : `seed:${conversation.channel}:${place}`;
    const account = await admin.from("channel_accounts").upsert(
      {
        organization_id: organizationId,
        location_id: conversation.locationId,
        channel: conversation.channel,
        external_id: externalId,
        default_agent_type: agent.key,
        status: "active",
      },
      { onConflict: "channel,external_id", ignoreDuplicates: true },
    );
    check("channel_accounts", account.error);
    const accountRow = await admin
      .from("channel_accounts")
      .select("id")
      .eq("channel", conversation.channel)
      .eq("external_id", externalId)
      .single();
    check("channel_accounts", accountRow.error);

    const contact = await admin
      .from("contacts")
      .upsert({ id: conversation.contactId, organization_id: organizationId, display_name: conversation.contactName });
    check("contacts", contact.error);
    const created = await admin.from("conversations").insert({
      id: conversation.id,
      organization_id: organizationId,
      location_id: conversation.locationId,
      contact_id: conversation.contactId,
      channel_account_id: accountRow.data?.id ?? "",
      // La base de datos lo pone igual al de la cuenta (validate_conversation); el tipo lo pide.
      channel: conversation.channel,
      agent_id: agent.id,
      mode: conversation.mode,
    });
    check("conversations", created.error);
    const messages = await admin.from("messages").insert(
      conversation.messages.map((message) => ({
        organization_id: organizationId,
        conversation_id: conversation.id,
        direction: message.author === "contact" ? "in" : "out",
        author: message.author,
        content: message.content,
        status: message.status ?? (message.author === "contact" ? "received" : "sent"),
        created_at: new Date(seededAt - message.minutesAgo * 60_000).toISOString(),
      })),
    );
    check("messages", messages.error);
  }
  // Cada mensaje de un cliente deja un message.received para el agente. Los del
  // seed son historia, no mensajes nuevos: se marcan como publicados para que
  // un worker en marcha (la integración del CI) no les responda ni cambie de
  // modo las conversaciones que los e2e esperan tal cual.
  const quietEvents = await admin
    .from("domain_events")
    .update({ published_at: new Date().toISOString() })
    .in("organization_id", [...inboxAgents.keys()])
    .eq("type", "message.received")
    .is("published_at", null)
    .in(
      "payload->>conversation_id",
      seedInboxConversations.map((conversation) => conversation.id),
    );
  check("domain_events", quietEvents.error);

  // Volumen de Demo F para los e2e de M-07 (SEED_VOLUME): se borra y se vuelve a
  // crear todo lo de la organización en cada ejecución.
  {
    const org = SEED_VOLUME.organizationId;
    const skill = await admin
      .from("agent_skills")
      .select("agent_id")
      .eq("organization_id", org)
      .eq("skill_id", bookSkill.data?.id ?? "")
      .limit(1)
      .single();
    check("agent_skills (F)", skill.error);
    const agentId = skill.data?.agent_id ?? "";
    const agent = await admin.from("agents").select("agent_type_id").eq("id", agentId).single();
    check("agents (F)", agent.error);
    const type = await admin.from("agent_types").select("key").eq("id", agent.data?.agent_type_id ?? "").single();
    check("agent_types (F)", type.error);

    check("conversations (F)", (await admin.from("conversations").delete().eq("organization_id", org)).error);
    check("agent_runs (F)", (await admin.from("agent_runs").delete().eq("organization_id", org)).error);

    const accounts = new Map<string, string>();
    for (const location of [SEED_VOLUME.f1, SEED_VOLUME.f2]) {
      const externalId = `seed:whatsapp:${location}`;
      const upserted = await admin.from("channel_accounts").upsert(
        { organization_id: org, location_id: location, channel: "whatsapp", external_id: externalId, default_agent_type: type.data?.key ?? "", status: "active" },
        { onConflict: "channel,external_id", ignoreDuplicates: true },
      );
      check("channel_accounts (F)", upserted.error);
      const row = await admin.from("channel_accounts").select("id").eq("channel", "whatsapp").eq("external_id", externalId).single();
      check("channel_accounts (F)", row.error);
      accounts.set(location, row.data?.id ?? "");
    }

    const f2 = SEED_VOLUME.f2Conversation;
    const f1 = Array.from({ length: SEED_VOLUME.openInF1 + SEED_VOLUME.closedInF1 }, (_, i) => ({
      n: i + 1,
      ...SEED_VOLUME.f1Conversation(i + 1),
      open: i < SEED_VOLUME.openInF1,
    }));
    const contacts = await admin.from("contacts").upsert([
      { id: f2.contactId, organization_id: org, display_name: f2.contactName },
      ...f1.map((c) => ({ id: c.contactId, organization_id: org, display_name: `Contacto F1 ${String(c.n).padStart(3, "0")}` })),
    ]);
    check("contacts (F)", contacts.error);
    const conversations = await admin.from("conversations").insert([
      { id: f2.id, organization_id: org, location_id: SEED_VOLUME.f2, contact_id: f2.contactId, channel_account_id: accounts.get(SEED_VOLUME.f2) ?? "", channel: "whatsapp", agent_id: agentId, mode: "human" },
      ...f1.map((c) => ({
        id: c.id,
        organization_id: org,
        location_id: SEED_VOLUME.f1,
        contact_id: c.contactId,
        channel_account_id: accounts.get(SEED_VOLUME.f1) ?? "",
        channel: "whatsapp",
        agent_id: agentId,
        mode: c.open ? "agent" : "closed",
      })),
    ]);
    check("conversations (F)", conversations.error);
    // Solo las abiertas de F1 y la de F2 llevan mensaje; las de F1, más recientes que la de F2.
    const volumeAt = Date.now();
    const messages = await admin.from("messages").insert([
      { organization_id: org, conversation_id: f2.id, direction: "in", author: "contact", content: "Hola desde F2", status: "received", created_at: new Date(volumeAt - 1_000 * 60_000).toISOString() },
      ...f1
        .filter((c) => c.open)
        .map((c) => ({
          organization_id: org,
          conversation_id: c.id,
          direction: "in",
          author: "contact",
          content: `Hola desde F1 (${c.n})`,
          status: "received",
          created_at: new Date(volumeAt - c.n * 60_000).toISOString(),
        })),
    ]);
    check("messages (F)", messages.error);
    const quiet = await admin
      .from("domain_events")
      .update({ published_at: new Date().toISOString() })
      .eq("organization_id", org)
      .eq("type", "message.received")
      .is("published_at", null);
    check("domain_events (F)", quiet.error);

    // Aprobaciones: las de F1 en una inserción y la de F2 después, en otra: created_at
    // lo pone la base de datos y no se puede cambiar (guard_approval).
    const volumeExpiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const pendingApprovals = async (
      label: string,
      items: { key: string; location: string; runId: string; executionId: string; approvalId: string; text: string }[],
    ) => {
      const runs = await admin.from("agent_runs").insert(
        items.map((a) => ({ id: a.runId, organization_id: org, location_id: a.location, agent_id: agentId, trigger: "inbound_message", status: "awaiting_approval" })),
      );
      check(`agent_runs (${label})`, runs.error);
      const executions = await admin.from("executions").insert(
        items.map((a) => ({
          id: a.executionId,
          organization_id: org,
          location_id: a.location,
          run_id: a.runId,
          skill_key: "reply",
          skill_version: 1,
          effect_class: "external_message",
          autonomy_applied: "draft",
          input: { text: a.text },
          target: { kind: "none" },
          input_hash: createHash("sha256").update(`seed:${a.key}`).digest("hex"),
          preview: { summary: `Responder: «${a.text}»` },
          status: "drafted",
          idempotency_key: `seed:${a.key}`,
        })),
      );
      check(`executions (${label})`, executions.error);
      const approvals = await admin.from("approvals").insert(
        items.map((a) => ({
          id: a.approvalId,
          execution_id: a.executionId,
          organization_id: org,
          location_id: a.location,
          effect_class: "external_message",
          input_hash: createHash("sha256").update(`seed:${a.key}`).digest("hex"),
          required_role: "staff",
          reason: `Responder: «${a.text}»`,
          expires_at: volumeExpiresAt,
        })),
      );
      check(`approvals (${label})`, approvals.error);
    };
    await pendingApprovals(
      "F1",
      Array.from({ length: SEED_VOLUME.pendingInF1 }, (_, i) => ({
        key: `f1_${i + 1}`,
        location: SEED_VOLUME.f1,
        ...SEED_VOLUME.f1Approval(i + 1),
        text: `Mensaje pendiente en F1 (${i + 1})`,
      })),
    );
    await pendingApprovals("F2", [{ key: "f2", location: SEED_VOLUME.f2, ...SEED_VOLUME.f2Approval }]);
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
