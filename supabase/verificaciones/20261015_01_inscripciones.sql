-- Solo lectura. scripts/migrar.sh lo ejecuta después de aplicar la migración.
-- inscripciones = _legacy_reservations y comprobantes = _legacy_payment_proofs.
select 'inscripciones' as tabla, count(*) as filas from public.inscripciones
union all select '_legacy_reservations', count(*) from public._legacy_reservations
union all select 'comprobantes', count(*) from public.comprobantes
union all select '_legacy_payment_proofs', count(*) from public._legacy_payment_proofs
union all select 'personas', count(*) from public.personas
union all select 'personas por identificar', count(*) from public.personas where documento is null;
select referencia, left(nombre, 2) || '***' as nombre,
       case when documento is null then null else '****' || right(documento, 3) end as documento,
       porcentaje_pagado, porcentaje_manual, porcentaje_en_revision,
       cancelada, asistio
  from public.inscritos_admin
 order by creado_en;
select * from public.talleres_disponibilidad;
