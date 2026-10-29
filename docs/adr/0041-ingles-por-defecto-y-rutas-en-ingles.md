# 0041 — Inglés por defecto, idioma de la organización y rutas en inglés

- **Estado:** aceptado (decisión de producto del 2026-10-24; implementado en este PR)
- **Fecha:** 2026-10-29
- **Secciones del MANUAL afectadas:** §9.4 (mapa de rutas), §9.9 (idioma), §4 (`organizations.default_locale`)
- **Relación:** cambia el ADR 0023 §3 (rutas en español); roadmap v4 (B8 y «ADR propuesto 0041»); revisión del diseño §8

## Contexto

La interfaz salía en español por defecto y las rutas estaban en español (`/app/conversaciones`, `/app/ajustes/sedes`…), como fijó el ADR 0023 §3. Producto decidió el 2026-10-24 que el producto es **inglés por defecto con el español como alternativa**, con las rutas en inglés, y que la organización del piloto (Madrid) trabaja en español. Vender fuera de España no debe exigir retocar la interfaz, y una clínica española no debe obligar a cada persona a cambiar el idioma a mano.

Lo que ya había:

- next-intl con el idioma en una cookie (`locale`), sin prefijo en la URL, y los textos en `messages/{es,en}.json` con un test de paridad de claves;
- `organizations.default_locale` (por defecto `es-ES`, que nadie leía);
- `users.locale` (por defecto `es-ES`, que tampoco lee nadie).

## Decisión

1. **El idioma de la interfaz se decide así, en este orden** (`apps/web/src/i18n/request.ts`):
   1. el que eligió la persona (cookie `locale`, desde el menú de usuario o Preferencias);
   2. si no ha elegido, o la cookie trae un idioma que no tenemos, **el de su organización activa** (`organizations.default_locale`, una etiqueta BCP 47: `es-ES` → español);
   3. sin sesión ni organización, **inglés**.

   El login y el paso del código MFA salen en inglés salvo que el navegador ya tenga un idioma elegido: antes de completar el acceso no se sabe (ni RLS deja leer) de qué organización es la persona. Al cambiar de organización activa, la interfaz cambia con ella mientras la persona no haya elegido.
2. **Una organización nueva nace en inglés** (`default_locale` por defecto `en`). Las que ya existen conservan el suyo: la de demo de staging sigue en español, y el seed local pone las de demo en español salvo Demo E, en inglés, para probar el cambio de organización. `default_locale` se valida con un `check` de formato (`es`, `es-ES`, `ca-ES`…), porque el `org_admin` puede cambiarlo.
3. **Rutas en inglés, como identificadores estables** (no se traducen con el idioma de la interfaz): `/app/inbox`, `/app/approvals`, `/app/contacts`, `/app/settings/locations`… La tabla completa está en el MANUAL §9.4.
4. **Las rutas viejas redirigen** (`legacy-routes.ts`, `redirects()` de Next.js) con 307 y la query intacta: los marcadores y los enlaces de invitación ya compartidos (`/app/invitacion?token=…`) siguen funcionando. Temporales y no permanentes, para que un navegador no guarde para siempre una redirección que haya que corregir.
5. **Los agentes responden en el idioma del cliente final**, no en el de la interfaz ni en el de la organización. Se concreta con el primer agente que hable con clientes (B19).
6. **Los dos idiomas tienen siempre las mismas claves** (test de paridad que ya corre en el CI). Un texto nuevo va en los dos en el mismo PR.

## Alternativas consideradas

- **Guardar en la cookie el idioma de la organización al entrar.** Fija el idioma la primera vez y no sigue a la organización activa después; además, escribir cookies desde el login mezcla el acceso con las preferencias. Calcularlo en cada petición no cuesta consultas: el layout de la app ya lee las organizaciones de la persona (React `cache`).
- **Usar ya `users.locale` para la elección de la persona.** Seguiría a la persona entre dispositivos, pero hoy vale `es-ES` para todos sin que nadie lo haya elegido: leerlo haría que nadie siguiera a su organización. Se adoptará cuando la elección se guarde en la cuenta, pasando antes a admitir `null` («sin elegir»).
- **Prefijo de idioma en la URL** (`/en/app/…`). Útil para una web pública indexable; la app es privada y ya decide por cookie.
- **Mantener las rutas en español** (ADR 0023 §3). Con el inglés como idioma principal, unas rutas en español serían la única parte del producto que no lo es, y la revisión del diseño ya las usaba en inglés.

## Consecuencias

- Los e2e corren en el idioma que vería cada persona: el login, el MFA y quien no tiene organización, en inglés; dentro de una organización de demo, en español. Los tests que lo comprueban: `i18n`, `auth`, `active-org`, `invitations` (la persona invitada pasa del inglés al español al entrar en Demo C) y `legacy-routes`.
- `users.locale` sigue sin usarse y con un valor por defecto que no significa nada. Hay que cambiarlo antes de leerlo (punto anterior).
- El idioma de los correos de B4 (invitaciones) se decide en ese PR; lo natural es el de la organización que invita.
- Los documentos de diseño y las auditorías anteriores siguen citando las rutas en español: son históricos y mandan este ADR y el MANUAL (jerarquía del ADR 0023 §1).

## Verificación

- **Unitarios:** `localeFromTag` (etiquetas BCP 47, mayúsculas, vacías y desconocidas), las redirecciones (cada destino existe, las rutas viejas ya no, las concretas antes que la general de Ajustes) y la navegación con los tramos en inglés.
- **pgTAP `21_organization_locale` (7 tests):** una organización nueva nace en inglés; el formato se valida para cualquier rol, también para el `org_admin`. Mutación (sin el `check` y con el valor por defecto viejo): 5 de 7 fallan.
- **e2e 123/123,** con 2 nuevos (`legacy-routes`: el enlace de invitación viejo conserva el token sin sesión y con ella; cada sección vieja lleva a la nueva). Mutación (no leer el idioma de la organización): fallan 9 tests de `i18n`, `active-org`, `invitations` y `settings`.
