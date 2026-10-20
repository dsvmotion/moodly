# Cierre del diseño del prototipo — 2026-10-20

Rama `feat/cierre-diseno`. Alcance pedido por producto: pantallas que faltaban, modo oscuro, inglés/francés/alemán, accesibilidad y lienzo de diseño actualizado. Sigue siendo **prototipo** (`apps/site/src/app/plataforma`): datos fijos, sin backend.

## 1. Pantallas que faltaban (commit 74d44ee)
- Seguridad: verificación en dos pasos (QR, código, 8 códigos de recuperación), SSO SAML en 4 pasos (dominio por TXT, proveedor, prueba, aplicar con acceso de emergencia), lista de IP con validación CIDR, token SCIM que se muestra una sola vez, cerrar todas las sesiones.
- Claves de API (crear con permisos y caducidad, se muestra una vez, revocar), ficha de integración (salud, permisos, actividad, reconectar, desconectar), registro de auditoría (filtros, búsqueda, detalle, exportación CSV real) y facturación (tarjeta, NIF/CIF validado, facturas).
- Los secretos de demostración salen de `crypto.getRandomValues`.

## 2. Modo oscuro (commit 79734d8)
- 47 tokens de color en `globals.css`, con valores en claro y en oscuro; 79 archivos pasados a tokens.
- Claro / oscuro / sistema en Preferencias y en el menú de usuario; un script en `<head>` evita el destello al cargar.
- El modo claro quedó idéntico píxel a píxel (66/67 pantallas; Preferencias cambia a propósito).

## 3. Inglés, francés y alemán (commit 6732d31)
- Una capa de traducción en el navegador (`components/plataforma-i18n.jsx`) sustituye los textos ya pintados. Usa tres cosas: un diccionario por idioma (unos 2.100 textos, sacados de recorrer las 67 pantallas y del código), patrones para horas y fechas, y frases compuestas separadas por « · ». Un MutationObserver traduce lo que React pinta después.
- El idioma se elige en Preferencias, en el perfil, en los ajustes del móvil y en el menú de usuario; la elección se guarda en `localStorage`. `<html lang>` cambia con el idioma y no hay destello en español al cargar.
- La palabra para confirmar el borrado RGPD sigue el idioma (BORRAR / DELETE / SUPPRIMER / LÖSCHEN).
- Comprobado: el recorrido de cobertura de las 67 pantallas en cada idioma solo deja nombres propios, marcas y palabras que son iguales en los dos idiomas. Se probó el cambio en vivo de es a de, a fr y otra vez a es.
- **Frases con huecos (commit b54c47f):** las 73 frases que el JSX partía alrededor de una variable («Borrar los datos de {nombre}») son ahora un solo texto, y la capa las traduce como plantillas (`plataforma-i18n/plantillas.<idioma>.json`). Cada idioma tiene su orden natural, con huecos de texto (`{0}`, `{1}`…) y numéricos (`{n}`, `{n1}`…). Ejemplo: «Ihre Agenten haben heute 42 Aufgaben erledigt».
- En `apps/web` se hará con next-intl y mensajes con parámetros (ICU); los diccionarios y las plantillas sirven de punto de partida.

## 4. Accesibilidad (commit 4e59496)
- axe-core 4.10 (wcag2a, wcag2aa, wcag21a, wcag21aa) en las 67 pantallas, en claro y en oscuro: **0 fallos**. Antes había 34 pantallas con fallos: contraste, enlaces distinguidos solo por el color, campos sin etiqueta y un `tablist` con hijos no permitidos.
- Diálogos (14): el foco entra al abrir, Tab no sale del diálogo, Escape lo cierra y el foco vuelve a quien lo abrió (`components/dialog-a11y.jsx`). Comprobado con Playwright en claro y en oscuro (24/24 casos y el de Revisar), con axe sobre cada diálogo abierto.
- Por esto cambian algunos tokens (grises de texto) y el modo claro deja de ser idéntico píxel a píxel en esos textos. Es intencionado.

## 4b. Estados de cada pantalla (commit 393531e)
- Las 67 pantallas tienen cuatro estados: cargando (esqueleto con la forma de la pantalla), vacío (texto y acción propios), error (con reintento y código de referencia) y sin permiso (indica el rol necesario y permite pedir acceso). El vacío existe en las 45 pantallas donde tiene sentido; las demás son pasos de un flujo.
- La ficha de cada pantalla está en `components/screen-states-data.js` y el componente en `components/screen-states.jsx`. Se ven con `?estado=cargando|vacio|error|sin-permiso` o desde «Ver estados de pantalla» en el menú de usuario.
- Verificado: 237 casos en claro y 237 en oscuro, con el panel siempre presente, sin errores de JS y axe sin fallos. Traducidos a en/fr/de.

## 4c. Plataforma en móvil y tableta (commit c59440b)
- Por debajo de 900 px, el menú lateral (el principal y el de Configuración) pasa a un cajón que se abre desde una barra superior con acceso a Aprobaciones. El cajón es un diálogo modal: el foco entra, Tab no sale y Escape lo cierra.
- Las 54 pantallas de escritorio se reorganizan a 390 px sin desplazamiento horizontal. Las tablas anchas se desplazan dentro de su caja y se pueden alcanzar con el teclado.
- Conversaciones agrupa sus tres columnas para que la ficha no caiga bajo el menú en pantallas medianas.
- Verificado: 67 pantallas a 390 px en claro y en oscuro con axe sin fallos. Sin desplazamiento horizontal a 390, 768 y 820 px, y sin contenido bajo el menú entre 900 y 1440 px. El escritorio no tiene regresiones.

## 5. Lienzo de diseño
- «Moodly Landing Pages» (https://claude.ai/artifact/BoLfJGSVxG4tGv6DmLYQfv), versión 72. Las 67 pantallas se volvieron a capturar y se ordenaron por áreas (operación diaria, agentes, alta, IA y cumplimiento, configuración, móvil). Debajo de cada fila va su versión en oscuro, y se añadió una sección de idiomas (inicio, aprobaciones, agentes, revisar y móvil en EN, FR y DE). La web comercial no cambia de contenido; solo se reordenó en una fila. El componente «Menú lateral» (versión 73) ya tiene la navegación actual: Asistente arriba y la sección Red con Red de franquicias, cada una enlazada a su tablero.

## Verificación
- `pnpm --filter @repo/site build`: 141 páginas sin errores.
- `apps/site/scripts/audit-prototipo.py apps/site/src`: 0 problemas.
- Capturas: 149, sin errores de JS.

## Lienzo, versión 74
Nuevas secciones: «Plataforma en móvil», con las 54 pantallas a 390 px y el menú abierto, y «Estados», con los cuatro estados de Inicio, Conversaciones, Clientes, Mis agentes, Miembros y los Chats de la app móvil.

## Pendiente
- Llevar a `apps/web`: tokens y modo oscuro, i18n con next-intl (mensajes ICU a partir de los diccionarios y plantillas), estados con `Skeleton`/`EmptyState`/`ErrorState`, el cajón móvil con `Sheet` y el `Dialog` accesible de `packages/ui`. Es la reconstrucción del producto real, unida al backend.
