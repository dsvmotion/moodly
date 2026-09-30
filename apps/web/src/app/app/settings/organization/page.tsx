import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function rows<T>(label: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error || !result.data) throw new Error(`No se pudo cargar ${label}: ${result.error?.message ?? "sin datos"}`);
  return result.data;
}

// "Mi organización": lo que el usuario conectado puede ver según RLS. Son
// consultas normales con su JWT, sin filtros propios: si RLS no dejara ver
// una fila, aquí no aparece. Sin diseño (tarea 4).
export default async function OrganizationPage() {
  await requireUser();
  const supabase = await createClient();

  const [organizationsResult, locationsResult, peopleResult] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("locations").select("id, name, status, region:regions(name)").order("name"),
    supabase.from("memberships").select("id, role, user:users(full_name)").order("role"),
  ]);
  const organizations = rows("organizaciones", organizationsResult);
  const locations = rows("locales", locationsResult);
  const people = rows("personas", peopleResult);

  return (
    <main>
      <h1>Mi organización</h1>

      <section aria-labelledby="orgs">
        <h2 id="orgs">Organización</h2>
        <ul>
          {organizations.map((org) => (
            <li key={org.id} data-testid="organization">
              {org.name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="locations">
        <h2 id="locations">Locales</h2>
        <ul>
          {locations.map((location) => (
            <li key={location.id} data-testid="location">
              <span data-testid="location-name">{location.name}</span>
              {" · "}
              {location.region?.name ?? "sin región"}
              {" · "}
              {location.status}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="people">
        <h2 id="people">Personas</h2>
        <ul>
          {people.map((person) => (
            <li key={person.id} data-testid="person">
              <span data-testid="person-name">{person.user.full_name ?? "(sin nombre)"}</span>
              {" · "}
              {person.role}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
