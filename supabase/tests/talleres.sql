-- Pruebas de las reglas de `talleres`. Ejecutar SOLO en un proyecto de prueba
-- que ya tenga `schema.sql` y la migración 20261013_01 aplicados. Todo corre
-- dentro de una transacción que se deshace al final: no deja datos.
-- Cada comprobación imprime "OK ..." o aborta con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
values
  ('prueba-a', 'A', 'A', 'publicado', '2030-01-10', '2030-01-12', 'x', 'S', 'C', 'P', 1);

do $$
declare
  v_reason text;
begin
  -- 1. Dos activos solapados: rechazado.
  begin
    insert into public.talleres
      (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
    values ('prueba-b', 'B', 'B', 'cerrado', '2030-01-12', '2030-01-13', 'x', 'S', 'C', 'P', 10);
    raise exception 'FALLO: se permitió solapar dos talleres activos';
  exception when exclusion_violation then
    raise notice 'OK solapamiento rechazado';
  end;

  -- 2. Un borrador sí puede solapar.
  insert into public.talleres
    (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
  values ('prueba-c', 'C', 'C', 'borrador', '2030-01-11', '2030-01-11', 'x', 'S', 'C', 'P', 10);
  raise notice 'OK borrador puede solapar';

  -- 3. Publicar ese borrador sí choca.
  begin
    update public.talleres set estado = 'publicado' where slug = 'prueba-c';
    raise exception 'FALLO: se permitió publicar un taller solapado';
  exception when exclusion_violation then
    raise notice 'OK publicar solapado rechazado';
  end;

  -- 4. Porcentajes sin 100: rechazado.
  begin
    update public.talleres set porcentajes_pago = '{50}' where slug = 'prueba-a';
    raise exception 'FALLO: porcentajes sin 100 aceptados';
  exception when check_violation then
    raise notice 'OK porcentajes sin 100 rechazados';
  end;

  -- 5. Fin antes que inicio: rechazado.
  begin
    update public.talleres set fecha_fin = '2030-01-01' where slug = 'prueba-a';
    raise exception 'FALLO: fecha_fin anterior aceptada';
  exception when check_violation then
    raise notice 'OK orden de fechas';
  end;

  -- 6. Reserva en publicado con cupo: ok; la segunda: sold_out.
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0001', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is not null then raise exception 'FALLO: reserva rechazada (%)', v_reason; end if;

  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0002', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'sold_out' then raise exception 'FALLO: esperaba sold_out, llegó %', v_reason; end if;
  raise notice 'OK cupo respetado';

  -- 7. Taller cerrado: closed.
  update public.talleres set estado = 'cerrado', cupos_total = 10 where slug = 'prueba-a';
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0003', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'closed' then raise exception 'FALLO: esperaba closed, llegó %', v_reason; end if;
  raise notice 'OK cerrado no acepta reservas';

  -- 8. Publicado pero con fecha pasada: closed.
  update public.talleres
     set estado = 'publicado', fecha_inicio = '2020-01-01', fecha_fin = '2020-01-02'
   where slug = 'prueba-a';
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0004', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'closed' then raise exception 'FALLO: esperaba closed por fecha, llegó %', v_reason; end if;
  raise notice 'OK publicado vencido no acepta reservas';

  -- 9. Disponibilidad nunca negativa con cupos por debajo de lo ocupado.
  update public.talleres set cupos_total = 0 where slug = 'prueba-a';
  if (select libres from public.talleres_disponibilidad where slug = 'prueba-a') <> 0 then
    raise exception 'FALLO: libres negativo';
  end if;
  raise notice 'OK libres no baja de 0';
end
$$;

rollback;
