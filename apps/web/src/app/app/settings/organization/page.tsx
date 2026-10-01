import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { locationsInScope, membershipInScope } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";

function rows<T>(label: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error || !result.data) throw new Error(`No se pudo cargar ${label}: ${result.error?.message ?? "sin datos"}`);
  return result.data;
}

// "Mi organización": lo que el usuario conectado puede ver según RLS. Son
// consultas normales con su JWT, sin filtros propios: si RLS no dejara ver
// una fila, aquí no aparece. Sin diseño (tarea 4).
export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const supabase = await createClient();
  const { scope, context } = await resolveScope((await searchParams).scope);
  const t = await getTranslations("organizationPage");
  const tRecords = await getTranslations("records");

  const [organizationsResult, locationsResult, peopleResult] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("locations").select("id, name, status, region_id, region:regions(name)").order("name"),
    supabase
      .from("memberships")
      .select("id, role, scope_region_ids, scope_location_ids, user:users(full_name)")
      .order("role"),
  ]);
  const organizations = rows("organizaciones", organizationsResult);
  // El alcance (?scope=) acota lo que RLS ya deja ver.
  const locations = locationsInScope(
    scope,
    rows("locales", locationsResult).map((location) => ({ ...location, regionId: location.region_id })),
  );
  const people = rows("personas", peopleResult).filter((person) =>
    membershipInScope(
      { role: person.role, scopeRegionIds: person.scope_region_ids, scopeLocationIds: person.scope_location_ids },
      scope,
      context.locations,
    ),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 [&_h2]:mt-2 [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <section aria-labelledby="orgs">
        <h2 id="orgs">{t("organization")}</h2>
        <ul>
          {organizations.map((org) => (
            <li key={org.id} data-testid="organization">
              {org.name}
            </li>
          ))}
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
    </div>
  );
}
