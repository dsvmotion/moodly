-- Paso 4f-3: aceptar la oferta de la lista de espera contestando SÍ (MANUAL
-- §5.1, decidido por producto el 2026-11-08: si acepta, la reserva va a la
-- bandeja de aprobaciones como cualquier otra).
--
-- waitlist_entries.offer_ref: el workflow de DBOS que hizo la oferta en curso
-- (waitlist:<cita cancelada>). Mientras la reserva espera a una persona, la
-- oferta se alarga y ese workflow duerme hasta el nuevo plazo; cuando se
-- reserva el hueco o se rechaza la reserva, el worker lo despierta por esta
-- referencia en vez de esperar al final del plazo. La pone y la quita solo el
-- worker (service_role): la app no tiene permiso de escritura en la tabla.
--
-- Funciones security definer: ninguna nueva ni cambiada.
--
-- Vuelta atrás:
--   alter table public.waitlist_entries drop column offer_ref;

alter table public.waitlist_entries
  add column offer_ref text check (offer_ref is null or length(offer_ref) between 1 and 200);
