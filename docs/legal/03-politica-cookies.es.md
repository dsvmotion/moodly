> **BORRADOR — pendiente de revisión por un abogado; no publicar.**
> Preparado el 2026-11-12 por la sesión V13 · Legal a partir del código de `main` (`26cdc6d`). No es asesoramiento jurídico. Marco: art. 22.2 LSSI-CE y la *Guía sobre el uso de las cookies* de la AEPD (versión de julio de 2023) [verificar que no hay una versión posterior].

# Política de cookies

**Última actualización:** [FECHA DE PUBLICACIÓN]

## 1. Qué son

Las cookies y tecnologías parecidas (como el almacenamiento local del navegador) guardan información en tu dispositivo. Esta política explica cuáles usan la web pública de Moodly (moodlycrm.com) y la plataforma ([URL DE LA APP]).

## 2. Resumen

**Moodly solo usa cookies y almacenamiento técnicos o de preferencias que tú eliges.** No usamos cookies de analítica, de publicidad ni de terceros. Por eso no mostramos un aviso para pedir consentimiento: estas cookies están exentas según el artículo 22.2 de la LSSI-CE, porque son estrictamente necesarias para prestar el servicio que pides o guardan una preferencia que tú has elegido.

Si algún día añadimos cookies que necesiten consentimiento (por ejemplo, de analítica), actualizaremos esta política y te pediremos permiso antes de instalarlas.

## 3. Web pública (moodlycrm.com)

| Nombre | Tipo | Quién | Para qué | Duración |
|---|---|---|---|---|
| `NEXT_LOCALE` | Cookie | Moodly (propia) | Recordar el idioma que eliges con el selector de idioma. Solo se crea si cambias el idioma. | 1 año |
| `moodly-theme` | Almacenamiento local | Moodly (propio) | Recordar si eliges el tema claro u oscuro. | Hasta que lo borres |
| `moodly-plataforma-lang` | Almacenamiento local | Moodly (propio) | Idioma elegido dentro del prototipo de demostración (`/plataforma`). | Hasta que lo borres |
| `moodly.sede` | Almacenamiento local | Moodly (propio) | Local de ejemplo elegido dentro del prototipo de demostración. | Hasta que lo borres |

Los formularios de contacto y demo no guardan nada: abren tu programa de correo.

## 4. Plataforma (aplicación web)

| Nombre | Tipo | Quién | Para qué | Duración |
|---|---|---|---|---|
| `sb-[ref]-auth-token` (puede partirse en `.0`, `.1`…) | Cookie, `HttpOnly`, `Secure` | Moodly (propia, generada con la librería de Supabase Auth) | Mantener tu sesión iniciada de forma segura. | [Según la configuración por defecto de `@supabase/ssr`; verificar: hasta cerrar sesión o caducar la sesión] |
| `sb-[ref]-auth-token-code-verifier` | Cookie | Moodly (propia) | Completar de forma segura algunos flujos de inicio de sesión (PKCE). Solo existe durante el flujo. | Minutos [verificar] |
| `org` | Cookie, `HttpOnly`, `SameSite=Lax`, `Secure` | Moodly (propia) | Recordar la organización activa si perteneces a varias. | 1 año |
| `theme` | Cookie, `HttpOnly`, `SameSite=Lax`, `Secure` | Moodly (propia) | Tema claro u oscuro elegido en Preferencias. | 1 año |
| `locale` | Cookie, `HttpOnly`, `SameSite=Lax`, `Secure` | Moodly (propia) | Idioma elegido en Preferencias. | 1 año |
| `sidebar_collapsed` | Cookie, `HttpOnly`, `SameSite=Lax`, `Secure` | Moodly (propia) | Recordar si plegaste la barra lateral. | 1 año |
| `moodly-shell-v1` | Caché del *service worker* | Moodly (propia) | Que la app se pueda instalar y muestre una página sin conexión. Solo guarda iconos, el manifiesto y la página sin conexión; nunca páginas ni datos. | Hasta la siguiente versión de la app |

La monitorización de errores (Sentry) está configurada para no usar cookies ni enviar las tuyas.

## 5. Cómo gestionarlas

Puedes borrar o bloquear las cookies y el almacenamiento local desde la configuración de tu navegador. Si bloqueas las de la plataforma, no podrás iniciar sesión; si bloqueas las de preferencias, la web y la app usarán los valores por defecto.

## 6. Más información

Sobre el tratamiento de tus datos: Política de privacidad. Para dudas: [EMAIL DPO/CONTACTO].

---

### Notas para la asesoría (no forman parte del texto)

1. **Base de la exención:** la cookie de sesión es «técnica» (necesaria para el servicio pedido). Las de idioma, tema, barra lateral y organización activa son de «personalización» elegidas por el usuario, que la Guía de la AEPD considera exceptuadas cuando las elige el propio usuario [verificar el apartado concreto de la Guía].
2. **Coherencia:** la página publicada hoy (`apps/site/src/app/[lang]/cookies/copy.js`) habla de cookies analíticas «solo con tu consentimiento», de un aviso al entrar y de un enlace «Configurar cookies», que no existen. Se sustituye entera al publicar.
3. **Chat web para clientes finales:** cuando exista el widget de chat que los clientes de Moodly incrusten en su web (ADR 0052, M1), su almacenamiento se documenta aparte: lo instala la web del cliente, que es quien informa a sus visitantes.
4. **Mantenimiento:** cualquier PR que añada una cookie, almacenamiento local o un script de terceros debe actualizar esta tabla. Propuesta: un test que compare los nombres de cookie del código con esta lista.
