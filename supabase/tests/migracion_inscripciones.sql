-- Comprueba que la migración de la etapa 2 no perdió ni mapeó mal nada.
-- SOLO en la base desechable, después de semilla_produccion.sql y de las
-- migraciones. No escribe nada. Cada comprobación imprime "OK ..." o aborta
-- con "FALLO ...".

do $$
declare
  v       integer;
  v_doc   text;
  v_notas text;
begin
  if to_regclass('public.reservations') is not null or to_regclass('public.payment_proofs') is not null then
    raise exception 'FALLO: las tablas antiguas siguen con su nombre';
  end if;
  if to_regclass('public.taller_availability') is not null then
    raise exception 'FALLO: taller_availability sigue existiendo';
  end if;

  -- 1. Ninguna reserva perdida: mismo id y misma referencia.
  select count(*) into v
    from public._legacy_reservations r
    left join public.inscripciones i on i.id = r.id and i.referencia = r.reference
   where i.id is null;
  if v <> 0 then raise exception 'FALLO: % reservas sin inscripción', v; end if;
  raise notice 'OK reservas migradas con su id y referencia';

  -- 2. Ningún comprobante perdido: mismo id, archivo e inscripción.
  select count(*) into v
    from public._legacy_payment_proofs p
    left join public.comprobantes c
      on c.id = p.id and c.file_path = p.file_path and c.inscripcion_id = p.reservation_id
   where c.id is null;
  if v <> 0 then raise exception 'FALLO: % comprobantes sin migrar', v; end if;
  raise notice 'OK comprobantes migrados con su archivo';

  -- 3. deposit → 50, full → 100.
  if (select porcentaje from public.comprobantes where id = '20000000-0000-0000-0000-000000000001') <> 50
     or (select porcentaje from public.comprobantes where id = '20000000-0000-0000-0000-000000000003') <> 100 then
    raise exception 'FALLO: porcentaje de los comprobantes';
  end if;
  raise notice 'OK deposit = 50 y full = 100';

  -- 4. El documento que solo estaba en el comprobante pasa a la persona.
  select p.documento into v_doc
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000001';
  if v_doc is distinct from '12345678' then raise exception 'FALLO: documento recuperado = %', v_doc; end if;
  raise notice 'OK documento recuperado del comprobante';

  -- 5. Mismo documento dos veces en el mismo taller: la primera lo conserva, la
  --    segunda queda por identificar con una nota.
  select p.documento into v_doc
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000003';
  if v_doc is distinct from 'V20111222' then raise exception 'FALLO: documento normalizado = %', v_doc; end if;
  select p.documento, i.notas into v_doc, v_notas
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000004';
  if v_doc is not null or v_notas not like '%V20111222%' then
    raise exception 'FALLO: duplicado por documento (doc %, notas %)', v_doc, v_notas;
  end if;
  raise notice 'OK duplicado por documento queda por identificar';

  -- 6. confirmed → 100% fijado a mano, con la asistencia.
  if not exists (
    select 1 from public.inscripciones
     where id = '10000000-0000-0000-0000-000000000005'
       and porcentaje_pagado = 100 and porcentaje_manual and asistio
  ) then raise exception 'FALLO: la confirmada no quedó al 100%% manual'; end if;
  raise notice 'OK confirmed = 100%% manual';

  -- 7. cancelled → cancelada; pending → 0% (ningún comprobante verificado).
  if not exists (select 1 from public.inscripciones where id = '10000000-0000-0000-0000-000000000006' and cancelada)
     or exists (select 1 from public.inscripciones where id = '10000000-0000-0000-0000-000000000001' and porcentaje_pagado <> 0) then
    raise exception 'FALLO: cancelada o pendiente mal migradas';
  end if;
  raise notice 'OK cancelada y pendientes';

  -- 8. Cupos: la cancelada no ocupa.
  if (select ocupados from public.talleres_disponibilidad where slug = 'taller-2026-10') <> 7 then
    raise exception 'FALLO: ocupados';
  end if;
  raise notice 'OK disponibilidad sobre inscripciones';

  -- 9. Por identificar: Luis (2.ª), María (2.ª), la prueba y "Test".
  select count(*) into v from public.personas where documento is null;
  if v <> 4 then raise exception 'FALLO: % personas por identificar, esperaba 4', v; end if;
  raise notice 'OK personas por identificar';

  -- 10. Todas con origen migracion.
  if exists (select 1 from public.inscripciones where origen <> 'migracion') then
    raise exception 'FALLO: origen';
  end if;
  raise notice 'OK origen migracion';

  -- 11. La vista de compatibilidad sigue dando el certificado de prueba
  --     (hasta que 20261015_03 la elimina).
  if to_regclass('public.taller_certificates') is not null then
    if (select count(*) from public.taller_certificates) <> 1 then
      raise exception 'FALLO: taller_certificates';
    end if;
    raise notice 'OK vista de compatibilidad';
  else
    raise notice 'OK vista de compatibilidad ya eliminada';
  end if;
end
$$;
