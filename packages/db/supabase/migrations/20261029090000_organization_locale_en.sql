-- Inglés por defecto (ADR 0041, cambia el 0023 §3). La interfaz sale en el idioma
-- que elige cada persona; si no ha elegido, en el de su organización activa
-- (organizations.default_locale); y si no hay ninguno, en inglés.
--
-- - Una organización nueva nace en inglés. Las que ya existen conservan el suyo
--   (en staging, la organización de demo sigue en español).
-- - El idioma es una etiqueta BCP 47 corta (es, es-ES, en, en-GB, ca-ES): la web
--   lo convierte en uno de los idiomas de la interfaz y cae al inglés si no lo
--   tiene. El org_admin puede cambiarlo (guard_organization_update), así que se
--   valida el formato en la base de datos.
--
-- Vuelta atrás:
--   alter table public.organizations drop constraint organizations_default_locale_format;
--   alter table public.organizations alter column default_locale set default 'es-ES';

alter table public.organizations alter column default_locale set default 'en';

alter table public.organizations
  add constraint organizations_default_locale_format
  check (default_locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$');
