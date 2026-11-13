-- PL-T1, paso 3c-3 (ADR 0049): moodly_worker pasa la conversación a una persona
-- al cerrar el run y guarda el resumen continuo, por SQL bajo RLS, en vez de la
-- clave secreta por PostgREST (converse.ts: finishRun; summary.ts: saveSummary).
--
-- moodly_worker no es «la plataforma» (V1, 2026-11-12): privilegios mínimos y
-- las guardas también para él.
-- - conversations.mode: el privilegio y su guarda (guard_worker_conversation,
--   solo de agent a human) llegaron en 20261112140000 (3c-2), porque escribir un
--   mensaje del agente ya lo necesitaba para el bloqueo FOR SHARE. Aquí no
--   cambia nada de eso: solo el código que hace el paso.
-- - conversation_summaries: INSERT de la fila (conversación, organización,
--   texto, hasta dónde cubre y modelo) y UPDATE solo del texto, de hasta dónde
--   cubre y del modelo. Nunca cambia la conversación ni la organización de un
--   resumen, ni lo borra (sin DELETE ni TRUNCATE). La política
--   conversation_summaries_worker (20261112050000) ya era FOR ALL por la
--   organización de la transacción; hasta ahora solo tenía SELECT
--   (20261112110000).
-- - Guardas que solo actúan para authenticated en conversation_summaries:
--   ninguna (la app solo lee). La clave ajena compuesta a conversations (id,
--   organization_id) actúa para todos: un resumen nunca cuelga de una
--   conversación de otra organización. service_role queda igual.
--
-- Tests en 49_worker_handoff_summary.
-- Vuelta atrás: rollbacks/20261112150000_worker_handoff_summary.down.sql.

grant insert (conversation_id, organization_id, summary, covered_until, model)
  on public.conversation_summaries to moodly_worker;
grant update (summary, covered_until, model) on public.conversation_summaries to moodly_worker;
