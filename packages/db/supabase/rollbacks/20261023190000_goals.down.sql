-- Vuelta atrás de 20261023190000_goals.sql: fuera los objetivos (goals) y su
-- progreso (goal_progress). Borra los objetivos de todas las organizaciones.

drop table public.goal_progress;
drop table public.goals;

drop function private.validate_goal_progress();
drop function private.validate_goal();
