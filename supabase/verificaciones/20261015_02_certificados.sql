-- Solo lectura. Tras 20261015_02: el certificado de prueba de taller-2026-10
-- (la reserva que estaba confirmed + attended) debe aparecer vigente.
-- Nombre y documento enmascarados: no se imprimen datos personales.
select codigo, left(nombre, 2) || '***' as nombre,
       case when documento is null then null else '****' || right(documento, 3) end as documento,
       curso, fechas_texto, emitido_en, revocado_en
  from public.certificados_detalle
 order by emitido_en;
select count(*) as vigentes from public.certificados_vigentes;
