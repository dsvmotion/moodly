-- Organización de demo de staging (auditoría R-34). La ejecuta el workflow
-- manual «Staging · organización de demo» (.github/workflows/staging-demo.yml),
-- nunca a mano. Idempotente: con identificadores fijos, una segunda ejecución
-- no duplica nada y vuelve a dejar a la persona como org_admin.
--
-- La persona ya existe en Auth (la crea producto en el panel de Supabase, con su
-- propia contraseña). El workflow sustituye __ADMIN_EMAIL__ por su email, ya
-- validado. Corre como postgres (plataforma): RLS no aplica y las guardas solo
-- actúan con `authenticated` (ADR 0003), así que aquí se respetan a mano: una
-- membership de org_admin sin alcance acotado y estructura coherente.
-- Sin datos reales: nombres de demo, sin direcciones ni personas inventadas.
-- Un solo comando: `supabase db query --file` lo ejecuta como sentencia
-- preparada, que no admite varios. El resumen va aparte
-- (staging-demo-summary.sql).

do $$
declare
  admin_email constant text := '__ADMIN_EMAIL__';
  org_id      constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01';
  region_id   constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d11';
  centro_id   constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d21';
  norte_id    constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d22';
  admin_id    uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower(admin_email);
  if admin_id is null then
    -- Sin el email en el mensaje: los logs del CI no llevan datos personales.
    raise exception 'No hay ninguna cuenta de Auth con ese email en staging. Créala antes en el panel de Supabase.';
  end if;

  insert into public.organizations (id, name, vertical)
  values (org_id, 'Clínica Demo', 'clinic')
  on conflict (id) do nothing;

  insert into public.regions (id, organization_id, name)
  values (region_id, org_id, 'Madrid')
  on conflict (id) do nothing;

  insert into public.locations (id, organization_id, region_id, name)
  values (centro_id, org_id, region_id, 'Centro'), (norte_id, org_id, region_id, 'Norte')
  on conflict (id) do nothing;

  insert into public.users (id, full_name)
  values (admin_id, nullif(trim((select raw_user_meta_data ->> 'full_name' from auth.users where id = admin_id)), ''))
  on conflict (id) do nothing;

  insert into public.memberships (user_id, organization_id, role)
  values (admin_id, org_id, 'org_admin')
  on conflict (user_id, organization_id)
  do update set role = 'org_admin', scope_region_ids = '{}', scope_location_ids = '{}', updated_at = now();
end
$$;

