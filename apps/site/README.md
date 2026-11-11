# @repo/site — web pública de moodlycrm.com (prototipo)

Dominio: `moodlycrm.com` (decisión de producto del 2026-10-24). La marca «Moodly» sigue siendo provisional.

Landings generadas a partir del canvas de diseño (ver `docs/design/traspaso-canvas-2026-10-06.md`):
`/`, `/agentes`, `/sectores`, `/precios`, `/seguridad`, `/integraciones`, `/implantacion`, `/casos`.

- Local: `pnpm --filter @repo/site dev` → http://127.0.0.1:3001
- Sin «Entrar» en la web pública hasta que exista producción: la web nunca apunta a staging (decisión de producto del 2026-11-10).
- El prototipo de la plataforma (`/plataforma`) lleva en cada ruta el aviso «Prototipo con datos ficticios» y `noindex`; desde la web solo se llega por «Ver el prototipo (datos ficticios)» en `/producto` (N-04).

**Estado: prototipo visual.** Las páginas se generaron automáticamente desde el canvas (estilos en línea, JSX en `.jsx`).
Antes de producción hay que: pasarlas a componentes de `packages/ui` y tokens, tipar en TypeScript strict,
añadir i18n, tests y lint, y decidir con producto dónde vive la web pública (MANUAL §18, ADR).
Las cifras de marketing siguen como `[placeholders]` a propósito.
