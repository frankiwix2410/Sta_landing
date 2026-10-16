-- Pruebas de personas, inscripciones y comprobantes (etapa 2). SOLO en una
-- base de prueba con schema.sql y las migraciones aplicadas
-- (scripts/probar-migraciones.sh). Todo corre dentro de una transacción que se
-- deshace al final: no deja datos. Cada comprobación imprime "OK ..." o aborta
-- con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais,
   cupos_total, porcentajes_pago)
values
  ('prueba-i', 'I', 'I', 'publicado', '2031-05-10', '2031-05-11', 'x', 'S', 'C', 'P', 2, '{50,100}');

do $$
declare
  v_taller uuid := (select id from public.talleres where slug = 'prueba-i');
  r        record;
  v_ana    uuid;
  v_beto   uuid;
  v_c1     uuid := gen_random_uuid();
  v_c2     uuid := gen_random_uuid();
  v_dup_p  uuid;
  v_dup_i  uuid;
  v_notas  text;
  v_tl     uuid;
  v_pl     uuid;
  v_il     uuid;
  v_cl     uuid := gen_random_uuid();
begin
  -- 1. Reserva web: el documento se normaliza y se crea la persona.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA01', ' 1.136-882 468 ', 'CC',
    'Ana Prueba', 'ana@example.com', '3001112233', 'Maracaibo', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok then raise exception 'FALLO 1: %', r.reason; end if;
  if not exists (select 1 from public.personas where documento = '1136882468') then
    raise exception 'FALLO 1: documento no normalizado';
  end if;
  v_ana := r.inscripcion_id;
  raise notice 'OK reserva con documento normalizado';

  -- 2. Mismo documento en el mismo taller: ya_inscrito, sin tocar la ficha.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA02', '1136882468', 'CC',
    'Otro Nombre', 'otro@example.com', '3009999999', 'X', 'X',
    'general', 'Cupo General', null, null, '', 'web', false);
  if r.ok or r.reason is distinct from 'ya_inscrito' then raise exception 'FALLO 2: %', r.reason; end if;
  if (select nombre from public.personas where documento = '1136882468') <> 'Ana Prueba' then
    raise exception 'FALLO 2: ya_inscrito cambió la ficha';
  end if;
  raise notice 'OK inscripción duplicada rechazada';

  -- 3. Documento demasiado corto.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA03', '12', 'CC',
    'Xavi Yuste', 'x@example.com', '3000000000', 'X', 'X',
    'general', 'Cupo General', null, null, '', 'web', false);
  if r.ok or r.reason is distinct from 'documento_invalido' then raise exception 'FALLO 3: %', r.reason; end if;
  raise notice 'OK documento inválido';

  -- 4. Cupo (2): la segunda entra; la tercera no por la web, aunque pida
  --    forzar; el admin sí puede forzar.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA04', '2000001', 'CE',
    'Beto Prueba', 'beto@example.com', '3002223344', 'Bogotá', 'Residente',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok then raise exception 'FALLO 4a: %', r.reason; end if;
  v_beto := r.inscripcion_id;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA05', '3000001', 'CC',
    'Caro Prueba', 'caro@example.com', '3003334455', 'Cali', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', true);
  if r.ok or r.reason is distinct from 'sin_cupos' then raise exception 'FALLO 4b: la web forzó el cupo (%)', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA05', '3000001', 'CC',
    'Caro Prueba', '', '', '', '', 'general', 'Cupo General', null, null, 'Por WhatsApp', 'admin', true);
  if not r.ok then raise exception 'FALLO 4c: %', r.reason; end if;
  if (select email from public.personas where documento = '3000001') is not null then
    raise exception 'FALLO 4c: un email vacío debe quedar nulo';
  end if;
  if (select ocupados from public.talleres_disponibilidad where id = v_taller) <> 3 then
    raise exception 'FALLO 4d: ocupados';
  end if;
  raise notice 'OK cupo respetado y forzable solo por el admin';

  -- 5. Consulta por documento con otro formato.
  select * into r from public.consultar_inscripcion(v_taller, '1.136.882.468');
  if r.inscripcion_id is distinct from v_ana or r.porcentaje_pagado <> 0 or r.porcentaje_en_revision <> 0 then
    raise exception 'FALLO 5a';
  end if;
  if exists (select 1 from public.consultar_inscripcion(v_taller, '99999999')) then
    raise exception 'FALLO 5b: devolvió algo para un documento desconocido';
  end if;
  raise notice 'OK consulta por documento';

  -- 6. 75 no está entre {50,100}; 50 sí, con corrección del nombre.
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 75,
    null, null, null, '', 'prueba-i/x75.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'porcentaje_no_permitido' then raise exception 'FALLO 6a: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', v_c1, 50,
    'Ana María Prueba', '', null, '', 'prueba-i/c1.jpg', 'image/jpeg', 10);
  if not r.ok or r.nuevo_en_revision <> 50 then raise exception 'FALLO 6b: %', r.reason; end if;
  if (select nombre from public.personas where documento = '1136882468') <> 'Ana María Prueba'
     or (select email from public.personas where documento = '1136882468') <> 'ana@example.com' then
    raise exception 'FALLO 6c: corrección mal aplicada';
  end if;
  raise notice 'OK porcentaje permitido y corrección de datos';

  -- 7. Con 50% en revisión el saldo es 50: 100 no; 50 (el saldo) sí; luego nada.
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 100,
    null, null, null, '', 'prueba-i/x100.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'porcentaje_no_permitido' then raise exception 'FALLO 7a: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', v_c2, 50,
    null, null, null, '', 'prueba-i/c2.jpg', 'image/jpeg', 10);
  if not r.ok then raise exception 'FALLO 7b: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x3.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'sin_saldo' then raise exception 'FALLO 7c: %', r.reason; end if;
  raise notice 'OK nunca más del 100%%';

  -- 8. Verificar suma, rechazar resta, y queda la nota.
  select * into r from public.revisar_comprobante(v_c1, 'verified', 'Banco X');
  if not r.ok or r.nuevo_porcentaje <> 50 then raise exception 'FALLO 8a: %', r.nuevo_porcentaje; end if;
  select * into r from public.revisar_comprobante(v_c2, 'verified', null);
  if not r.ok or r.nuevo_porcentaje <> 100 then raise exception 'FALLO 8b: %', r.nuevo_porcentaje; end if;
  select * into r from public.revisar_comprobante(v_c2, 'rejected', 'Ilegible');
  if not r.ok or r.nuevo_porcentaje <> 50 then raise exception 'FALLO 8c: %', r.nuevo_porcentaje; end if;
  if (select nota_admin from public.comprobantes where id = v_c2) <> 'Ilegible'
     or (select revisado_en from public.comprobantes where id = v_c2) is null then
    raise exception 'FALLO 8d: nota o fecha de revisión';
  end if;
  raise notice 'OK verificar y rechazar recalculan';

  -- 9. El ajuste manual manda hasta volver a automático.
  select * into r from public.ajustar_porcentaje(v_ana, 100);
  if not r.ok or r.nuevo_porcentaje <> 100 then raise exception 'FALLO 9a'; end if;
  select * into r from public.revisar_comprobante(v_c1, 'rejected', null);
  if not r.ok then raise exception 'FALLO 9b: revisar_comprobante: %', r.reason; end if;
  if (select porcentaje_pagado from public.inscripciones where id = v_ana) <> 100 then
    raise exception 'FALLO 9b: el ajuste manual se perdió';
  end if;
  select * into r from public.ajustar_porcentaje(v_ana, null);
  if not r.ok or r.nuevo_porcentaje <> 0 then raise exception 'FALLO 9c: %', r.nuevo_porcentaje; end if;
  raise notice 'OK ajuste manual';

  -- 10. Taller cerrado: ni pagos ni reservas web; el admin sí inscribe.
  update public.talleres set estado = 'cerrado' where id = v_taller;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x4.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'cerrado' then raise exception 'FALLO 10a: %', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA06', '4000001', 'CC',
    'Dani Prueba', 'd@example.com', '3004445566', 'X', 'X', 'general', 'Cupo General', null, null, '', 'web', false);
  if r.ok or r.reason is distinct from 'cerrado' then raise exception 'FALLO 10b: %', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA06', '4000001', 'CC',
    'Dani Prueba', '', '', '', '', 'general', 'Cupo General', null, null, '', 'admin', true);
  if not r.ok then raise exception 'FALLO 10c: %', r.reason; end if;
  update public.talleres set estado = 'publicado' where id = v_taller;
  raise notice 'OK taller cerrado';

  -- 11. Sin reserva activa.
  select * into r from public.registrar_comprobante(v_taller, '99999999', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x5.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'sin_inscripcion' then raise exception 'FALLO 11: %', r.reason; end if;
  raise notice 'OK pago sin reserva rechazado';

  -- 12. Cancelada: no admite pagos; al reservar de nuevo se reactiva la misma.
  update public.inscripciones set cancelada = true where id = v_beto;
  select * into r from public.registrar_comprobante(v_taller, '2000001', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x6.jpg', 'image/jpeg', 10);
  if r.ok or r.reason is distinct from 'sin_inscripcion' then raise exception 'FALLO 12a: %', r.reason; end if;
  update public.talleres set cupos_total = 10 where id = v_taller;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA07', '2000001', 'CE',
    'Beto Prueba', 'beto@example.com', '3002223344', 'Bogotá', 'Residente',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok or not r.reactivada or r.inscripcion_referencia <> 'STA-PRUEBA04' then
    raise exception 'FALLO 12b: % %', r.reason, r.inscripcion_referencia;
  end if;
  raise notice 'OK cancelar y reactivar';

  -- 13. Eliminar: con pago verificado no; sin él sí, con sus archivos y la
  --     persona que se queda sola.
  select * into r from public.revisar_comprobante(v_c1, 'verified', null);
  if not r.ok then raise exception 'FALLO 13: revisar_comprobante: %', r.reason; end if;
  select * into r from public.eliminar_inscripcion(v_ana);
  if r.ok or r.reason is distinct from 'tiene_pagos_verificados' then raise exception 'FALLO 13a: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '2000001', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/beto.jpg', 'image/jpeg', 10);
  if not r.ok then raise exception 'FALLO 13: registrar_comprobante: %', r.reason; end if;
  select * into r from public.eliminar_inscripcion(v_beto);
  if not r.ok or r.archivos <> array['prueba-i/beto.jpg'] then
    raise exception 'FALLO 13b: % %', r.reason, r.archivos;
  end if;
  if exists (select 1 from public.personas where documento = '2000001') then
    raise exception 'FALLO 13c: persona huérfana';
  end if;
  raise notice 'OK eliminar inscripción';

  -- 14. Duplicado en el mismo taller (el caso real de producción): se une en
  --     la inscripción del destino con su comprobante y su asistencia.
  insert into public.personas (documento, nombre, email, telefono)
  values (null, 'Ana Prueba', 'ana.vieja@example.com', '3001112233')
  returning id into v_dup_p;
  insert into public.inscripciones (referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, asistio, origen, notas)
  values ('STA-PRUEBA08', v_dup_p, v_taller, 'general', 'Cupo General', true, 'migracion', 'Reservó dos veces')
  returning id into v_dup_i;
  insert into public.comprobantes (inscripcion_id, porcentaje, estado, file_path, file_type, file_size)
  values (v_dup_i, 50, 'verified', 'prueba-i/dup.jpg', 'image/jpeg', 10);

  select * into r from public.fusionar_personas(v_dup_p, (select persona_id from public.inscripciones where id = v_ana));
  if not r.ok then raise exception 'FALLO 14a: %', r.reason; end if;
  if exists (select 1 from public.personas where id = v_dup_p)
     or exists (select 1 from public.inscripciones where id = v_dup_i) then
    raise exception 'FALLO 14b: el duplicado sigue ahí';
  end if;
  select notas into v_notas from public.inscripciones where id = v_ana;
  if not (select asistio from public.inscripciones where id = v_ana) or v_notas not like '%STA-PRUEBA08%' then
    raise exception 'FALLO 14c: asistencia o nota';
  end if;
  if (select porcentaje_pagado from public.inscripciones where id = v_ana) <> 100 then
    raise exception 'FALLO 14d: el comprobante del duplicado no sumó';
  end if;
  raise notice 'OK fusionar duplicados del mismo taller';

  -- 15. El destino sin documento hereda el del origen; misma persona: no.
  insert into public.personas (documento, nombre) values (null, 'Sin Doc') returning id into v_dup_p;
  select * into r from public.fusionar_personas((select id from public.personas where documento = '3000001'), v_dup_p);
  if not r.ok or (select documento from public.personas where id = v_dup_p) is distinct from '3000001' then
    raise exception 'FALLO 15a: %', r.reason;
  end if;
  select * into r from public.fusionar_personas(v_dup_p, v_dup_p);
  if r.ok or r.reason is distinct from 'misma_persona' then raise exception 'FALLO 15b'; end if;
  raise notice 'OK fusionar hereda el documento';

  -- 16. Solo service_role ejecuta las funciones.
  if has_function_privilege('anon', 'public.crear_inscripcion(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_comprobante(uuid,text,uuid,integer,text,text,text,text,text,text,integer)', 'execute')
     or has_function_privilege('anon', 'public.consultar_inscripcion(uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.fusionar_personas(uuid,uuid)', 'execute') then
    raise exception 'FALLO 16: permisos de las funciones';
  end if;
  raise notice 'OK permisos';

  -- 17. Paridad con `normalizarDocumento` (src/lib/inscripciones/documento.ts):
  --     los mismos casos de su prueba y otros con tildes.
  if public.normalizar_documento(' 1.136.882.468 ') is distinct from '1136882468'
     or public.normalizar_documento('1.136.882.468') is distinct from '1136882468'
     or public.normalizar_documento('v-20.111.222') is distinct from 'V20111222'
     or public.normalizar_documento('V-20.111.222') is distinct from 'V20111222'
     or public.normalizar_documento(' cc 12 34 ') is distinct from 'CC1234'
     or public.normalizar_documento('AB 12-34') is distinct from 'AB1234'
     or public.normalizar_documento('ñá-123') is distinct from 'NA123'
     or public.normalizar_documento('Ünïcödé Çé-9') is distinct from 'UNICODECE9'
     or public.normalizar_documento('  ..  ') is not null
     or public.normalizar_documento('') is not null
     or public.normalizar_documento(null) is not null then
    raise exception 'FALLO 17: normalizar_documento no coincide con normalizarDocumento';
  end if;
  raise notice 'OK normalizar_documento coincide con la versión de TypeScript';

  -- 18. Origen nulo o desconocido: razón de error, no excepción; estado nulo igual.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA09', '5000001', 'CC',
    'Eli Prueba', 'e@example.com', '3005556677', 'X', 'X', 'general', 'Cupo General', null, null, '', null, false);
  if r.ok or r.reason is distinct from 'origen_invalido' then
    raise exception 'FALLO 18a: origen nulo (ok %, reason %)', r.ok, r.reason;
  end if;
  select * into r from public.revisar_comprobante(gen_random_uuid(), null, null);
  if r.ok or r.reason is distinct from 'estado_invalido' then
    raise exception 'FALLO 18b: estado nulo (ok %, reason %)', r.ok, r.reason;
  end if;
  raise notice 'OK origen y estado nulos devuelven razón';

  -- 19. revisar / ajustar / eliminar toman el bloqueo por taller. Taller nuevo
  --     para que ningún paso anterior haya dejado ya el bloqueo en esta transacción.
  insert into public.talleres
    (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
  values ('prueba-l', 'L', 'L', 'borrador', '2032-05-10', '2032-05-11', 'x', 'S', 'C', 'P', 5);
  v_tl := (select id from public.talleres where slug = 'prueba-l');
  insert into public.personas (documento, nombre) values ('LOCK0001', 'Lock Uno') returning id into v_pl;
  insert into public.inscripciones (referencia, persona_id, taller_id, tarifa_id, tarifa_nombre)
  values ('STA-LOCK01', v_pl, v_tl, 'general', 'Cupo General') returning id into v_il;
  insert into public.comprobantes (id, inscripcion_id, porcentaje, file_path, file_type, file_size)
  values (v_cl, v_il, 50, 'prueba-l/c.jpg', 'image/jpeg', 10);

  select * into r from public.revisar_comprobante(v_cl, 'verified', null);
  if not r.ok or r.nuevo_porcentaje <> 50 then raise exception 'FALLO 19a: %', r.reason; end if;
  if not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()
                  and objid = (hashtext('taller:' || v_tl::text)::bigint & 4294967295)::oid) then
    raise exception 'FALLO 19a: revisar_comprobante no tomó el bloqueo del taller';
  end if;
  select * into r from public.ajustar_porcentaje(v_il, 80);
  if not r.ok or r.nuevo_porcentaje <> 80 then raise exception 'FALLO 19b: %', r.reason; end if;
  select * into r from public.ajustar_porcentaje(v_il, null);
  if not r.ok or r.nuevo_porcentaje <> 50 then raise exception 'FALLO 19b2: %', r.reason; end if;
  select * into r from public.revisar_comprobante(v_cl, 'pending', null);
  if not r.ok then raise exception 'FALLO 19c: %', r.reason; end if;
  select * into r from public.eliminar_inscripcion(v_il);
  if not r.ok or r.archivos <> array['prueba-l/c.jpg'] then raise exception 'FALLO 19d: % %', r.reason, r.archivos; end if;
  raise notice 'OK revisar, ajustar y eliminar con bloqueo por taller';
end
$$;

rollback;
