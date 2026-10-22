import { getTranslations } from "next-intl/server";
import { revokeInvitation } from "@/app/app/invitations-actions";
import Link from "next/link";
import { InviteForm } from "@/components/invitations/invite-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { locationsInScope, membershipInScope } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";

function rows<T>(label: string, result: { data: T[]; error: unknown }): T[] {
  if (result.error) throw new Error(`No se pudo cargar ${label}`, { cause: result.error });
  return result.data;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

// "Mi organización": la organización activa, con lo que el usuario conectado
// puede ver de ella según RLS. Consultas normales con su JWT, acotadas a la
// organización activa y leídas enteras por páginas (fetchAll). Sin diseño (tarea 4).
export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const supabase = await createClient();
  const { scope, context } = await resolveScope((await searchParams).scope);
  const t = await getTranslations("organizationPage");
  const tRecords = await getTranslations("records");
  const tInvitations = await getTranslations("invitations");
  const isAdmin = context.role === "org_admin";
  // Administrar exige el segundo factor (migración admin_mfa): sin él, RLS
  // rechaza cualquier cambio, así que no se ofrecen los formularios.
  const canAdminister = isAdmin && (await getSessionAal()) === "aal2";

  const organization = context.organization;
  const orgId = organization?.id ?? "";
  const [locationsResult, peopleResult] = organization
    ? await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("locations")
            .select("id, name, status, region_id, region:regions(name)")
            .eq("organization_id", orgId)
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("memberships")
            .select("id, role, scope_region_ids, scope_location_ids, user:users(full_name)")
            .eq("organization_id", orgId)
            .order("id")
            .range(from, to),
        ),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  // Invitaciones pendientes: RLS solo se las enseña a un org_admin.
  const pending =
    isAdmin && organization
      ? rows(
          "invitaciones",
          await fetchAll((from, to) =>
            supabase
              .from("invitations")
              .select("id, email, role, expires_at, created_at")
              .eq("organization_id", orgId)
              .is("accepted_at", null)
              .is("revoked_at", null)
              .gt("expires_at", new Date().toISOString())
              .order("id")
              .range(from, to),
          ),
        ).sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
  // El alcance (?scope=) acota lo que RLS ya deja ver.
  const locations = locationsInScope(
    scope,
    rows("locales", locationsResult)
      .map((location) => ({ ...location, regionId: location.region_id }))
      .sort(byName),
  );
  const people = rows("personas", peopleResult)
    .sort((a, b) => a.role.localeCompare(b.role))
    .filter((person) =>
    membershipInScope(
      { role: person.role, scopeRegionIds: person.scope_region_ids, scopeLocationIds: person.scope_location_ids },
      scope,
      context.locations,
    ),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 [&_h2]:mt-2 [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <SettingsTabs current="organization" />
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {isAdmin && !canAdminister ? (
        <p role="note" data-testid="mfa-required" className="rounded-md border p-3 text-sm">
          {t("mfaRequired")}{" "}
          <Link href="/app/settings/security" className="underline">
            {t("mfaLink")}
          </Link>
        </p>
      ) : null}

      <section aria-labelledby="orgs">
        <h2 id="orgs">{t("organization")}</h2>
        <ul>
          {organization ? <li data-testid="organization">{organization.name}</li> : null}
        </ul>
      </section>

      <section aria-labelledby="locations">
        <h2 id="locations">{t("locations")}</h2>
        <ul>
          {locations.map((location) => (
            <li key={location.id} data-testid="location">
              <span data-testid="location-name">{location.name}</span>
              {" · "}
              {location.region?.name ?? t("noRegion")}
              {" · "}
              {location.status === "active" || location.status === "inactive" ? tRecords(`status.${location.status}`) : location.status}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="people">
        <h2 id="people">{t("people")}</h2>
        <ul>
          {people.map((person) => (
            <li key={person.id} data-testid="person">
              <span data-testid="person-name">{person.user.full_name ?? "(sin nombre)"}</span>
              {" · "}
              {["org_admin", "region_manager", "location_manager", "staff"].includes(person.role) ? tRecords(`roles.${person.role}`) : person.role}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && organization ? (
        <section aria-labelledby="invitations" className="flex flex-col gap-3">
          <h2 id="invitations">{tInvitations("title")}</h2>
          <p className="text-sm">{tInvitations("help")}</p>
          {canAdminister ? (
            <InviteForm
              organizationId={organization.id}
              regions={context.regions.map((r) => ({ id: r.id, name: r.name }))}
              locations={context.locations.map((l) => ({ id: l.id, name: l.name }))}
            />
          ) : null}
          <h3 className="font-medium">{tInvitations("pending")}</h3>
          {pending.length === 0 ? (
            <p className="text-sm">{tInvitations("none")}</p>
          ) : (
            <ul>
              {pending.map((invitation) => (
                <li key={invitation.id} data-testid="pending-invitation" className="flex items-center gap-2">
                  <span data-testid="pending-invitation-email">{invitation.email}</span>
                  {" · "}
                  {tRecords(`roles.${invitation.role as "org_admin" | "region_manager" | "location_manager" | "staff"}`)}
                  {canAdminister ? (
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={invitation.id} />
                      <button type="submit" className="rounded-md border px-2 py-0.5 text-sm">
                        {tInvitations("revoke")}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
