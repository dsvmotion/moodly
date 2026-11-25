# Comprobación «nada perdido» del cierre de V1 (2026-11-24)

Cada punto que existía en el plan, las notas o las tareas de V1, o en los resúmenes de los workers, y dónde quedó escrito en el repo.

## Plan y estado
| Punto | Dónde quedó |
| --- | --- |
| Objetivo del producto, hitos M0–M5 y sus puertas | `docs/PLAN.md` (Objetivo, Fases); detalle por unidad en `docs/scope.yaml` |
| Ola 0 (cola de merge en orden) | `docs/STATUS.md` §a; `docs/specs/ola0-00` … `ola0-08` |
| Ola 1 (poda del toolkit, hook de secretos, #293/#302, puerto 54322) | `docs/PLAN.md`; `docs/specs/ola1-01-podar-toolkit.md` |
| Registro de decisiones (2026-10-22 → 2026-11-24) | `docs/PLAN.md` (Registro de decisiones) |
| Condiciones de salida a producción | `docs/reports/2026-11-24-status-anterior.md` (lista original) + `docs/STATUS.md` §c (lo que toca a Diego) + `docs/PLAN.md` M3 |
| STATUS anterior entero | `docs/reports/2026-11-24-status-anterior.md` (copia literal) |
| Mapa del código | `docs/ARCHITECTURE.md` |

## Despliegue y staging
| Punto | Dónde quedó |
| --- | --- |
| Despliegue de #337: verde, worker sano | `docs/STATUS.md` (Handoff); report de cierre §3 |
| Railway en Hobby; el trial quitó el worker el 22-11 | `docs/PLAN.md` (decisiones); report de cierre §4 |
| Actions sin arrancar del 16 al 23-11 | report de cierre §4 |
| Clave de evals renovada; evals reales 70/70 | `docs/PLAN.md`; `docs/STATUS.md` §e; report §1 |
| Supabase de staging en Free; Pro antes de datos reales | `docs/PLAN.md`; `docs/STATUS.md` §c; `docs/specs/ola0-05` paso 5 |
| Vercel: apagar el despliegue desde git sin comprobar | `docs/STATUS.md` §c; report §2 (V12) |

## Trabajo de las sesiones (resúmenes del 24-11)
| Sesión | Lo pendiente | Dónde quedó |
| --- | --- | --- |
| V2 | #313 → #317 → #336; #312; OA02 sin verificar en real | `ola0-01`, `ola0-06`; STATUS §a/§c/§d |
| V3 | SE14–SE18 por adoptar; aviso de seguridad de Next (resuelto con #326); F06 bloqueado | `ola0-05` paso 4; report §1; STATUS §c |
| V8 | #334 y sus 2 notas; WhatsApp sin verificar en real | `ola0-03`; STATUS §a/§c/§d |
| V10 | heads revisados; notas bajas de #338 y #330 | `ola0-02`, `ola0-04`; STATUS §a |
| V14 | #330 (sin revisar 4decb81..0bd6533; corrida real); #302; #304 cerrado; restauración completa | `ola0-04`, `ola0-08`; STATUS §a/§b/§c |
| V15 | #338 + TTL único; variables KMS sin documentar; KMS, Entra y Koibox | `ola0-02`, `ola0-05`; STATUS §c |
| EXTERNAL SUPPORT | #196 (y el co-autor con nombre de modelo); decks publicados; #339 fuentes; decisiones de producto | `ola0-08`; STATUS §b |
| LAUNCH & GTM | decidir el agente de lanzamiento y redes | STATUS §b |
| Speed up worker integration | #293 y la decisión frente a #302; timeout del e2e | `ola0-08`; STATUS §b |
| Railway plan upgrade | nada (ya hecho) | `docs/PLAN.md` (decisiones) |
| Sesiones archivadas (V4, V6, V7, V9, V11, V12, V13, V1·w) | ver la tabla | report de cierre §2 |

## Notas de V1 que solo vivían en la conversación
| Punto | Dónde quedó |
| --- | --- |
| Procedimiento de merge por REST (GraphQL bloqueado en la nube), `update-branch`, `ready_for_review` | `docs/specs/ola0-00-como-mergear.md`; report Anexo A |
| Preparar el entorno de una sesión en la nube (Node 24, Supabase CLI, dockerd, Chromium) y la verificación completa | report Anexo B |
| Flakes de CI (puerto 54322; cancelación por concurrencia) | `docs/STATUS.md` §e; `ola0-00` |
| Docker Hub 429 y proxy TLS en `docker build` | report §4 |
| Números de pgTAP y timestamps de migración: no repetir, siempre posteriores a main | `ola0-00`; `docs/ARCHITECTURE.md` (Convenciones) |
| La variable del worker es `INTEGRATION_INGRESS_KMS_KEY_IDS` (plural) | `docs/STATUS.md` §c; `ola0-05` paso 3 |
| Koibox: freno contado en eventos, `last_submission_result`, plazo desde `created_at`, mensaje de caducado | `docs/PLAN.md` (decisiones); `ola0-02` |
| Hook `protect-secrets.py` no protege `.seed/credentials.local.json` | `docs/STATUS.md` §e; `docs/PLAN.md` Ola 1 |
| La regla «`.claude/` no se edita aquí» choca con el kit | report §4; `ola1-01` |
| Decisiones de producto heredadas (Realtime, Fluid, mensaje del sistema, bandeja, marca, `/app-movil`, lote C, ADR 0046) | report §5 |
| Hallazgos legales de V13 (no-entrenamiento del Gateway, proveedores en EE. UU., DPIA) | report §2 (V13); STATUS §c |
| Ramas sin PR y su destino | report §2 |
| Ajuste de usuario `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` | No es del repo: el `~/.claude/settings.json` del contenedor se pierde; Diego lo pone en su máquina |

## Tareas de la lista de tareas de V1 que seguían abiertas
| Tarea | Estado real | Dónde quedó |
| --- | --- | --- |
| Conectores y preparación de staging | hecho salvo KMS, Entra, Meta | STATUS §c |
| Arreglos de la auditoría R-16..R-24 / Auth como código | en el registro (`docs/scope.yaml`) | `pnpm docs:status` |
| Recepción y Atención al cliente (B19/B20), bucle del agente | construido; verificación real pendiente | STATUS §d; PLAN M2 |
| Alinear /precios y /enterprise | #196 | `ola0-08` |
| Cola de mergeos | Ola 0 | STATUS §a |
| Auditoría final y READY | sustituida por este cierre | este archivo y el report de cierre |
