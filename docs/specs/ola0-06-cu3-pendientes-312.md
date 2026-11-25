# ola0-06: CU3, «pendiente para el agente» = lo que el equipo ve en la bandeja (#312)

Phase / wave: Ola 0 · M2 (CU3)
Model: Sonnet · Effort: Medium
Can run in parallel with: preparación del resto; merge en serie (después de ola0-01, toca el mismo agente).

## Goal
Mergear #312 (V2): lo que el prompt le enseña al agente como «pendiente con el equipo» es exactamente lo que la bandeja muestra (no solicitudes ya resueltas ni caducadas; corrige el aviso de una fecha pasada visto en staging el 2026-11-13).

## Estado al cierre
- Rama `claude/m2-cu3-pendientes-vigentes`, head `eb90b79` (13-11), borrador, 2 archivos (+101/−7). V2: «limpio contra main» según `git merge-tree` del 24-11. Sin revisión de V10 registrada en esta sesión.

## Steps
1. `update-branch` (o merge de main si hay conflicto), CI verde.
2. Reviewer: revisión completa (prompt del agente = reglas de plataforma).
3. Evals afectadas con el modelo falso (`pnpm test`) y, tras el merge, la corrida real de «Evals · modelo real» desde main (≈1 €).
4. Merge según ola0-00.

## Acceptance criteria
- [ ] CI verde sobre el head; reviewer sin hallazgos bloqueantes.
- [ ] Evals con modelo real en verde tras el merge (seguridad 100 %, comportamiento ≥90 %).

## Verify commands
```
pnpm test
gh api -X POST repos/dsvmotion/moodly/actions/workflows/evals.yml/dispatches -f ref=main
```

## Revisión del agente reviewer
- Sí (prompt del agente).
