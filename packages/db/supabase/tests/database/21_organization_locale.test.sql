-- Idioma de la organización (20261029090000_organization_locale_en.sql, ADR 0041).
begin;
\ir _fixtures/tenants.psql
select plan(7);

-- Una organización nueva nace en inglés; las del fixture ya tenían el suyo.
insert into public.organizations (name) values ('Nueva S.L.') returning default_locale as new_locale \gset
select is(:'new_locale'::text, 'en'::text, 'una organización nueva nace en inglés');

select lives_ok(
  format($$update public.organizations set default_locale = 'es-ES' where id = %L$$, :org_a),
  'es-ES es un idioma válido');
select lives_ok(
  format($$update public.organizations set default_locale = 'ca' where id = %L$$, :org_a),
  'ca también (solo el idioma)');
select throws_ok(
  format($$update public.organizations set default_locale = 'español' where id = %L$$, :org_a),
  '23514', null, 'un nombre de idioma no es una etiqueta');
select throws_ok(
  format($$update public.organizations set default_locale = 'es_ES' where id = %L$$, :org_a),
  '23514', null, 'el separador es el guion');
select throws_ok(
  format($$update public.organizations set default_locale = '' where id = %L$$, :org_a),
  '23514', null, 'no puede quedar vacío');

-- El org_admin lo cambia desde la app (guard_organization_update) y también pasa por el formato.
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$update public.organizations set default_locale = 'es-es' where id = %L$$, :org_a),
  '23514', null, 'org_admin: tampoco guarda un idioma mal escrito');
reset role;

select * from finish();
rollback;
