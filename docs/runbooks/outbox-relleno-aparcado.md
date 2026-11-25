# Runbook: un relleno del outbox aparcado (W3)

**Para quién:** quien atiende la alerta «staging caído» (`alerta-staging`) o ve el `/health` del worker en `degraded`.
**Por qué:** un consumidor con relleno (hoy `agent.approval`, tipo `approval.decided`) recibe al llegar los eventos que se publicaron antes que él (`apps/worker/src/events/outbox.ts`, ADR 0009). Si su workflow `backfill:<consumidor>:<tipo>[:intento-N]` termina en `MAX_RECOVERY_ATTEMPTS_EXCEEDED` (el proceso cayó con él demasiadas veces), el worker no lo vuelve a lanzar solo: los eventos de su ventana no le llegan hasta que una persona lo reanude. Mientras tanto `/health` responde 503 `degraded`.

## 1. Confirmar que es esto

En los logs del servicio `worker` de Railway:

- `salud del worker degradada` con `checks.backfill: "fail"` y `parkedBackfills` mayor que 0.
- En el último arranque, `backfill: aparcado, no se reintenta`, con `handler`, `type`, `status` y `attempt`. El ID del workflow es `backfill:<handler>:<type>` si `attempt` es 1 y `backfill:<handler>:<type>:intento-<attempt>` si no.

Si `checks.backfill` es `fail` sin `parkedBackfills`, lo que falla es la lectura del estado en la base de datos de sistema: es el mismo caso que `checks.database: "fail"`.

## 2. Reanudarlo

Con la URL de la base de datos de sistema (`WORKER_SYSTEM_DATABASE_URL` del servicio `worker`; no la pegues en el chat ni en GitHub), desde `apps/worker`:

```
npx dbos workflow resume '<ID del workflow>' -s "$WORKER_SYSTEM_DATABASE_URL"
```

Sigue desde el último paso que hizo y con la misma ventana. Lo que ya se había entregado no se entrega dos veces (cada entrega tiene un ID fijo, `event:<evento>:<consumidor>`). En unos segundos `/health` vuelve a `ok` sin reiniciar el worker.

Si después de reanudarlo el worker vuelve a caer con él, es que lo tira el propio relleno: no lo reanudes en bucle y avisa a producto.

## Lo que esto no cubre

Un relleno `CANCELLED` (lo paró una persona) tampoco se reintenta, pero no pone `/health` en `degraded`: ya es una decisión de alguien, y si contara la alerta no se cerraría sin rellenar lo que no se quiso. Queda en el log de cada arranque (`backfill: aparcado, no se reintenta`, `status: CANCELLED`); si se quiere rellenar, se reanuda igual que arriba.

Un relleno que terminó en `ERROR` tres veces (`backfill: agotó sus intentos` en el log) no pone `/health` en `degraded`: DBOS no reanuda un `ERROR`. Queda solo en el log de cada arranque.
