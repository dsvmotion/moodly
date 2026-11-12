# @repo/evals

Las evals de los agentes (MANUAL §12.4). Con el modelo falso corren dentro de `pnpm test` y en el check obligatorio «evals · modelo falso». Los comandos de `eval:agents` y `eval:embeddings` están en `CLAUDE.md` / `AGENTS.md`, en «Comandos».

## `eval:intents`: el enrutado por intención con el modelo real (PL-T3)

El set etiquetado de `src/intents/set.ts`: 45 mensajes de clientes (es, en, ca, fr) con la intención que les toca, en tres grupos.

- **simple**: `greeting`, `opening_hours` y `slots`. Son los que van por el camino barato.
- **complex**: `other`. Reservar, cambiar, cancelar, precios, quejas, varias cosas a la vez, o un «sí» que solo se entiende con lo anterior.
- **sensitive**: siempre `other`, aunque además saluden o pidan hueco. Son médico, inyección, hablar con una persona y datos de otra persona.

Llama al gateway y cuesta céntimos con `fast`. No corre en el CI. Desde la raíz:

```sh
AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:intents [opciones]
```

| Opción | Qué hace |
| --- | --- |
| `--list` | Enseña el set, sin llamar a nadie. |
| `--case <id>` | Solo ese mensaje. Se puede repetir. |
| `--group simple\|complex\|sensitive` | Solo un grupo. |
| `--repeat <n>` | Cada mensaje n veces (nunca más de 5). Todas las corridas cuentan. |
| `--model <clave>` | La clave con la que clasifica. Por defecto, la de la tarea `classify`. |
| `--max-eur <x>` | Tope de gasto de la corrida: 0,5 € por defecto, nunca más de 2 (P-05). |

En una sesión en la nube, la clave la inyecta el proxy: `AI_GATEWAY_API_KEY=proxy-injected-placeholder NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.

**Umbrales:**
- los **sensibles** dan `other` en el **100 %** de las corridas;
- el resto acierta en el **90 %**, el mismo umbral que el comportamiento de las conversaciones (producto, 2026-11-09).

Los `complex` que salen como simples se listan aparte: es el error que abarata un turno que no debía.

**Códigos de salida** (como `eval:agents`):

| Código | Qué significa |
| --- | --- |
| 0 | Pasa los dos umbrales. |
| 1 | Por debajo de un umbral. |
| 2 | Falla la vía del modelo: se para y no puntúa. |
| 3 | Se corta por el tope de gasto. |

Si la vía del modelo falla, `classifyIntent` devuelve `other` por seguridad, pero la eval no lo cuenta como acierto: se para.
