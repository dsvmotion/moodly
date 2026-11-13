-- Vuelta atrás de 20261113100000: el worker deja de leer los secretos y el
-- secret_id de integrations. Antes, desplegar un worker sin la lectura de Koibox.
revoke select (id, organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  on public.integration_secrets from moodly_worker;
revoke select (secret_id) on public.integrations from moodly_worker;
