-- Koibox, solo lectura (int-koibox, O-02; ADR 0034 y 0049): el worker lee la
-- clave cifrada de la integración nativa de su organización para hablar con la
-- API de Koibox. Solo privilegios de SELECT, por columna. Nada más.
--
-- 1. integration_secrets: las columnas que necesita SecretVault.open (la
--    referencia de la clave maestra, la clave de datos cifrada y el texto
--    cifrado) y las que identifican el secreto. Ni created_at ni rotated_at.
--    La política integration_secrets_worker (20261112040500) ya limita a la
--    organización fijada en la transacción. La app sigue sin leerlos ni
--    escribirlos (integration_secrets_none y sin privilegios para
--    authenticated): no cambia.
-- 2. integrations: añade secret_id a lo que lee el worker (20261112250000),
--    para encontrar el secreto de la fila.
--
-- Sin escrituras, sin funciones security definer. El secreto en claro solo
-- existe en memoria del worker al usarlo (ADR 0034).
--
-- Vuelta atrás: rollbacks/20261113100000_worker_koibox_read.down.sql.

grant select (id, organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  on public.integration_secrets to moodly_worker;
grant select (secret_id) on public.integrations to moodly_worker;
