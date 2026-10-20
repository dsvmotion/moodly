# @repo/site — web pública de moodly.ai (prototipo)

Landings generadas a partir del canvas de diseño (ver `docs/design/traspaso-canvas-2026-10-06.md`):
`/`, `/agentes`, `/sectores`, `/precios`, `/seguridad`, `/integraciones`, `/implantacion`, `/casos`.

- Local: `pnpm --filter @repo/site dev` → http://127.0.0.1:3001
- «Entrar» lleva a la app (`apps/web`) en http://127.0.0.1:3000/login.

**Estado: prototipo visual.** Las páginas se generaron automáticamente desde el canvas (estilos en línea, JSX en `.jsx`).
Antes de producción hay que: pasarlas a componentes de `packages/ui` y tokens, tipar en TypeScript strict,
añadir i18n, tests y lint, y decidir con producto dónde vive la web pública (MANUAL §18, ADR).
Las cifras de marketing siguen como `[placeholders]` a propósito.
