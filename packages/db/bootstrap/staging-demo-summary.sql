-- Resumen de la organización de demo de staging, sin datos personales
-- (workflow «Staging · organización de demo»).
select
  (select name from public.organizations where id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01') as organizacion,
  (select count(*) from public.locations where organization_id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01') as sedes,
  (select count(*) from public.memberships
    where organization_id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01' and role = 'org_admin') as org_admins;
