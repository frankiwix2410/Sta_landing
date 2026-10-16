-- ---------------------------------------------------------------------------
-- Etapa 3 · Certificados
--
-- Un certificado por inscripción, con código propio para verificarlo. Se
-- emite solo (triggers) cuando la inscripción tiene el 100% pagado, la
-- asistencia marcada, no está cancelada y el taller terminó (finalizado o
-- archivado). Si deja de cumplirse se revoca; nunca se borra. Lleva copia de
-- la persona (se actualiza si corrige nombre o documento) y del taller al
-- emitirse: esa copia no cambia aunque se edite el taller, con una excepción,
-- las horas (si el admin carga o corrige `talleres.horas`, los certificados de
-- ese taller, vigentes o revocados, las reflejan).
--
-- También endurece dos funciones de la etapa 2 (create or replace, misma firma):
-- los flujos PÚBLICOS no pueden cambiar nombre ni tipo de documento de una
-- persona con un certificado no revocado a mano (quien conozca un documento ajeno no debe
-- poder alterar un certificado). Responden ok = true con reason =
-- 'nombre_bloqueado' para que la interfaz lo avise. El admin sí puede.
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261015_02_certificados.sql
-- Va después de 20261015_01. Es aditiva: el código de la etapa 2 sigue
-- funcionando igual (ignora el reason de un ok = true). Idempotente. No vuelvas
-- a ejecutar 20261015_01 después de esta: restauraría las dos funciones.
-- ---------------------------------------------------------------------------

begin;

-- Si otra sesión retiene un bloqueo, falla en vez de quedarse esperando.
set local lock_timeout = '10s';

create table if not exists public.certificados (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique
                  check (codigo ~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  inscripcion_id  uuid not null unique references public.inscripciones (id),
  -- De la persona.
  nombre          text not null,
  tipo_documento  text not null,
  documento       text,
  -- Del taller, al emitirse.
  curso           text not null,
  fechas_texto    text not null,
  sede            text not null,
  ciudad          text not null,
  region          text,
  horas           integer,
  aval            text,
  firma_nombre    text,
  firma_cargo     text,
  firma_documento text,
  emitido_en      timestamptz not null default now(),
  -- Nulo = vigente.
  revocado_en     timestamptz,
  -- Revocado por el admin: la emisión automática no lo reactiva.
  revocado_manual boolean not null default false
);

alter table public.certificados enable row level security;

-- `C-XXXX-XXXX` sin 0/O ni 1/I/L (mismo alfabeto que ALFABETO_CODIGO en
-- src/lib/certificados/codigo.ts). gen_random_uuid() es una fuente
-- criptográfica que no necesita pgcrypto; se saltan los bytes 6 y 8, que en
-- un UUID v4 llevan la versión y la variante y no son aleatorios.
create or replace function public.generar_codigo_certificado()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes  bytea;
  v_cuerpo text;
  v_codigo text;
  v_pos    integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_cuerpo := '';
    foreach v_pos in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
      v_cuerpo := v_cuerpo || substr(v_alfabeto, (get_byte(v_bytes, v_pos) % 31) + 1, 1);
    end loop;
    v_codigo := 'C-' || substr(v_cuerpo, 1, 4) || '-' || substr(v_cuerpo, 5, 4);
    exit when not exists (select 1 from public.certificados c where c.codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- Deja el certificado de una inscripción como debe estar: lo emite, lo
-- reactiva (mismo código) o lo revoca.
create or replace function public.sincronizar_certificado(p_inscripcion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v        record;
  v_cumple boolean;
begin
  select i.id, i.porcentaje_pagado, i.asistio, i.cancelada,
         t.estado, t.titulo, t.titulo_acento, t.fechas_texto, t.sede_nombre, t.ciudad, t.region,
         t.horas, t.aval, t.firma_nombre, t.firma_cargo, t.firma_documento,
         p.nombre, p.tipo_documento, p.documento
    into v
    from public.inscripciones i
    join public.talleres t on t.id = i.taller_id
    join public.personas p on p.id = i.persona_id
   where i.id = p_inscripcion_id
  -- Bloquea la fila del taller (compartido) mientras se decide. Sin esto, un
  -- `update talleres set estado = ...` y un cambio de la inscripción que corren
  -- a la vez se leen mutuamente a medias: cada uno ve el estado anterior del
  -- otro y una inscripción que cumple se queda sin certificado. Con el bloqueo
  -- se serializan: el segundo espera al commit del primero y relee el taller.
  -- No es un advisory lock a propósito: ajustar_porcentaje toma primero el
  -- advisory y luego la fila de la inscripción, y el trigger del taller va en
  -- orden inverso; mezclarlos daría un interbloqueo. La fila del taller solo la
  -- toman estos caminos y siempre antes que cualquier fila de certificados.
  for share of t;

  if not found then
    return;
  end if;

  -- Archivado cuenta como terminado: archivar un taller viejo no debe
  -- invalidar sus certificados.
  v_cumple := v.porcentaje_pagado = 100
              and v.asistio
              and not v.cancelada
              and v.estado in ('finalizado', 'archivado');

  if v_cumple then
    insert into public.certificados as c (
      codigo, inscripcion_id, nombre, tipo_documento, documento,
      curso, fechas_texto, sede, ciudad, region, horas, aval,
      firma_nombre, firma_cargo, firma_documento
    )
    values (
      public.generar_codigo_certificado(), v.id, v.nombre, v.tipo_documento, v.documento,
      trim(concat_ws(' ', v.titulo, v.titulo_acento)), v.fechas_texto, v.sede_nombre, v.ciudad,
      v.region, v.horas, v.aval, v.firma_nombre, v.firma_cargo, v.firma_documento
    )
    -- Ya existía: se reactiva con su mismo código, salvo revocación manual.
    -- La copia del taller no se toca.
    on conflict (inscripcion_id) do update
       set revocado_en = case when c.revocado_manual then c.revocado_en else null end;
  else
    update public.certificados c
       set revocado_en = coalesce(c.revocado_en, now())
     where c.inscripcion_id = p_inscripcion_id;
  end if;
end;
$$;

create or replace function public.trg_inscripcion_certificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fusión de personas: el certificado pasa a llevar el nombre del destino.
  if tg_op = 'UPDATE' and new.persona_id is distinct from old.persona_id then
    update public.certificados c
       set nombre = p.nombre, tipo_documento = p.tipo_documento, documento = p.documento
      from public.personas p
     where p.id = new.persona_id and c.inscripcion_id = new.id;
  end if;
  perform public.sincronizar_certificado(new.id);
  return null;
end;
$$;

drop trigger if exists inscripciones_certificado on public.inscripciones;
create trigger inscripciones_certificado
  after insert or update of porcentaje_pagado, asistio, cancelada, persona_id
  on public.inscripciones
  for each row execute function public.trg_inscripcion_certificado();

create or replace function public.trg_taller_certificados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select i.id from public.inscripciones i where i.taller_id = new.id loop
    perform public.sincronizar_certificado(r.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists talleres_certificados on public.talleres;
create trigger talleres_certificados
  after update of estado on public.talleres
  for each row
  when (old.estado is distinct from new.estado)
  execute function public.trg_taller_certificados();

create or replace function public.trg_persona_certificados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.certificados c
     set nombre = new.nombre, tipo_documento = new.tipo_documento, documento = new.documento
    from public.inscripciones i
   where i.persona_id = new.id and c.inscripcion_id = i.id;
  return null;
end;
$$;

drop trigger if exists personas_certificados on public.personas;
create trigger personas_certificados
  after update of nombre, tipo_documento, documento on public.personas
  for each row
  when (old.nombre is distinct from new.nombre
        or old.tipo_documento is distinct from new.tipo_documento
        or old.documento is distinct from new.documento)
  execute function public.trg_persona_certificados();

-- Revocar o quitar la revocación manual. Al quitarla se vuelve a evaluar: si
-- la inscripción ya no cumple, sigue revocado (vigente = false).
create or replace function public.revocar_certificado(p_certificado_id uuid, p_revocar boolean)
returns table (ok boolean, reason text, vigente boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ins      uuid;
  v_revocado timestamptz;
begin
  if p_certificado_id is null then
    return query select false, 'no_encontrado'::text, false;
    return;
  end if;
  if p_revocar is null then
    return query select false, 'estado_invalido'::text, false;
    return;
  end if;

  update public.certificados c
     set revocado_manual = p_revocar,
         revocado_en = case when p_revocar then coalesce(c.revocado_en, now()) else c.revocado_en end
   where c.id = p_certificado_id
  returning c.inscripcion_id into v_ins;

  if v_ins is null then
    return query select false, 'no_encontrado'::text, false;
    return;
  end if;

  if not p_revocar then
    perform public.sincronizar_certificado(v_ins);
  end if;

  select c.revocado_en into v_revocado from public.certificados c where c.id = p_certificado_id;
  return query select true, null::text, v_revocado is null;
end;
$$;

-- Las horas son la excepción a la copia fija: si el admin las carga o las
-- corrige en el taller, los certificados ya emitidos (también los revocados)
-- las reflejan.
create or replace function public.trg_taller_horas_certificados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.certificados c
     set horas = new.horas
    from public.inscripciones i
   where i.taller_id = new.id and c.inscripcion_id = i.id;
  return null;
end;
$$;

drop trigger if exists talleres_horas_certificados on public.talleres;
create trigger talleres_horas_certificados
  after update of horas on public.talleres
  for each row
  when (old.horas is distinct from new.horas)
  execute function public.trg_taller_horas_certificados();

-- ---------------------------------------------------------------------------
-- Flujos públicos y certificados vigentes
--
-- Mismas funciones de la etapa 2 (misma firma), con un cambio: si la persona
-- tiene un certificado no revocado a mano (vigente o revocado solo por no
-- cumplir), la web no puede cambiar su nombre ni su tipo
-- de documento. El resto de la ficha (email, teléfono…) sí se actualiza. La
-- respuesta es ok = true con reason = 'nombre_bloqueado'. El admin
-- (origen = 'admin' y actualizarPersona) sigue pudiendo; el trigger
-- personas_certificados propaga esas correcciones al certificado.
-- ---------------------------------------------------------------------------

-- Reemplaza a persona_tiene_certificado_vigente (versión previa de esta migración).
drop function if exists public.persona_tiene_certificado_vigente(uuid);

-- «Protegida» = tiene algún certificado que el admin no revocó a mano: vigente,
-- o revocado solo porque hoy no cumple (p. ej. se le quitó la asistencia). Si
-- bastara con «vigente», quitar y devolver la asistencia abriría una ventana
-- para que la web cambie el nombre.
create or replace function public.persona_tiene_certificado_protegido(p_persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.certificados c
      join public.inscripciones i on i.id = c.inscripcion_id
     where i.persona_id = p_persona_id and not c.revocado_manual
  )
$$;

create or replace function public.crear_inscripcion(
  p_taller_id      uuid,
  p_referencia     text,
  p_documento      text,
  p_tipo_documento text,
  p_nombre         text,
  p_email          text,
  p_telefono       text,
  p_ciudad         text,
  p_profesion      text,
  p_tarifa_id      text,
  p_tarifa_nombre  text,
  p_monto          integer,
  p_moneda         text,
  p_notas          text,
  p_origen         text,
  p_forzar_cupo    boolean
)
returns table (
  ok                     boolean,
  reason                 text,
  inscripcion_id         uuid,
  inscripcion_referencia text,
  reactivada             boolean,
  cupos_total            integer,
  cupos_ocupados         integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taller    public.talleres%rowtype;
  v_abierto   boolean;
  v_ocupados  integer;
  v_doc       text := public.normalizar_documento(p_documento);
  v_persona   uuid;
  v_existente public.inscripciones%rowtype;
  v_id        uuid;
  v_bloquear  boolean := false;
  v_bloqueado boolean := false;
begin
  if p_origen is null or p_origen not in ('web', 'admin') then
    return query select false, 'origen_invalido'::text, null::uuid, null::text, false, 0, 0;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('taller:' || p_taller_id::text));

  select * into v_taller from public.talleres t where t.id = p_taller_id;
  if not found then
    return query select false, 'taller_desconocido'::text, null::uuid, null::text, false, 0, 0;
    return;
  end if;

  if v_doc is null or v_doc !~ '^[A-Z0-9]{4,20}$' then
    return query select false, 'documento_invalido'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, 0;
    return;
  end if;

  select count(*)::integer into v_ocupados
    from public.inscripciones i
   where i.taller_id = p_taller_id and not i.cancelada;

  v_abierto := v_taller.estado = 'publicado'
               and v_taller.fecha_fin >= (now() at time zone 'America/Caracas')::date;

  -- El admin inscribe en cualquier estado: los cupos apartados por WhatsApp a
  -- veces se registran con el taller ya cerrado o terminado.
  if p_origen = 'web' and not v_abierto then
    return query select false, 'cerrado'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, v_ocupados;
    return;
  end if;

  select p.id into v_persona from public.personas p where p.documento = v_doc;

  if v_persona is not null then
    select * into v_existente
      from public.inscripciones i
     where i.persona_id = v_persona and i.taller_id = p_taller_id;
    -- Ya inscrita: no se toca su ficha (quien conoce un documento ajeno no
    -- debe poder reescribir los datos de esa persona).
    if found and not v_existente.cancelada then
      return query select false, 'ya_inscrito'::text, v_existente.id, v_existente.referencia, false,
                          v_taller.cupos_total, v_ocupados;
      return;
    end if;
  end if;

  if v_ocupados >= v_taller.cupos_total
     and not (p_origen = 'admin' and coalesce(p_forzar_cupo, false)) then
    return query select false, 'sin_cupos'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, v_ocupados;
    return;
  end if;

  -- Con un certificado no revocado a mano, la web no toca nombre ni tipo de documento.
  if v_persona is not null and p_origen = 'web' then
    v_bloquear := public.persona_tiene_certificado_protegido(v_persona);
  end if;

  -- Documento conocido → se actualiza la ficha. Un campo vacío no borra lo guardado.
  if v_persona is null then
    insert into public.personas (documento, tipo_documento, nombre, email, telefono, ciudad, profesion)
    values (v_doc, coalesce(nullif(p_tipo_documento, ''), 'CC'), p_nombre, nullif(p_email, ''),
            nullif(p_telefono, ''), nullif(p_ciudad, ''), nullif(p_profesion, ''))
    returning id into v_persona;
  else
    update public.personas p
       set tipo_documento = case when v_bloquear then p.tipo_documento
                                 else coalesce(nullif(p_tipo_documento, ''), p.tipo_documento) end,
           nombre         = case when v_bloquear then p.nombre
                                 else coalesce(nullif(p_nombre, ''), p.nombre) end,
           email          = coalesce(nullif(p_email, ''), p.email),
           telefono       = coalesce(nullif(p_telefono, ''), p.telefono),
           ciudad         = coalesce(nullif(p_ciudad, ''), p.ciudad),
           profesion      = coalesce(nullif(p_profesion, ''), p.profesion)
     where p.id = v_persona
    returning (v_bloquear
               and (lower(btrim(coalesce(p_nombre, ''))) not in ('', lower(btrim(p.nombre)))
                    or upper(coalesce(nullif(p_tipo_documento, ''), p.tipo_documento)) <> upper(p.tipo_documento)))
      into v_bloqueado;
  end if;

  if v_existente.id is not null then
    -- Estaba cancelada: se reactiva la misma fila, con su referencia y sus comprobantes.
    update public.inscripciones i set cancelada = false where i.id = v_existente.id;
    return query select true, case when v_bloqueado then 'nombre_bloqueado' end, v_existente.id, v_existente.referencia, true,
                        v_taller.cupos_total, v_ocupados + 1;
    return;
  end if;

  insert into public.inscripciones (
    referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, monto, moneda, origen, notas
  )
  values (
    p_referencia, v_persona, p_taller_id, p_tarifa_id, p_tarifa_nombre, p_monto, p_moneda,
    p_origen::public.inscripcion_origen, coalesce(p_notas, '')
  )
  returning id into v_id;

  return query select true, case when v_bloqueado then 'nombre_bloqueado' end, v_id, p_referencia, false,
                      v_taller.cupos_total, v_ocupados + 1;
end;
$$;

create or replace function public.registrar_comprobante(
  p_taller_id      uuid,
  p_documento      text,
  p_comprobante_id uuid,
  p_porcentaje     integer,
  p_nombre         text,
  p_email          text,
  p_telefono       text,
  p_notas          text,
  p_file_path      text,
  p_file_type      text,
  p_file_size      integer
)
returns table (
  ok                     boolean,
  reason                 text,
  inscripcion_referencia text,
  nuevo_en_revision      integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taller   public.talleres%rowtype;
  v_persona  public.personas%rowtype;
  v_ins      public.inscripciones%rowtype;
  v_revision integer;
  v_saldo    integer;
  v_bloquear boolean;
  v_bloqueado boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('taller:' || p_taller_id::text));

  select * into v_taller from public.talleres t where t.id = p_taller_id;
  if not found then
    return query select false, 'taller_desconocido'::text, null::text, 0;
    return;
  end if;

  if not (v_taller.estado = 'publicado'
          and v_taller.fecha_fin >= (now() at time zone 'America/Caracas')::date) then
    return query select false, 'cerrado'::text, null::text, 0;
    return;
  end if;

  select * into v_persona
    from public.personas p
   where p.documento = public.normalizar_documento(p_documento);
  if found then
    select * into v_ins
      from public.inscripciones i
     where i.persona_id = v_persona.id and i.taller_id = p_taller_id and not i.cancelada;
  end if;
  if v_ins.id is null then
    return query select false, 'sin_inscripcion'::text, null::text, 0;
    return;
  end if;

  select coalesce(sum(c.porcentaje), 0)::integer into v_revision
    from public.comprobantes c
   where c.inscripcion_id = v_ins.id and c.estado = 'pending';

  v_saldo := greatest(0, 100 - least(100, v_ins.porcentaje_pagado + v_revision));

  if v_saldo = 0 then
    return query select false, 'sin_saldo'::text, v_ins.referencia, v_revision;
    return;
  end if;

  if p_porcentaje is null or p_porcentaje <= 0 or p_porcentaje > v_saldo
     or not (p_porcentaje = any (v_taller.porcentajes_pago) or p_porcentaje = v_saldo) then
    return query select false, 'porcentaje_no_permitido'::text, v_ins.referencia, v_revision;
    return;
  end if;

  -- Con un certificado no revocado a mano, la web no puede corregir el nombre.
  v_bloquear := public.persona_tiene_certificado_protegido(v_persona.id);
  v_bloqueado := v_bloquear
                 and lower(btrim(coalesce(p_nombre, ''))) not in ('', lower(btrim(v_persona.nombre)));

  update public.personas p
     set nombre   = case when v_bloquear then p.nombre else coalesce(nullif(p_nombre, ''), p.nombre) end,
         email    = coalesce(nullif(p_email, ''), p.email),
         telefono = coalesce(nullif(p_telefono, ''), p.telefono)
   where p.id = v_persona.id
  returning * into v_persona;

  insert into public.comprobantes (
    id, inscripcion_id, porcentaje, nombre, documento, email, telefono, notas,
    file_path, file_type, file_size
  )
  values (
    p_comprobante_id, v_ins.id, p_porcentaje, v_persona.nombre, v_persona.documento,
    v_persona.email, v_persona.telefono, coalesce(p_notas, ''),
    p_file_path, p_file_type, p_file_size
  );

  return query select true, case when v_bloqueado then 'nombre_bloqueado' end, v_ins.referencia,
                      v_revision + p_porcentaje;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create or replace view public.certificados_detalle
with (security_invoker = on) as
  select
    c.id, c.codigo, c.inscripcion_id, i.taller_id, i.referencia,
    c.nombre, c.tipo_documento, c.documento,
    c.curso, c.fechas_texto, c.sede, c.ciudad, c.region, c.horas, c.aval,
    c.firma_nombre, c.firma_cargo, c.firma_documento,
    c.emitido_en, c.revocado_en, c.revocado_manual
  from public.certificados c
  join public.inscripciones i on i.id = c.inscripcion_id;

create or replace view public.certificados_vigentes
with (security_invoker = on) as
  select * from public.certificados_detalle where revocado_en is null;

-- Las columnas de la etapa 2, en el mismo orden, y al final las del certificado.
create or replace view public.inscritos_admin
with (security_invoker = on) as
  select
    i.id,
    i.referencia,
    i.taller_id,
    i.persona_id,
    p.documento,
    p.tipo_documento,
    p.nombre,
    p.email,
    p.telefono,
    p.ciudad,
    p.profesion,
    i.tarifa_nombre,
    i.monto,
    i.moneda,
    i.porcentaje_pagado,
    i.porcentaje_manual,
    coalesce(sum(c.porcentaje) filter (where c.estado = 'pending'), 0)::integer as porcentaje_en_revision,
    (count(c.id) filter (where c.estado = 'verified'))::integer as comprobantes_verificados,
    i.cancelada,
    i.asistio,
    i.origen,
    i.notas,
    i.creado_en,
    ce.codigo as certificado_codigo,
    (ce.revocado_en is not null) as certificado_revocado
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  left join public.comprobantes c on c.inscripcion_id = i.id
  left join public.certificados ce on ce.inscripcion_id = i.id
  group by i.id, p.id, ce.id;

revoke all on public.certificados_detalle, public.certificados_vigentes, public.inscritos_admin
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emisión de lo que ya cumple (p. ej. el certificado de prueba de
-- taller-2026-10). Idempotente: si ya existe, lo deja como está.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select i.id
      from public.inscripciones i
      join public.talleres t on t.id = i.taller_id
     where t.estado in ('finalizado', 'archivado')
  loop
    perform public.sincronizar_certificado(r.id);
  end loop;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.generar_codigo_certificado()',
    'public.sincronizar_certificado(uuid)',
    'public.trg_inscripcion_certificado()',
    'public.trg_taller_certificados()',
    'public.trg_persona_certificados()',
    'public.trg_taller_horas_certificados()',
    'public.persona_tiene_certificado_protegido(uuid)',
    'public.revocar_certificado(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.revocar_certificado(uuid, boolean) to service_role;
  -- Las dos funciones de la etapa 2 que se redefinen conservan sus permisos:
  -- se reafirman por si create or replace los hubiera cambiado.
  foreach f in array array[
    'public.crear_inscripcion(uuid, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, boolean)',
    'public.registrar_comprobante(uuid, text, uuid, integer, text, text, text, text, text, text, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

-- Que la API de Supabase (PostgREST) vea ya las funciones y vistas nuevas;
-- el aviso se entrega al hacer commit.
notify pgrst, 'reload schema';

commit;
