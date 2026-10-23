# *Spike* del ADR 0027 (DBOS Transact)

Script con el que se comprobaron los criterios de «Verificación» del ADR 0027 (resultados en el propio ADR). No forma parte de ningún workspace ni de `pnpm check`. El ADR está aceptado (2026-10-23); la dependencia entra en el repo con el worker, no con este script.

Para repetirlo, con Supabase local levantado (`pnpm db:start`):

```bash
# En un directorio fuera del repo
npm init -y && npm pkg set type=module
npm install --save-exact --ignore-scripts @dbos-inc/dbos-sdk@5.2.11
cp <repo>/docs/adr/0027-spike/spike.mjs .

# Una base de datos de usar y tirar en el Postgres local (puerto 54322)
docker exec supabase_db_moodly psql -U postgres -c "create database dbos_spike"
export SPIKE_DATABASE_URL=postgresql://postgres:<contraseña local>@127.0.0.1:54322/dbos_spike
```

Cada efecto queda en la tabla `effects` (`run`, `step`, `pid`, `extra`, `at`); las consultas del ADR cuentan sobre ella.

| Criterio | Comandos |
|---|---|
| 1. Caída tras el paso 2 | `CRASH=1 node spike.mjs crash run-1` y después `SECONDS=3 node spike.mjs worker` |
| 2. Webhook duplicado | `node spike.mjs dup evt-1` dos veces, y dos a la vez en paralelo |
| 3. Orden por conversación | dos o tres `EXECUTOR=wN SECONDS=10 node spike.mjs worker` en paralelo y `node spike.mjs enqueue A:1,B:1,A:2,...` |
| 4. Aprobación tras reiniciar | `CRASH=1 node spike.mjs approval apr-1`, `node spike.mjs approve apr-1` y `SECONDS=3 node spike.mjs worker` |
| Mismo `executorID` solapado | `EXECUTOR=same node spike.mjs long ov-1` y, 1,5 s después, `EXECUTOR=same SECONDS=7 node spike.mjs worker` |
| Worker muerto a mitad de un mensaje | `EXECUTOR=w1 KILL_ON=S:2 node spike.mjs worker` con `enqueue S:1,S:2,S:3`; después `EXECUTOR=w2 node spike.mjs adopt w1` |
| Rol sin DDL | `npx dbos schema <url> -s dbos_ro -r <rol>` con un rol con privilegios; después el worker con `SYS_URL=<url del rol>`, `SYS_SCHEMA=dbos_ro` y `RUN_MIGRATIONS=0` |
