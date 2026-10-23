-- Vuelta atrás de 20261023170000_agent_config.sql: fuera la configuración con
-- herencia (config_overrides), los snapshots y sus funciones. Se pierden los
-- overrides y los snapshots de todas las organizaciones.

drop table public.config_snapshots;
drop table public.config_overrides;

drop function private.snapshot_agent_config(uuid, uuid);
drop function private.resolve_agent_config(uuid, uuid);
drop function private.guard_config_snapshot_immutable();
drop function private.validate_config_override();
drop function private.config_locks_above(uuid, text, uuid);
drop function private.config_paths_valid(text[]);
drop function private.jsonb_strip_paths(jsonb, text[]);
drop function private.config_path_conflicts(text, text);
drop function private.jsonb_leaf_paths(jsonb, text);
drop function private.jsonb_deep_merge(jsonb, jsonb);
