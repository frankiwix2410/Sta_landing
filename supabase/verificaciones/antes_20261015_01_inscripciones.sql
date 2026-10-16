-- Solo lectura. scripts/migrar.sh lo muestra ANTES de pedir confirmación.
-- Ningún taller debe estar 'publicado' (ver «Orden de despliegue» del plan) y
-- no debe haber comprobantes sin reserva (la migración abortaría).
select slug, estado, fecha_inicio, fecha_fin from public.talleres order by fecha_inicio;
select count(*) as reservas,
       count(*) filter (where status = 'confirmed') as confirmadas,
       count(*) filter (where status = 'cancelled') as canceladas,
       count(*) filter (where document is not null) as con_documento
  from public.reservations;
select count(*) as comprobantes,
       count(*) filter (where reservation_id is null) as sin_reserva
  from public.payment_proofs;
