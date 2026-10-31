import type { TenantDb } from "@repo/db/service";
import type { ReceptionCatalog } from "@repo/skills";

// Los nombres y la zona horaria que ve quien aprueba una cita (paso 4d-2), de
// la organización de este acceso: un servicio o un recurso de otro local, o
// inactivo, es como si no existiera (la vista previa lo dirá).
export function createReceptionCatalog(db: TenantDb): ReceptionCatalog {
  return {
    async describe({ locationId, serviceId, resourceId }) {
      const [location, service, resource] = await Promise.all([
        db.from("locations").select("timezone").eq("id", locationId).maybeSingle(),
        db.from("services").select("name, location_id, active").eq("id", serviceId).maybeSingle(),
        resourceId
          ? db.from("booking_resources").select("name, location_id, active").eq("id", resourceId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const error = location.error ?? service.error ?? resource.error;
      if (error) throw new Error(`no se pudo leer el catálogo (${error.code})`);
      if (!location.data || !service.data?.active) return null;
      if (service.data.location_id !== null && service.data.location_id !== locationId) return null;
      const resourceName = resource.data?.active && resource.data.location_id === locationId ? resource.data.name : null;
      return { service: service.data.name, resource: resourceName, timezone: location.data.timezone };
    },
  };
}
