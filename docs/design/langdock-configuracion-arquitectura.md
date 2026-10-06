# Langdock · Configuración — diseño y arquitectura (extracción para Moodly)

> Revisión exhaustiva del área de **Configuración** de Langdock (sesión real, solo lectura), para fundamentar la arquitectura de la plataforma y el backend de Moodly.
> Fecha: 2026-10-07. Workspace observado: «Moodly» (cuenta de prueba, «Prueba caducada»).
> **Método:** recorrido de cada ruta de `/settings/*`, con lectura de cada pantalla, sus campos, opciones y textos. No se cambió ninguna configuración.
> Esto documenta el **patrón de referencia** (IA, entidades, permisos), no se copia su identidad visual.

## Mapa de rutas (IA de Configuración)

El área de ajustes es una pantalla a pantalla completa con su propia barra lateral, buscador («Buscar en ajustes») y 4 grupos. Rutas reales observadas:

### Personal — `/settings/account/*`
| Opción | Ruta |
| --- | --- |
| Perfil | `/settings/account/profile` |
| Preferencias | `/settings/account/preferences` |
| Uso y gasto | `/settings/account/usage` |
| Privacidad | `/settings/account/privacy` |
| Primeros pasos | `/settings/account/getting-started` |

### Gestión de usuarios — `/settings/workspace/user-management/*`
| Opción | Ruta |
| --- | --- |
| Miembros | `/settings/workspace/user-management/members` |
| Grupos | `/settings/workspace/user-management/groups` |
| Roles | `/settings/workspace/user-management/roles` |
| Uso y gasto | `/settings/workspace/usage` |

### Espacio de trabajo — `/settings/workspace/*`
| Opción | Ruta |
| --- | --- |
| Resumen | `/settings/workspace/overview` |
| General | `/settings/workspace/general` |
| Modelos | `/settings/workspace/models` |
| Analítica | `/settings/workspace/analytics` |
| Integraciones | `/settings/workspace/products/integrations` |
| Seguridad | `/settings/workspace/security` |
| Facturación | `/settings/workspace/billing` |
| Archivos | `/settings/workspace/library` |
| Personalización | `/settings/workspace/customizations` |
| Incorporación de usuarios | `/settings/workspace/onboarding` |

### Productos — `/settings/workspace/products/*`
| Opción | Ruta |
| --- | --- |
| Chat | `/settings/workspace/products/chat` |
| Agentes | `/settings/workspace/products/agents` |
| Skills & Workflows | `/settings/workspace/products/skills` (+ `/workflows-2`) |
| API, Complementos, Deep Research, Programado, Gobernanza, Conocimiento de la empresa | (pendiente de confirmar ruta — ver secciones) |

---
