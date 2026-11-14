import "server-only";
import { queryWindow, type CalendarAppointment } from "@/lib/calendar";
import { locationFilter, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// Las citas de la agenda (OA03). Se leen con la sesión de quien mira, nunca con la
// service role: RLS (appointments_select = can_see_scope) solo deja ver las de los
// locales de su alcance, y el selector de alcance filtra en la consulta, como en
// las demás listas con tope (M-07). El servicio y el recurso se leen por scope
// (services_select, booking_resources_select); el nombre del contacto, solo si
// contacts_select lo deja ver: si no, la cita sale sin nombre.

/** Cuántas citas como mucho trae una vista; una semana de una cadena grande puede pasar. */
export const CALENDAR_LIMIT = 500;

const STATUSES = ["booked", "cancelled", "completed", "no_show"] as const;
const ORIGINS = ["agent", "user", "sync"] as const;

export async function loadCalendar(
  scope: Scope,
  context: ScopeContext,
  days: readonly string[],
): Promise<{ rows: CalendarAppointment[]; truncated: boolean }> {
  const organization = context.organization;
  if (!organization) return { rows: [], truncated: false };
  const locations = locationFilter(scope, context.locations);
  if (locations.kind === "only" && locations.locationIds.length === 0) return { rows: [], truncated: false };

  // La ventana, en las zonas de las sedes que se ven: el tope cuenta solo lo de los días visibles.
  const visibleZones = (locations.kind === "only"
    ? context.locations.filter((location) => locations.locationIds.includes(location.id))
    : context.locations
  ).map((location) => location.timeZone);
  const { from, to } = queryWindow(days, visibleZones);
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(
      "id, location_id, starts_at, ends_at, status, booked_by, service:services!appointments_service_same_org(name), resource:booking_resources!appointments_resource_same_org(name), contact:contacts!appointments_contact_same_org(display_name)",
    )
    .eq("organization_id", organization.id)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(CALENDAR_LIMIT + 1);
  if (locations.kind === "only") query = query.in("location_id", locations.locationIds);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las citas", { cause: error });

  const rows = data.slice(0, CALENDAR_LIMIT).flatMap((row): CalendarAppointment[] => {
    const status = STATUSES.find((value) => value === row.status);
    const bookedBy = ORIGINS.find((value) => value === row.booked_by);
    if (!status || !bookedBy) return [];
    // Con RLS, una relación que la persona no puede leer llega como null aunque el tipo diga otra cosa.
    const service = row.service as { name: string } | null;
    const resource = row.resource as { name: string } | null;
    const contact = row.contact as { display_name: string | null } | null;
    return [
      {
        id: row.id,
        locationId: row.location_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status,
        bookedBy,
        service: service?.name ?? null,
        resource: resource?.name ?? null,
        contact: contact?.display_name ?? null,
      },
    ];
  });
  return { rows, truncated: data.length > CALENDAR_LIMIT };
}
