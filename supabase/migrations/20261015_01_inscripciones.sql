-- ---------------------------------------------------------------------------
-- Etapa 2 · Personas, inscripciones y comprobantes
--
-- El número de documento pasa a identificar a la persona en toda la
-- plataforma. `reservations` y `payment_proofs` se migran fila por fila a
-- `personas` / `inscripciones` / `comprobantes` (mismos id, referencias y
-- archivos) y se renombran a `_legacy_*`: no se borra nada. Los duplicados no
-- se resuelven aquí: se fusionan a mano desde el admin.
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261015_01_inscripciones.sql
-- Va después de 20261013_01_talleres.sql. Es idempotente: puede volver a
-- ejecutarse mientras no se haya aplicado 20261015_02 (que amplía una vista).
-- Si algo falla, la transacción se deshace entera.
-- ---------------------------------------------------------------------------

begin;

-- Si otra sesión retiene un bloqueo, falla en vez de quedarse esperando.
set local lock_timeout = '10s';

do $$
begin
  create type public.inscripcion_origen as enum ('web', 'admin', 'migracion');
exception
  when duplicate_object then null;
end
$$;

-- `talleres.id` es único por un índice; una FK necesita una restricción. Se
-- reutiliza el mismo índice. La PK sigue siendo `slug`: las tablas `_legacy_*`
-- apuntan a ella y el código nuevo usa `id`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'talleres_id_key' and conrelid = 'public.talleres'::regclass
  ) then
    alter table public.talleres add constraint talleres_id_key unique using index talleres_id_key;
  end if;
end
$$;

-- Misma normalización que `normalizarDocumento` en src/lib/inscripciones/documento.ts:
-- descompone (NFD), pasa a mayúsculas y deja solo A-Z y 0-9. Las marcas de las
-- tildes quedan sueltas al descomponer y caen con el resto de símbolos; así
-- coincide con la versión de TypeScript para cualquier letra con tilde, no solo
-- para una lista fija.
create or replace function public.normalizar_documento(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(upper(normalize(coalesce(p, ''), nfd)), '[^A-Z0-9]', '', 'g'),
    '')
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  -- Normalizado. Nulo solo en personas migradas sin documento: quedan
  -- «por identificar» hasta que el admin lo complete o las fusione.
  documento      text unique check (documento ~ '^[A-Z0-9]{4,20}$'),
  tipo_documento text not null default 'CC'
                 check (tipo_documento in ('CC', 'CE', 'PAS', 'CI', 'OTRO')),
  -- El que se imprime en el certificado.
  nombre         text not null check (length(nombre) between 1 and 160),
  -- Nulos permitidos: el admin inscribe a gente que apartó cupo por WhatsApp
  -- y a veces no tiene su email. La web los exige.
  email          text,
  telefono       text,
  ciudad         text,
  profesion      text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.inscripciones (
  -- Las migradas conservan el id y la referencia de `reservations`.
  id                uuid primary key default gen_random_uuid(),
  referencia        text not null unique,
  persona_id        uuid not null references public.personas (id),
  taller_id         uuid not null references public.talleres (id),
  -- Copia de la tarifa al inscribirse: cambiar precios no reescribe lo pasado.
  tarifa_id         text not null,
  tarifa_nombre     text not null,
  monto             integer,
  moneda            text,
  -- Suma de comprobantes verificados (tope 100), o el valor que fije el admin.
  porcentaje_pagado integer not null default 0 check (porcentaje_pagado between 0 and 100),
  porcentaje_manual boolean not null default false,
  -- Cancelada libera el cupo; la fila se conserva por su historial.
  cancelada         boolean not null default false,
  asistio           boolean not null default false,
  origen            public.inscripcion_origen not null default 'web',
  notas             text not null default '',
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint inscripciones_persona_taller_key unique (persona_id, taller_id)
);

create index if not exists inscripciones_taller_idx on public.inscripciones (taller_id);

create table if not exists public.comprobantes (
  -- Las migradas conservan el id y el archivo de `payment_proofs`.
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones (id),
  -- Lo que cubre este pago, en % del total.
  porcentaje     integer not null check (porcentaje between 1 and 100),
  estado         public.payment_proof_status not null default 'pending',
  -- Datos de quien pagó tal como estaban al subirlo (para cruzar con el banco).
  nombre         text,
  documento      text,
  email          text,
  telefono       text,
  notas          text not null default '',
  -- Ruta dentro del bucket privado `comprobantes` (`<slug>/<id>.<ext>`).
  file_path      text not null unique,
  file_type      text not null,
  file_size      integer not null check (file_size > 0),
  nota_admin     text,
  revisado_en    timestamptz,
  creado_en      timestamptz not null default now()
);

create index if not exists comprobantes_inscripcion_idx on public.comprobantes (inscripcion_id);
create index if not exists comprobantes_estado_idx on public.comprobantes (estado, creado_en desc);

drop trigger if exists personas_actualizado_en on public.personas;
create trigger personas_actualizado_en
  before update on public.personas
  for each row execute function public.tocar_actualizado_en();

drop trigger if exists inscripciones_actualizado_en on public.inscripciones;
create trigger inscripciones_actualizado_en
  before update on public.inscripciones
  for each row execute function public.tocar_actualizado_en();

alter table public.personas      enable row level security;
alter table public.inscripciones enable row level security;
alter table public.comprobantes  enable row level security;

-- ---------------------------------------------------------------------------
-- Migración de datos. Solo la primera vez: después `reservations` ya se llama
-- `_legacy_reservations` y el bloque no hace nada.
-- ---------------------------------------------------------------------------

do $$
declare
  r           record;
  v_doc       text;
  v_duplicado text;
  v_taller    uuid;
  v_persona   uuid;
  v_huerfanos integer;
begin
  if to_regclass('public.reservations') is null then
    return;
  end if;

  -- Ningún taller puede estar abierto mientras se migra (ver «Orden de
  -- despliegue» del plan): una reserva web entrando a mitad se perdería.
  if exists (select 1 from public.talleres t where t.estado = 'publicado') then
    raise exception 'Hay talleres en estado publicado. Ciérralos (estado cerrado) antes de migrar.';
  end if;

  -- Un comprobante sin reserva no tiene inscripción a la que colgarse. Antes
  -- que perderlo, se aborta (y la transacción no deja nada a medias).
  select count(*) into v_huerfanos from public.payment_proofs where reservation_id is null;
  if v_huerfanos > 0 then
    raise exception 'Hay % comprobantes sin reserva (payment_proofs.reservation_id nulo). Asígnalos a mano antes de migrar.', v_huerfanos;
  end if;

  for r in
    select res.*,
           -- La reserva hecha sin pagar no pedía documento; el comprobante sí.
           coalesce(res.document, (
             select p.document from public.payment_proofs p
              where p.reservation_id = res.id and p.document is not null
              order by p.created_at
              limit 1
           )) as doc_original
      from public.reservations res
     order by res.created_at, res.id
  loop
    v_doc := public.normalizar_documento(r.doc_original);
    if v_doc !~ '^[A-Z0-9]{4,20}$' then
      v_doc := null;
    end if;

    select t.id into v_taller from public.talleres t where t.slug = r.edition;

    v_persona := null;
    v_duplicado := null;
    if v_doc is not null then
      select p.id into v_persona from public.personas p where p.documento = v_doc;
      -- Mismo documento dos veces en el mismo taller: la segunda no puede ser
      -- la misma persona (unique persona+taller). Queda por identificar, con
      -- una nota, y el admin decide si la fusiona.
      if v_persona is not null and exists (
        select 1 from public.inscripciones i where i.persona_id = v_persona and i.taller_id = v_taller
      ) then
        v_duplicado := v_doc;
        v_persona := null;
        v_doc := null;
      end if;
    end if;

    if v_persona is null then
      insert into public.personas (documento, nombre, email, telefono, ciudad, profesion, creado_en)
      values (v_doc, r.name, nullif(r.email, ''), nullif(r.phone, ''), nullif(r.city, ''),
              nullif(r.profession, ''), r.created_at)
      returning id into v_persona;
    end if;

    insert into public.inscripciones (
      id, referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, monto, moneda,
      porcentaje_pagado, porcentaje_manual, cancelada, asistio, origen, notas, creado_en
    )
    values (
      r.id, r.reference, v_persona, v_taller, r.tier_id, r.tier_name, r.amount, r.currency,
      -- `confirmed` se confirmaba a mano tras ver el pago: equivale a 100% fijado.
      case when r.status = 'confirmed' then 100 else 0 end,
      r.status = 'confirmed',
      r.status = 'cancelled',
      r.attended,
      'migracion',
      concat_ws(E'\n',
        nullif(r.notes, ''),
        case when v_duplicado is not null then
          'Migración: el documento ' || v_duplicado
          || ' ya tenía otra reserva en este taller. Revisa si es un duplicado y fusiónalo.'
        end),
      r.created_at
    );
  end loop;

  insert into public.comprobantes (
    id, inscripcion_id, porcentaje, estado, nombre, documento, email, telefono, notas,
    file_path, file_type, file_size, creado_en
  )
  select p.id, p.reservation_id,
         case p.kind when 'deposit' then 50 else 100 end,
         p.status, p.name, p.document, p.email, p.phone, p.notes,
         p.file_path, p.file_type, p.file_size, p.created_at
    from public.payment_proofs p;

  -- Lo pagado según comprobantes verificados (hoy ninguno); las confirmadas
  -- conservan su 100% manual.
  update public.inscripciones i
     set porcentaje_pagado = least(100, s.total)
    from (
      select c.inscripcion_id, sum(c.porcentaje)::integer as total
        from public.comprobantes c
       where c.estado = 'verified'
       group by c.inscripcion_id
    ) s
   where s.inscripcion_id = i.id
     and not i.porcentaje_manual;

  alter table public.payment_proofs rename to _legacy_payment_proofs;
  alter table public.reservations rename to _legacy_reservations;
end
$$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

-- La de compatibilidad de la etapa 1 ya no la usa ningún código.
drop view if exists public.taller_availability;

-- Mismas columnas que antes: el código desplegado de la etapa 1 la sigue
-- leyendo durante el despliegue.
create or replace view public.talleres_disponibilidad
with (security_invoker = on) as
  select
    t.id,
    t.slug,
    t.cupos_total as total,
    (count(i.id) filter (where not i.cancelada))::integer as ocupados,
    greatest(t.cupos_total - (count(i.id) filter (where not i.cancelada)), 0)::integer as libres
  from public.talleres t
  left join public.inscripciones i on i.taller_id = t.id
  group by t.id, t.slug, t.cupos_total;

-- COMPATIBILIDAD: las páginas de certificados de la etapa 1 y 2 leen esta
-- vista. Mismas columnas; «confirmado» pasa a ser 100% pagado. Se elimina en
-- 20261015_03_limpieza.sql, cuando ya nadie la usa.
create or replace view public.taller_certificates
with (security_invoker = on) as
  select
    i.referencia as reference,
    p.nombre as name,
    coalesce(p.email, '') as email,
    coalesce(p.profesion, '') as profession,
    coalesce(p.ciudad, '') as city,
    t.slug as edition,
    trim(concat_ws(' ', t.titulo, t.titulo_acento)) as course_title,
    t.fechas_texto as dates_label,
    t.horas as hours,
    t.aval as endorsement,
    t.ciudad as venue_city,
    t.region as venue_region,
    t.firma_nombre as signature_name,
    t.firma_cargo as signature_title,
    t.firma_documento as signature_document,
    i.creado_en as created_at
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  join public.talleres t on t.id = i.taller_id
  where i.porcentaje_pagado = 100
    and i.asistio
    and not i.cancelada;

-- Lista de inscritos del admin: una fila por inscripción con su persona y lo
-- que está en revisión. La etapa 3 le añade columnas al final.
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
    i.creado_en
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  left join public.comprobantes c on c.inscripcion_id = i.id
  group by i.id, p.id;

create or replace view public.comprobantes_admin
with (security_invoker = on) as
  select
    c.id,
    c.inscripcion_id,
    i.referencia,
    i.taller_id,
    t.nombre as taller_nombre,
    p.nombre as persona_nombre,
    p.documento as persona_documento,
    p.tipo_documento as persona_tipo_documento,
    c.porcentaje,
    c.estado,
    c.notas,
    c.nota_admin,
    c.file_path,
    c.file_type,
    c.file_size,
    c.creado_en,
    c.revisado_en,
    i.porcentaje_pagado,
    i.porcentaje_manual
  from public.comprobantes c
  join public.inscripciones i on i.id = c.inscripcion_id
  join public.personas p on p.id = i.persona_id
  join public.talleres t on t.id = i.taller_id;

revoke all on public.talleres_disponibilidad, public.taller_certificates,
              public.inscritos_admin, public.comprobantes_admin
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones. Devuelven una fila `ok/reason` en vez de lanzar excepciones: así
-- el servidor distingue «sin cupos» de un fallo real.
-- ---------------------------------------------------------------------------

-- Alta de inscripción (web o admin). El advisory lock por taller serializa el
-- «¿queda cupo?» con el insert: dos envíos simultáneos no venden la misma plaza.
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

  -- Documento conocido → se actualiza la ficha. Un campo vacío no borra lo guardado.
  if v_persona is null then
    insert into public.personas (documento, tipo_documento, nombre, email, telefono, ciudad, profesion)
    values (v_doc, coalesce(nullif(p_tipo_documento, ''), 'CC'), p_nombre, nullif(p_email, ''),
            nullif(p_telefono, ''), nullif(p_ciudad, ''), nullif(p_profesion, ''))
    returning id into v_persona;
  else
    update public.personas p
       set tipo_documento = coalesce(nullif(p_tipo_documento, ''), p.tipo_documento),
           nombre         = coalesce(nullif(p_nombre, ''), p.nombre),
           email          = coalesce(nullif(p_email, ''), p.email),
           telefono       = coalesce(nullif(p_telefono, ''), p.telefono),
           ciudad         = coalesce(nullif(p_ciudad, ''), p.ciudad),
           profesion      = coalesce(nullif(p_profesion, ''), p.profesion)
     where p.id = v_persona;
  end if;

  if v_existente.id is not null then
    -- Estaba cancelada: se reactiva la misma fila, con su referencia y sus comprobantes.
    update public.inscripciones i set cancelada = false where i.id = v_existente.id;
    return query select true, null::text, v_existente.id, v_existente.referencia, true,
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

  return query select true, null::text, v_id, p_referencia, false,
                      v_taller.cupos_total, v_ocupados + 1;
end;
$$;

-- Paso 1 del registro de pago: ¿hay inscripción activa con este documento?
-- El servidor enmascara lo que devuelve antes de mandarlo al navegador.
create or replace function public.consultar_inscripcion(p_taller_id uuid, p_documento text)
returns table (
  inscripcion_id         uuid,
  referencia             text,
  tipo_documento         text,
  nombre                 text,
  email                  text,
  telefono               text,
  monto                  integer,
  moneda                 text,
  porcentaje_pagado      integer,
  porcentaje_en_revision integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.referencia, p.tipo_documento, p.nombre, p.email, p.telefono, i.monto, i.moneda,
         i.porcentaje_pagado,
         coalesce((
           select sum(c.porcentaje) from public.comprobantes c
            where c.inscripcion_id = i.id and c.estado = 'pending'
         ), 0)::integer
    from public.personas p
    join public.inscripciones i on i.persona_id = p.id
   where p.documento = public.normalizar_documento(p_documento)
     and i.taller_id = p_taller_id
     and not i.cancelada
$$;

-- Paso 2: registra el comprobante. Lo vuelve a validar todo (el paso 1 no deja
-- ningún token): taller abierto, inscripción activa, porcentaje permitido y
-- que no supere el saldo contando lo que está en revisión. Aplica las
-- correcciones que la persona reescribió completas. El archivo ya está en el
-- bucket; si esto devuelve ok = false, el servidor lo borra.
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

  update public.personas p
     set nombre   = coalesce(nullif(p_nombre, ''), p.nombre),
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

  return query select true, null::text, v_ins.referencia, v_revision + p_porcentaje;
end;
$$;

-- Lo pagado = suma de verificados (tope 100), salvo que el admin lo fijara a mano.
create or replace function public.recalcular_porcentaje(p_inscripcion_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.inscripciones i
     set porcentaje_pagado = least(100, coalesce((
           select sum(c.porcentaje) from public.comprobantes c
            where c.inscripcion_id = i.id and c.estado = 'verified'
         ), 0))
   where i.id = p_inscripcion_id
     and not i.porcentaje_manual;
$$;

create or replace function public.revisar_comprobante(
  p_comprobante_id uuid,
  p_estado         text,
  p_nota           text
)
returns table (ok boolean, reason text, nuevo_porcentaje integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ins    uuid;
  v_pct    integer;
  v_taller uuid;
begin
  if p_estado is null or p_estado not in ('pending', 'verified', 'rejected') then
    return query select false, 'estado_invalido'::text, null::integer;
    return;
  end if;

  -- Mismo bloqueo por taller que registrar_comprobante: la revisión no se
  -- cruza con un pago que entra a la vez.
  select i.taller_id into v_taller
    from public.comprobantes c join public.inscripciones i on i.id = c.inscripcion_id
   where c.id = p_comprobante_id;
  if v_taller is not null then
    perform pg_advisory_xact_lock(hashtext('taller:' || v_taller::text));
  end if;

  update public.comprobantes c
     set estado      = p_estado::public.payment_proof_status,
         nota_admin  = nullif(trim(coalesce(p_nota, '')), ''),
         revisado_en = case when p_estado = 'pending' then null else now() end
   where c.id = p_comprobante_id
  returning c.inscripcion_id into v_ins;

  if v_ins is null then
    return query select false, 'no_encontrado'::text, null::integer;
    return;
  end if;

  perform public.recalcular_porcentaje(v_ins);
  select i.porcentaje_pagado into v_pct from public.inscripciones i where i.id = v_ins;
  return query select true, null::text, v_pct;
end;
$$;

-- Ajuste manual del admin (pagos por fuera de la web). `null` = volver a
-- calcularlo con los comprobantes verificados.
create or replace function public.ajustar_porcentaje(p_inscripcion_id uuid, p_porcentaje integer)
returns table (ok boolean, reason text, nuevo_porcentaje integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pct    integer;
  v_taller uuid;
begin
  if p_porcentaje is not null and (p_porcentaje < 0 or p_porcentaje > 100) then
    return query select false, 'porcentaje_no_permitido'::text, null::integer;
    return;
  end if;

  select i.taller_id into v_taller from public.inscripciones i where i.id = p_inscripcion_id;
  if v_taller is not null then
    perform pg_advisory_xact_lock(hashtext('taller:' || v_taller::text));
  end if;

  update public.inscripciones i
     set porcentaje_manual = p_porcentaje is not null,
         porcentaje_pagado = coalesce(p_porcentaje, i.porcentaje_pagado)
   where i.id = p_inscripcion_id;

  if not found then
    return query select false, 'no_encontrado'::text, null::integer;
    return;
  end if;

  perform public.recalcular_porcentaje(p_inscripcion_id);
  select i.porcentaje_pagado into v_pct from public.inscripciones i where i.id = p_inscripcion_id;
  return query select true, null::text, v_pct;
end;
$$;

-- Borra una inscripción (p. ej. de prueba) con sus comprobantes sin verificar.
-- Devuelve las rutas de los archivos para que el servidor los quite del bucket.
create or replace function public.eliminar_inscripcion(p_inscripcion_id uuid)
returns table (ok boolean, reason text, archivos text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona  uuid;
  v_taller   uuid;
  v_archivos text[];
begin
  select i.persona_id, i.taller_id into v_persona, v_taller
    from public.inscripciones i where i.id = p_inscripcion_id;
  if v_persona is null then
    return query select false, 'no_encontrado'::text, null::text[];
    return;
  end if;

  -- Bloqueo por taller y comprobación de pagos verificados, en ese orden.
  perform pg_advisory_xact_lock(hashtext('taller:' || v_taller::text));

  if exists (
    select 1 from public.comprobantes c
     where c.inscripcion_id = p_inscripcion_id and c.estado = 'verified'
  ) then
    return query select false, 'tiene_pagos_verificados'::text, null::text[];
    return;
  end if;

  -- La tabla `certificados` llega en la etapa 3. El IF anidado evita que
  -- plpgsql planifique la consulta mientras la tabla no existe.
  if to_regclass('public.certificados') is not null then
    if exists (select 1 from public.certificados ce where ce.inscripcion_id = p_inscripcion_id) then
      return query select false, 'tiene_certificado'::text, null::text[];
      return;
    end if;
  end if;

  with borrados as (
    delete from public.comprobantes c where c.inscripcion_id = p_inscripcion_id
    returning c.file_path
  )
  select coalesce(array_agg(b.file_path), '{}') into v_archivos from borrados b;

  delete from public.inscripciones i where i.id = p_inscripcion_id;

  -- Si la persona se queda sin inscripciones, se va con ella.
  delete from public.personas p
   where p.id = v_persona
     and not exists (select 1 from public.inscripciones i where i.persona_id = p.id);

  return query select true, null::text, v_archivos;
end;
$$;

-- Fusiona dos fichas de la misma persona. El destino conserva sus datos y solo
-- hereda lo que le falte. Si las dos están en el mismo taller (el duplicado
-- típico: reservó dos veces), sus inscripciones se unen en la del destino.
create or replace function public.fusionar_personas(p_origen uuid, p_destino uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen  public.personas%rowtype;
  v_destino public.personas%rowtype;
  r         record;
begin
  if p_origen = p_destino then
    return query select false, 'misma_persona'::text;
    return;
  end if;

  select * into v_origen from public.personas p where p.id = p_origen for update;
  select * into v_destino from public.personas p where p.id = p_destino for update;
  if v_origen.id is null or v_destino.id is null then
    return query select false, 'no_encontrado'::text;
    return;
  end if;

  -- Una inscripción con certificado no puede desaparecer (llega en la etapa 3).
  if to_regclass('public.certificados') is not null then
    if exists (
      select 1
        from public.inscripciones io
        join public.inscripciones id_ on id_.taller_id = io.taller_id and id_.persona_id = p_destino
        join public.certificados ce on ce.inscripcion_id = io.id
       where io.persona_id = p_origen
    ) then
      return query select false, 'tiene_certificado'::text;
      return;
    end if;
  end if;

  for r in
    select io.id as origen_id, io.referencia as origen_ref, io.porcentaje_pagado as origen_pct,
           io.porcentaje_manual as origen_manual, io.asistio as origen_asistio,
           io.cancelada as origen_cancelada, io.notas as origen_notas,
           id_.id as destino_id
      from public.inscripciones io
      join public.inscripciones id_ on id_.taller_id = io.taller_id and id_.persona_id = p_destino
     where io.persona_id = p_origen
  loop
    update public.comprobantes c set inscripcion_id = r.destino_id where c.inscripcion_id = r.origen_id;

    update public.inscripciones i
       set asistio           = i.asistio or r.origen_asistio,
           cancelada         = i.cancelada and r.origen_cancelada,
           porcentaje_manual = i.porcentaje_manual or r.origen_manual,
           porcentaje_pagado = case when i.porcentaje_manual or r.origen_manual
                                    then greatest(i.porcentaje_pagado, r.origen_pct)
                                    else i.porcentaje_pagado end,
           notas = concat_ws(E'\n', nullif(i.notas, ''), nullif(r.origen_notas, ''),
                             'Fusionada con ' || r.origen_ref || '.')
     where i.id = r.destino_id;

    delete from public.inscripciones i where i.id = r.origen_id;
    perform public.recalcular_porcentaje(r.destino_id);
  end loop;

  update public.inscripciones i set persona_id = p_destino where i.persona_id = p_origen;

  -- Primero se borra el origen para liberar su documento (es único).
  delete from public.personas p where p.id = p_origen;

  update public.personas p
     set documento      = coalesce(p.documento, v_origen.documento),
         tipo_documento = case when p.documento is null and v_origen.documento is not null
                               then v_origen.tipo_documento else p.tipo_documento end,
         email          = coalesce(p.email, v_origen.email),
         telefono       = coalesce(p.telefono, v_origen.telefono),
         ciudad         = coalesce(p.ciudad, v_origen.ciudad),
         profesion      = coalesce(p.profesion, v_origen.profesion)
   where p.id = p_destino;

  return query select true, null::text;
end;
$$;

-- Son SECURITY DEFINER: nadie salvo service_role (el servidor) las ejecuta.
-- Supabase da EXECUTE a anon/authenticated por defecto en `public`; se quita.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.normalizar_documento(text)',
    'public.crear_inscripcion(uuid, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, boolean)',
    'public.consultar_inscripcion(uuid, text)',
    'public.registrar_comprobante(uuid, text, uuid, integer, text, text, text, text, text, text, integer)',
    'public.recalcular_porcentaje(uuid)',
    'public.revisar_comprobante(uuid, text, text)',
    'public.ajustar_porcentaje(uuid, integer)',
    'public.eliminar_inscripcion(uuid)',
    'public.fusionar_personas(uuid, uuid)'
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
