# 0018 — `packages/ui` exporta código fuente y criterios de dependencias de la interfaz

- **Estado:** propuesto
- **Fecha:** 2026-09-30
- **Secciones del MANUAL afectadas:** §3.3, §9.8, §9.9

## Contexto
La tarea 4 (app shell) necesita los componentes base de `packages/ui` (MANUAL §9.8), construidos con shadcn/ui, Tailwind CSS v4, TanStack Table y Virtual, `cmdk` e i18n.

El resto de librerías del monorepo se compilan con `tsc` a `dist/`. Ese modelo no encaja con shadcn/ui:
- Los componentes se importan entre sí por el nombre del paquete (`@repo/ui/components/...`), y `tsc` no reescribe esas rutas.
- Tailwind necesita leer el código fuente para generar las clases que se usan.
- Hay que conservar las directivas `"use client"` por archivo.

## Decisión
1. **`packages/ui` exporta código fuente** (`exports`: `./components/*`, `./lib/*`, `./hooks/*` y `./globals.css`), sin paso de build. `apps/web` lo compila con `transpilePackages: ["@repo/ui"]`, y Tailwind lo escanea con `@source` desde `@repo/ui/globals.css`. El paquete conserva `typecheck`, `lint` y `test`.
2. **Dependencias solo cuando se usan.** En la tarea 4 entran las necesarias para P1, P2 y P4. dnd-kit (kanban) y Recharts (gráficos) llegarán con sus pantallas.
3. **Versiones exactas y con antigüedad mínima**, respetando `minimumReleaseAge` de pnpm, sin excepciones. Si la última versión es de hace menos de unos días, se usa la anterior.
4. **Descartadas:**
   - `next-themes`: sin publicaciones en un año. El modo claro/oscuro se resuelve con una cookie leída en el servidor.
   - `eslint-plugin-jsx-a11y`: solo admite ESLint ≤ 9 y lleva dos años sin publicaciones. La accesibilidad se verifica con axe en los e2e y con navegación por teclado.
5. **Scripts de instalación bloqueados** (comportamiento por defecto de pnpm 11) para `@swc/core` y `@parcel/watcher`, que llegan por `next-intl`. Traen binarios precompilados por plataforma y la build no los necesita.

## Alternativas consideradas
- **Compilar `packages/ui` a `dist` con `tsc`:** rompe los imports entre componentes y obliga a mantener una build en modo watch en desarrollo.
- **Compilarlo con un bundler (tsup) a `dist`:** es otra herramienta más, y hay que cuidar que se conserven `"use client"` y el CSS. No aporta nada mientras la única consumidora sea `apps/web`.

## Consecuencias
- `@repo/ui` solo se puede consumir desde una app que lo compile (Next con `transpilePackages`). Si mañana hay otra consumidora (el worker no la necesita), se revisa esta decisión.
- `turbo run build` ya no construye `@repo/ui`: se valida con `typecheck`, `lint` y `test`, y dentro de la build de `apps/web`.

## Verificación
- `pnpm check`: 51/51 tareas, también sin caché.
- La hoja de estilos compilada de `apps/web` incluye las capas de Tailwind v4 (`theme`, `base`, `components` y `utilities`).
- e2e: 30/30. El test nuevo de axe sobre `/login` pasa, y falla si se quita la etiqueta de un campo (prueba negativa).
