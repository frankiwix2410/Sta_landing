-- Pruebas de la emisión automática de certificados (etapa 3). SOLO en una base
-- de prueba con todas las migraciones (scripts/probar-migraciones.sh). Se
-- deshace al final. Cada comprobación imprime "OK ..." o aborta con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, titulo_acento, estado, fecha_inicio, fecha_fin, fechas_texto,
   sede_nombre, ciudad, region, pais, cupos_total, horas, aval, firma_nombre)
values
  ('prueba-c', 'C', 'Anestesia Regional', '+ Sedación TCI', 'publicado', '2032-03-10', '2032-03-11',
   'Marzo 10 y 11, 2032', 'Clínica X', 'Maracaibo', 'Zulia', 'Venezuela', 5, 16, 'Avalado', 'Dr. Firma');

-- Talleres extra, en fechas distintas (no pueden solaparse).
insert into public.talleres
  (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
select s, upper(s), upper(s), 'publicado', d, d + 1, 'x', 'S', 'C', 'P', 5
  from (values ('prueba-c2', date '2032-04-10'), ('prueba-d', date '2032-05-10'),
               ('prueba-e', date '2032-06-10'), ('prueba-f', date '2032-07-10')) v(s, d);

do $$
declare
  v_taller uuid := (select id from public.talleres where slug = 'prueba-c');
  r        record;
  v_ins    uuid;
  v_otra   uuid;
  v_cert   public.certificados%rowtype;
  v_codigo text;
  v_t2     uuid := (select id from public.talleres where slug = 'prueba-c2');
  v_t3     uuid := (select id from public.talleres where slug = 'prueba-d');
  v_t4     uuid := (select id from public.talleres where slug = 'prueba-e');
  v_t5     uuid := (select id from public.talleres where slug = 'prueba-f');
begin
  select * into r from public.crear_inscripcion(v_taller, 'STA-CERT0001', '55.666.777', 'CI',
    'Eva Prueba', 'eva@example.com', '3005556677', 'Maracaibo', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', false);
  v_ins := r.inscripcion_id;
  perform public.ajustar_porcentaje(v_ins, 100);
  update public.inscripciones set asistio = true where id = v_ins;

  -- 1. Pagado y con asistencia, pero el taller no terminó: sin certificado.
  if exists (select 1 from public.certificados where inscripcion_id = v_ins) then
    raise exception 'FALLO 1: certificado antes de terminar el taller';
  end if;
  raise notice 'OK sin certificado antes de finalizar';

  -- 2. Al finalizar el taller se emite, con la copia de los datos.
  update public.talleres set estado = 'finalizado' where id = v_taller;
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.id is null or v_cert.revocado_en is not null then raise exception 'FALLO 2a: no se emitió'; end if;
  if v_cert.codigo !~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$' then
    raise exception 'FALLO 2b: código %', v_cert.codigo;
  end if;
  if v_cert.nombre <> 'Eva Prueba' or v_cert.documento <> '55666777' or v_cert.tipo_documento <> 'CI'
     or v_cert.curso <> 'Anestesia Regional + Sedación TCI' or v_cert.horas <> 16
     or v_cert.sede <> 'Clínica X' or v_cert.firma_nombre <> 'Dr. Firma' then
    raise exception 'FALLO 2c: copia mal hecha';
  end if;
  v_codigo := v_cert.codigo;
  raise notice 'OK emisión al finalizar';

  -- 3. Editar el taller no cambia el certificado (salvo las horas, que lo
  --    siguen); corregir el nombre de la persona sí.
  update public.talleres set sede_nombre = 'Otra sede', firma_nombre = 'Otro' where id = v_taller;
  update public.talleres set horas = 20 where id = v_taller;
  update public.personas set nombre = 'Eva María Prueba' where documento = '55666777';
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.sede <> 'Clínica X' or v_cert.firma_nombre <> 'Dr. Firma' then
    raise exception 'FALLO 3a: la copia del taller cambió: % %', v_cert.sede, v_cert.firma_nombre;
  end if;
  if v_cert.horas <> 20 or v_cert.nombre <> 'Eva María Prueba' then
    raise exception 'FALLO 3b: horas % nombre %', v_cert.horas, v_cert.nombre;
  end if;
  raise notice 'OK copia del taller fija salvo horas, y nombre al día';

  -- 4. Quitar la asistencia revoca; devolverla reactiva con el mismo código.
  update public.inscripciones set asistio = false where id = v_ins;
  if (select revocado_en from public.certificados where inscripcion_id = v_ins) is null then
    raise exception 'FALLO 4a: no se revocó';
  end if;
  update public.inscripciones set asistio = true where id = v_ins;
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.revocado_en is not null or v_cert.codigo <> v_codigo then raise exception 'FALLO 4b'; end if;
  raise notice 'OK revoca y reactiva sin cambiar el código';

  -- 5. Revocado a mano: la emisión automática no lo reactiva; el admin sí.
  select * into r from public.revocar_certificado(v_cert.id, true);
  if not r.ok or r.vigente then raise exception 'FALLO 5c: % %', r.ok, r.vigente; end if;
  update public.inscripciones set asistio = false where id = v_ins;
  update public.inscripciones set asistio = true where id = v_ins;
  if (select revocado_en from public.certificados where id = v_cert.id) is null then
    raise exception 'FALLO 5a: se reactivó solo';
  end if;
  select * into r from public.revocar_certificado(v_cert.id, false);
  if not r.ok or not r.vigente then raise exception 'FALLO 5b'; end if;
  raise notice 'OK revocación manual';

  -- 6. Archivar no revoca; volver a publicar sí; finalizar de nuevo reactiva.
  update public.talleres set estado = 'archivado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is not null then
    raise exception 'FALLO 6a: archivar revocó';
  end if;
  update public.talleres set estado = 'publicado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is null then
    raise exception 'FALLO 6b';
  end if;
  update public.talleres set estado = 'finalizado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is not null then
    raise exception 'FALLO 6c';
  end if;
  raise notice 'OK estados del taller';

  -- 7. Una inscripción con certificado no se elimina.
  select * into r from public.eliminar_inscripcion(v_ins);
  if r.reason is distinct from 'tiene_certificado' then raise exception 'FALLO 7: %', r.reason; end if;
  raise notice 'OK no se elimina una inscripción certificada';

  -- 8. Fusionar una ficha cuya inscripción certificada desaparecería: no.
  insert into public.personas (nombre) values ('Eva Duplicada') returning id into v_otra;
  insert into public.inscripciones (referencia, persona_id, taller_id, tarifa_id, tarifa_nombre)
  values ('STA-CERT0002', v_otra, v_taller, 'general', 'Cupo General');
  select * into r from public.fusionar_personas((select persona_id from public.inscripciones where id = v_ins), v_otra);
  if r.reason is distinct from 'tiene_certificado' then raise exception 'FALLO 8: %', r.reason; end if;
  raise notice 'OK fusionar respeta los certificados';

  -- 9. Búsqueda pública por documento.
  if not exists (select 1 from public.certificados_vigentes where documento = '55666777' and codigo = v_codigo) then
    raise exception 'FALLO 9';
  end if;
  raise notice 'OK certificados vigentes por documento';

  -- 10. Códigos: formato y sin repetirse en una muestra.
  if exists (
       select 1 from (select public.generar_codigo_certificado() as c from generate_series(1, 2000)) s
        where s.c !~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$')
     or (select count(distinct s.c) from (select public.generar_codigo_certificado() as c from generate_series(1, 2000)) s) <> 2000 then
    raise exception 'FALLO 10: códigos';
  end if;
  raise notice 'OK formato de los códigos';

  -- 11. Las horas también llegan a un certificado revocado, y no lo reactivan.
  select * into r from public.revocar_certificado(v_cert.id, true);
  if not r.ok or r.vigente then raise exception 'FALLO 11a: % %', r.ok, r.vigente; end if;
  update public.talleres set horas = 24 where id = v_taller;
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.horas <> 24 or v_cert.revocado_en is null then
    raise exception 'FALLO 11: horas % revocado %', v_cert.horas, v_cert.revocado_en;
  end if;
  -- Revocado a mano, la web sí puede corregir el nombre.
  select * into r from public.crear_inscripcion(v_t2, 'STA-CERT0003', '55666777', 'CI',
    'Eva Revocada', '', '', '', '', 'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok or r.reason is not null then raise exception 'FALLO 11b: % %', r.ok, r.reason; end if;
  if (select nombre from public.personas where documento = '55666777') <> 'Eva Revocada' then
    raise exception 'FALLO 11c: no se renombró con el certificado revocado';
  end if;
  select * into r from public.revocar_certificado(v_cert.id, false);
  if not r.ok or not r.vigente then raise exception 'FALLO 11d'; end if;
  update public.personas set nombre = 'Eva María Prueba' where documento = '55666777';
  raise notice 'OK horas en certificados revocados y renombrar sin certificado vigente';

  -- 12. Con certificado vigente, la reserva web no cambia nombre ni tipo de
  --     documento (sí el resto de la ficha) y avisa.
  select * into r from public.crear_inscripcion(v_t3, 'STA-CERT0004', '55666777', 'CC',
    'Alguien Más', 'nuevo@example.com', '', '', '', 'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok or r.reason is distinct from 'nombre_bloqueado' then
    raise exception 'FALLO 12a: % %', r.ok, r.reason;
  end if;
  if (select nombre from public.personas where documento = '55666777') <> 'Eva María Prueba'
     or (select tipo_documento from public.personas where documento = '55666777') <> 'CI'
     or (select email from public.personas where documento = '55666777') <> 'nuevo@example.com' then
    raise exception 'FALLO 12b: la web cambió la ficha certificada';
  end if;
  if (select nombre from public.certificados where inscripcion_id = v_ins) <> 'Eva María Prueba' then
    raise exception 'FALLO 12c: cambió el certificado';
  end if;
  raise notice 'OK la web no renombra a quien tiene certificado vigente';

  -- 13. Lo mismo al corregir el nombre con el comprobante.
  select * into r from public.registrar_comprobante(v_t3, '55666777', gen_random_uuid(), 100,
    'Otro Nombre', '', '', '', 'prueba-d/c.jpg', 'image/jpeg', 10);
  if not r.ok or r.reason is distinct from 'nombre_bloqueado' then
    raise exception 'FALLO 13a: % %', r.ok, r.reason;
  end if;
  if (select nombre from public.personas where documento = '55666777') <> 'Eva María Prueba' then
    raise exception 'FALLO 13b: el comprobante cambió el nombre';
  end if;
  if (select nombre from public.comprobantes where file_path = 'prueba-d/c.jpg') <> 'Eva María Prueba' then
    raise exception 'FALLO 13c: el comprobante guardó el nombre rechazado';
  end if;
  raise notice 'OK el comprobante web no renombra a quien tiene certificado vigente';

  -- 14. El admin sí puede, y el certificado sigue a la persona.
  select * into r from public.crear_inscripcion(v_t4, 'STA-CERT0005', '55666777', 'CI',
    'Eva M. Prueba', '', '', '', '', 'general', 'Cupo General', null, null, '', 'admin', false);
  if not r.ok or r.reason is not null then raise exception 'FALLO 14a: % %', r.ok, r.reason; end if;
  if (select nombre from public.personas where documento = '55666777') <> 'Eva M. Prueba'
     or (select nombre from public.certificados where inscripcion_id = v_ins) <> 'Eva M. Prueba' then
    raise exception 'FALLO 14b: el admin no pudo corregir el nombre';
  end if;
  raise notice 'OK el admin corrige el nombre y el certificado lo sigue';

  -- 15. Revocado solo por no cumplir (sin asistencia) sigue protegido.
  update public.inscripciones set asistio = false where id = v_ins;
  if (select revocado_en from public.certificados where inscripcion_id = v_ins) is null then
    raise exception 'FALLO 15a: no se revocó';
  end if;
  select * into r from public.crear_inscripcion(v_t5, 'STA-CERT0006', '55666777', 'CI',
    'Nombre Nuevo', '', '', '', '', 'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok or r.reason is distinct from 'nombre_bloqueado' then
    raise exception 'FALLO 15b: % %', r.ok, r.reason;
  end if;
  if (select nombre from public.personas where documento = '55666777') <> 'Eva M. Prueba' then
    raise exception 'FALLO 15c: la web renombró';
  end if;
  update public.inscripciones set asistio = true where id = v_ins;
  raise notice 'OK sigue protegido si el certificado se revocó solo por no cumplir';

  -- 16. Argumentos nulos: razón, no excepción.
  select * into r from public.revocar_certificado(null, true);
  if r.ok or r.reason is distinct from 'no_encontrado' then raise exception 'FALLO 16a: %', r.reason; end if;
  select * into r from public.revocar_certificado(v_cert.id, null);
  if r.ok or r.reason is distinct from 'estado_invalido' then raise exception 'FALLO 16b: %', r.reason; end if;
  raise notice 'OK revocar con argumentos nulos devuelve razón';

  -- 17. Permisos.
  if has_function_privilege('anon', 'public.revocar_certificado(uuid,boolean)', 'execute')
     or has_function_privilege('anon', 'public.persona_tiene_certificado_protegido(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.crear_inscripcion(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.registrar_comprobante(uuid,text,uuid,integer,text,text,text,text,text,text,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.sincronizar_certificado(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.revocar_certificado(uuid,boolean)', 'execute') then
    raise exception 'FALLO 17: permisos';
  end if;
  raise notice 'OK permisos';

  -- 18. Fecha de emisión = día siguiente al fin del taller (hora de Caracas),
  --     también tras mover la fecha de fin.
  if exists (
    select 1 from public.certificados c
      join public.inscripciones i on i.id = c.inscripcion_id
      join public.talleres t on t.id = i.taller_id
     where (c.emitido_en at time zone 'America/Caracas')::date <> t.fecha_fin + 1
  ) then
    raise exception 'FALLO 18a: fecha de emisión distinta del día siguiente al fin';
  end if;
  update public.talleres t set fecha_fin = t.fecha_fin + 1
   where t.id = (select i.taller_id from public.inscripciones i
                   join public.certificados c on c.inscripcion_id = i.id limit 1);
  if exists (
    select 1 from public.certificados c
      join public.inscripciones i on i.id = c.inscripcion_id
      join public.talleres t on t.id = i.taller_id
     where (c.emitido_en at time zone 'America/Caracas')::date <> t.fecha_fin + 1
  ) then
    raise exception 'FALLO 18b: la fecha de emisión no siguió a la nueva fecha de fin';
  end if;
  raise notice 'OK fecha de emisión = día siguiente al fin del taller';
end
$$;

rollback;
