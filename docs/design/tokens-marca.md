# Tokens de marca — fuente única

Fecha: 2026-10-08 · Fuente de verdad: `packages/ui/src/styles/globals.css`.

Resuelve el lock-blocker §4.1 de `docs/audits/2026-10-08-auditoria-diseno.md`: un único sitio
define la paleta de marca. `apps/web` la consume directamente (Tailwind: `bg-agent-sales`,
`text-link`…). `apps/site` (prototipo) y el canvas usan los mismos valores; cuando una
pantalla se reconstruya en `apps/web` debe tomar el token, no el hex.

Todos los colores están en OKLCH con `light-dark(claro, oscuro)` y los pares texto/fondo
cumplen WCAG 2.1 AA; lo verifica `packages/ui/src/styles/tokens.test.ts` (70 asсерts, en CI).

## Colores de agente (constantes de marca; mismo valor en claro y oscuro)

| Token | Hex | OKLCH | Texto encima (`-foreground`) | Contraste | Agente |
|---|---|---|---|---|---|
| `--agent-reception` | `#004c39` | `0.3702 0.074 169.1` | blanco | 9,75:1 | Recepción (`customer`) |
| `--agent-customer` | `#9dbecc` | `0.7818 0.0408 225.48` | negro | 9,56:1 | Atención (`customer`) |
| `--agent-sales` | `#a30042` | `0.4579 0.1833 8.81` | blanco | 7,74:1 | Comercial (`sales`) |
| `--agent-admin` | `#8e4e00` | `0.4903 0.1144 60.47` | blanco | 6,30:1 | Administración (`admin`) |

## Marca

| Token | Hex | Uso |
|---|---|---|
| `--brand` | `#ff6301` | Naranja: **solo** insignias y contadores. Texto negro encima (`--brand-foreground`, 6,30:1). Nunca como texto sobre el fondo. |
| `--link` | `#2457f5` (claro) / azul aclarado (oscuro) | Enlaces. Texto sobre el fondo; AA en ambos modos (5,59:1 / 7,68:1). |

## Tipografía

| Token | Valor | Estado |
|---|---|---|
| `--font-sans` | Plus Jakarta Sans → fallbacks | Licencia abierta (SIL OFL). Segura para producción. Hay que **cargarla** en la app (`next/font`) para que se aplique. |
| `--font-display` | Labil Grotesk → `var(--font-sans)` | **Licencia webfont por confirmar** (riesgo conocido). No se carga la fuente todavía: cae a Plus Jakarta Sans hasta que producto valide la licencia. |

## Pendiente (siguiente incremento)

- Cargar Plus Jakarta Sans en `apps/web` con `next/font` y refrescar las capturas e2e.
- ADR «sistema de diseño y tokens» cuando se cierre la carga de fuentes y el consumo en `apps/site`.
- Confirmar la licencia de Labil Grotesk antes de activarla como `--font-display`.
