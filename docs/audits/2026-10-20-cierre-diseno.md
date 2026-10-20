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
- **Límite conocido:** las frases que el JSX parte alrededor de una variable («Borrar los datos de {nombre}») se traducen por trozos, y el orden de las palabras puede quedar algo forzado. En `apps/web` se hará con next-intl y mensajes con parámetros; estos diccionarios sirven de punto de partida.

## 4. Accesibilidad (commit 4e59496)
- axe-core 4.10 (wcag2a, wcag2aa, wcag21a, wcag21aa) en las 67 pantallas, en claro y en oscuro: **0 fallos**. Antes había 34 pantallas con fallos: contraste, enlaces distinguidos solo por el color, campos sin etiqueta y un `tablist` con hijos no permitidos.
- Diálogos (14): el foco entra al abrir, Tab no sale del diálogo, Escape lo cierra y el foco vuelve a quien lo abrió (`components/dialog-a11y.jsx`). Comprobado con Playwright en claro y en oscuro (24/24 casos y el de Revisar), con axe sobre cada diálogo abierto.
- Por esto cambian algunos tokens (grises de texto) y el modo claro deja de ser idéntico píxel a píxel en esos textos. Es intencionado.

## 5. Lienzo de diseño
- «Moodly Landing Pages» (https://claude.ai/artifact/BoLfJGSVxG4tGv6DmLYQfv), versión 72. Las 67 pantallas se volvieron a capturar y se ordenaron por áreas (operación diaria, agentes, alta, IA y cumplimiento, configuración, móvil). Debajo de cada fila va su versión en oscuro, y se añadió una sección de idiomas (inicio, aprobaciones, agentes, revisar y móvil en EN, FR y DE). La web comercial no cambia de contenido; solo se reordenó en una fila.

## Verificación
- `pnpm --filter @repo/site build`: 141 páginas sin errores.
- `apps/site/scripts/audit-prototipo.py apps/site/src`: 0 problemas.
- Capturas: 149, sin errores de JS.

## Pendiente
- El componente «Menú lateral» del lienzo es HTML del 9 de octubre y no refleja la navegación actual.
- Llevar a `apps/web` el sistema de tokens, la i18n con next-intl y el Dialog accesible de `packages/ui`.
