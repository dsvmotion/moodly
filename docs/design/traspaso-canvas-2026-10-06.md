# Traspaso de diseño: canvas de moodly.ai → `apps/web` y backend

> Fecha: 2026-10-06 · Autor: producto (Diego) con Claude Code.
> Estado: **propuesta**. No cambia `docs/MANUAL.md`; las diferencias con el MANUAL están en «Decisiones pendientes» y las decide producto.

## 1. Fuentes

| Qué | Dónde |
|---|---|
| Canvas con todas las pantallas (web, app de escritorio, app móvil y visión general) | https://claude.ai/artifact/BoLfJGSVxG4tGv6DmLYQfv |
| Sistema de diseño (tokens, componentes y guía de uso) | https://claude.ai/artifact/QJ3fALw4PVmWUqiyJqFc5P |
| Paleta de marca | `paleta moodly 2026.pdf` (producto) |

Ambos artefactos son privados: producto tiene que compartirlos desde el menú «Compartir» para que otras personas los abran.

Los datos que se ven en la app del canvas son de una clínica de demostración ficticia («Clínica Dental Sol»). En el repo, las pantallas se construyen con datos del seed (MANUAL §9.8), no con esos datos.

## 2. Identidad visual → tokens de `packages/ui`

El canvas resuelve la decisión de marca (MANUAL §18 #1) **si producto la aprueba**. Se aplica cambiando solo `packages/ui/src/styles/globals.css` (MANUAL §9.9: «la marca se aplica cambiando tokens, no componentes») y debe seguir pasando `src/styles/tokens.test.ts` (contraste AA).

Dirección: estructura y densidad de Langdock, pero más fácil de usar. Interfaz blanca, gris y negra. Azul y naranja saturados solo para detalles. Cada agente tiene su pareja de colores de la paleta.

| Token del repo | Claro | Oscuro | Uso en el diseño |
|---|---|---|---|
| `--background` | `#f4f4f5` | `#0b0b0c` | Fondo de página |
| `--surface` | `#ffffff` | `#161618` | Tarjetas, listas, paneles |
| `--foreground` | `#000000` | `#f4f4f5` | Texto principal, botón primario |
| `--muted-foreground` | `#5f5f63` | `#a1a1a6` | Texto secundario (equivale a negro al 55 %) |
| `--primary` / `--primary-foreground` | `#000000` / `#ffffff` | `#f4f4f5` / `#000000` | Botón primario (pill negra) |
| `--ring` | `#2457f5` | `#6e93ff` | Foco (y azul de detalles: enlaces, seleccionado) |
| `--border` | `#0000001a` | `#f4f4f51f` | Bordes de 1 px |
| `--radius` | `12px` en contenedores, pill (`800px`) en botones | | |
| `--font-sans` | Geist (Google Fonts) | | Tracking negativo; titulares en peso 400 |

Tokens nuevos que el diseño necesita (añadir con su test de contraste):

- `--brand-blue` `#2457f5` / `#6e93ff`: enlaces, enviar, seleccionado, plan recomendado.
- `--brand-orange` `#ff6301` con texto `#000000`: contadores de pendientes, «Nuevo». **Nunca como texto sobre blanco** (2,98:1).
- `--approval-bg` `#ffe8d6` / `--approval-fg` `#8e4e00`: todo lo que espera aprobación humana.
- `--success-*`, `--danger-*`: ver el sistema de diseño.
- Colores de agente: una pareja por agente (principal y alternativo).

| Agente (MANUAL) | Principal | Alternativo |
|---|---|---|
| `customer` | Rock Blue `#9dbecc` | White Linen `#f6f2e8` |
| `sales` | Clementine Orange `#ff6301` | Red Wine `#a30042` |
| `operations` | Deep Green `#004c39` | Sage Green `#a3c2a7` |
| `admin` | Coral Pink `#ffbab5` | Cinnamon `#8e4e00` |

> En el canvas los agentes se llaman Recepción (verde), Atención al cliente (azul), Comercial (naranja/granate) y Administración (rosa/canela). Ver «Decisiones pendientes» #1.

## 3. Mapa de pantallas del canvas → rutas y patrones del MANUAL (§9.3–9.4)

### App de escritorio (versión completa)

| Pantalla del canvas | Ruta MANUAL | Patrón | Backend que necesita (MANUAL) |
|---|---|---|---|
| App · Inicio | `/app` | P1 | Bandeja del día: aprobaciones, conversaciones escaladas, alertas de integración (§5, §7, §9.9 Realtime) |
| App · Conversaciones | `/app/inbox`, `/app/records/conversations/[id]` | P2 + P3 | Conversaciones, mensajes, acciones del agente intercaladas, tomar el control (§8) |
| App · Aprobaciones | `/app/approvals` | P2 + P4 | Cola de aprobaciones con vista previa de la acción (§5 motor de políticas) |
| App · Agenda | — (no está en el MANUAL) | P2 (vista calendario) | Integración de calendario (§7). Decidir si es ruta propia |
| App · Clientes | `/app/records/contacts`, `/[id]` | P2 · P3 | Contactos, actividad, memoria por contacto (§4, §6) |
| App · Leads | Etapas del cliente (§9.5) | P2 kanban | Etapas de lead y sincronización con CRM (§7) |
| App · Facturas e inventario | — | P2 | Integración de facturación e inventario (§7). Decidir ruta |
| App · Llamadas | `/app/inbox` (canal voz) | P2 + P3 | Canal de voz, transcripción y resumen (§8) |
| App · Informes | `/app/analytics` | P7 | Métricas por agente y local (§12, §15) |
| App · Agente | `/app/agents/[type]` | P5 | `agents`, `config_overrides` (tarea 5 de la Fase 0) |
| App · Conocimiento | `/app/records/knowledge` | P2 · P3 | Fuentes, ingesta y preguntas pendientes (§6) |
| App · Memoria del negocio | `/app/records/memory` y `/goals` | P2 · P3 | Memoria propuesta/activa y objetivos (§6, prioridad máxima) |
| App · Reglas y aprobaciones | `/app/settings/agents` (Modo avanzado) | P6 | Motor de políticas y techos de autonomía (§5) — **zona sensible** |
| App · Flujos automáticos | — | P6 | Disparadores y acciones (§5). Decidir si entra en Fase 1 |
| App · Horarios | `/app/settings/*` | P6 | Horarios por local y escalado a humano |
| App · Modo coach | `/app/coach` | P2 + P3 | Revisiones y recomendaciones con evidencia (§6, prioridad máxima) |
| App · Equipo y roles | `/app/settings/users` | P6 | Roles y membresías (ya existen) + invitaciones (tarea 3b) |
| App · Multisede | `/app/records/locations` | P2 · P3 + P7 | Locales y regiones (ya existen) + métricas |
| App · Integraciones | `/app/settings/integrations` | P6 | OAuth, estado y reconexión (§7) |
| App · Plan y consumo | `/app/settings/billing` | P6 | Consumo de IA, límites y avisos (§15) |
| App · Ajustes generales | `/app/settings/organization` | P6 | Datos del negocio, avisos, retención de datos (§11) |
| App · Onboarding | `/onboarding` | Asistente | §9.6 (ver decisión #3) |
| Componente · Menú lateral | `Sidebar` de `packages/ui` | — | Ya existe; ver decisión #2 |

### App móvil (solo lo esencial)

MANUAL §9.2/§9.9: en móvil la barra lateral se convierte en menú, y las aprobaciones y la bandeja son prioritarias. El canvas lo concreta en una **barra inferior de 5 pestañas**: Inicio, Chats, Aprobar, Agenda y Más.

- **Desde «Más»:** Clientes, Agentes (solo activar o pausar), Informes, Integraciones (solo reconectar), Plan y consumo, y Ajustes (avisos y cuenta).
- **Solo en escritorio:** la configuración de conocimiento, reglas, flujos, horarios y equipo. En móvil «Más» lo dice explícitamente.
- **Implementación:** las mismas rutas responsive, no una app aparte, salvo que producto decida otra cosa.

### Web comercial (fuera de `apps/web` autenticada)

Inicio, Agentes (página única con submenú de 4), Sectores (página única con submenú de 5), Precios con calculadora, Seguridad, Integraciones, Cómo funciona la implantación, Casos de cliente y menús desplegables.

- **Dónde va:** el MANUAL no define dónde vive la web pública. Propuesta: rutas públicas en `apps/web`, o un `apps/site` nuevo, que requiere ADR.
- **Placeholders:** las cifras de marketing siguen como `[placeholders]` a propósito, para no publicar datos inventados.

## 4. Decisiones pendientes (producto)

1. **Nombres de los agentes.**
   - MANUAL: `customer`, `sales`, `operations`, `admin`, que la barra lateral actual muestra como Clientes, Comercial y Mkt, Operaciones y Administración.
   - Canvas: Recepción (citas, agenda, voz), Atención al cliente, Comercial y Administración.
   - El reparto de funciones también difiere: la agenda está en Recepción en el canvas y en `operations` en el MANUAL.
2. **Barra lateral.**
   - MANUAL: Inicio, Coach, Aprobaciones, Bandeja, Tareas, Actividad, Analítica, Agentes, Registros, Vistas guardadas, Favoritos y Recientes. Ya está implementada.
   - Canvas: Operación, Agentes y Ajustes, con Agenda, Leads, Facturas y Llamadas.
   - Propuesta: mantener la estructura del MANUAL y añadir lo que falta como registros o vistas.
3. **Probar el agente.**
   - MANUAL §9.6, paso 5: probar el agente en un entorno de pruebas durante el onboarding.
   - Producto lo ha retirado del canvas porque la plataforma debe parecer un producto final.
   - Hay que decidir si se elimina del MANUAL o se mantiene solo dentro del onboarding.
4. **Marca.** Aprobar la paleta y los tokens de la §2 como cierre de MANUAL §18 #1, y registrarlo en un ADR.
5. **Precios.** Implantación de 1.000 a 5.000 € y mantenimiento de 50 a 100 €/mes, que cubre la plataforma y el consumo de IA. La calculadora del canvas usa una fórmula orientativa que hay que validar.
6. **Rutas sin equivalente en el MANUAL:** Agenda, Facturas e inventario, Flujos automáticos y la web pública.

## 5. Orden de trabajo propuesto

Siempre según `AGENTS.md`: una tarea por rama, construir → probar → verificar, y evidencia en el PR. Las zonas sensibles no se mergean de forma autónoma.

1. **Cerrar la tarea 4** tal como dice `STATUS.md`: login traducido e Inicio (P1) en `/app`. Los dos son PRs sensibles.
2. **Tokens de marca** (`packages/ui/src/styles/globals.css` y su test de contraste), solo cuando producto apruebe la decisión #4. Requiere un ADR de marca.
3. **Tarea 5:** catálogo de agentes y configuración con herencia. Es la base de «App · Agente» y «Reglas».
4. **Tarea 6:** worker con pg-boss.
5. **Fase 1** (bloqueada por MANUAL §18 #3–#5: vertical piloto, BSP de WhatsApp y proveedores LLM): Bandeja, Aprobaciones, Conocimiento, Memoria y Objetivos con datos reales, siguiendo el mapa de la §3.

Cada pantalla se implementa con componentes de `packages/ui` y datos del seed, no copiando el HTML del canvas. El canvas es referencia visual y de comportamiento.

## 6. Cómo verlo en local

Requisitos y comandos en `AGENTS.md`. Además, en un clon recién hecho hay que compilar primero los paquetes internos que exportan desde `dist/`, o la web falla con `Can't resolve '@repo/config'`:

```bash
pnpm install
pnpm db:start && pnpm db:seed && pnpm --filter @repo/web env:local
pnpm exec turbo run build --filter=@repo/web^...
pnpm --filter @repo/web dev   # http://127.0.0.1:3000
```

> Este paso de compilación no está documentado en `AGENTS.md`. Documentarlo (o hacer que `dev` dependa de `^build` en turbo) es un PR sensible: toca `AGENTS.md` y `turbo.json`.
