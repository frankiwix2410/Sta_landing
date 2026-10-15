-- ---------------------------------------------------------------------------
-- Etapa 1 · Talleres administrables
--
-- Convierte `taller_editions` en `talleres`: estado, fechas reales, sede,
-- precios y firma por taller, y la regla de que nunca haya dos talleres activos
-- con fechas solapadas.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar → Run. Se ejecuta después de
-- `supabase/schema.sql` y es idempotente: puede volver a ejecutarse.
--
-- No toca `reservations` ni `payment_proofs`: sus FK a `taller_editions(slug)`
-- siguen la tabla al renombrarla.
-- ---------------------------------------------------------------------------

begin;

do $$
begin
  create type public.taller_estado as enum
    ('borrador', 'publicado', 'cerrado', 'finalizado', 'archivado');
exception
  when duplicate_object then null;
end
$$;

-- Las vistas dependen de columnas que cambian o desaparecen: se recrean al final.
drop view if exists public.taller_availability;
drop view if exists public.taller_certificates;

do $$
begin
  if to_regclass('public.talleres') is null then
    alter table public.taller_editions rename to talleres;
  end if;
end
$$;

-- Renombres de columnas (solo si siguen con el nombre viejo).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('name', 'nombre'),
      ('total_seats', 'cupos_total'),
      ('dates_label', 'fechas_texto'),
      ('hours', 'horas'),
      ('endorsement', 'aval'),
      ('created_at', 'creado_en')
    ) as v(viejo, nuevo)
  loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'talleres' and column_name = r.viejo
    ) and not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'talleres' and column_name = r.nuevo
    ) then
      execute format('alter table public.talleres rename column %I to %I', r.viejo, r.nuevo);
    end if;
  end loop;
end
$$;

alter table public.talleres
  add column if not exists id                 uuid not null default gen_random_uuid(),
  add column if not exists titulo             text,
  add column if not exists titulo_acento      text,
  add column if not exists modalidad          text not null default 'Taller presencial',
  add column if not exists estado             public.taller_estado not null default 'borrador',
  add column if not exists fecha_inicio       date,
  add column if not exists fecha_fin          date,
  add column if not exists sede_nombre        text,
  add column if not exists ciudad             text,
  add column if not exists region             text,
  add column if not exists pais               text,
  add column if not exists porcentajes_pago   integer[] not null default '{50,100}',
  add column if not exists moneda             text not null default 'COP',
  add column if not exists precios_publicados boolean not null default false,
  add column if not exists tarifas            jsonb not null default '[]'::jsonb,
  add column if not exists foto_principal     text,
  add column if not exists foto_principal_alt text,
  add column if not exists firma_nombre       text,
  add column if not exists firma_cargo        text,
  add column if not exists firma_documento    text,
  -- Reservado para contenido propio del taller (módulos, FAQ, galería…).
  -- Nulo = la página usa el contenido por defecto de `src/lib/taller.ts`.
  add column if not exists contenido          jsonb,
  add column if not exists actualizado_en     timestamptz not null default now();

create unique index if not exists talleres_id_key on public.talleres (id);

-- `course_title` ("A + B") se parte en título y acento.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talleres' and column_name = 'course_title'
  ) then
    update public.talleres
       set titulo = coalesce(
             titulo,
             case when position(' + ' in course_title) > 0
                  then split_part(course_title, ' + ', 1)
                  else coalesce(course_title, nombre) end),
           titulo_acento = coalesce(
             titulo_acento,
             case when position(' + ' in course_title) > 0
                  then '+ ' || substr(course_title, position(' + ' in course_title) + 3) end);
    alter table public.talleres drop column course_title;
  end if;
end
$$;

-- `is_open` pasa a `estado`. Solo corre la primera vez (luego la columna ya no
-- existe), así que no pisa estados elegidos después desde el admin.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talleres' and column_name = 'is_open'
  ) then
    update public.talleres
       set estado = case when is_open then 'publicado'::public.taller_estado
                         else 'finalizado'::public.taller_estado end;
    -- Las filas antiguas cerradas pasan a 'finalizado' y no a 'cerrado' para que
    -- no cuenten como activas en la restricción de solapamiento.
    -- Decisión del dueño: la edición de octubre 2026 se trata como terminada
    -- (taller de prueba para certificados).
    update public.talleres set estado = 'finalizado' where slug = 'taller-2026-10';
    alter table public.talleres drop column is_open;
  end if;
end
$$;

-- Datos de la edición existente que antes vivían en `src/lib/taller.ts`. Solo
-- la primera vez (fecha_inicio nula): luego no pisa lo que se edite en el admin.
update public.talleres
   set titulo             = coalesce(titulo, 'Anestesia Regional Ecoguiada'),
       titulo_acento      = coalesce(titulo_acento, '+ Sedación TCI'),
       fecha_inicio       = coalesce(fecha_inicio, date '2026-10-24'),
       fecha_fin          = coalesce(fecha_fin, date '2026-10-25'),
       sede_nombre        = coalesce(sede_nombre, 'Policlínico San Francisco'),
       ciudad             = coalesce(ciudad, 'Maracaibo'),
       region             = coalesce(region, 'Zulia'),
       pais               = coalesce(pais, 'Venezuela'),
       foto_principal     = coalesce(foto_principal, '/assets/taller-bomba-tci.webp'),
       foto_principal_alt = coalesce(foto_principal_alt,
                              'Stevan J. Camelo junto a una bomba de infusión para sedación TCI'),
       firma_nombre       = coalesce(firma_nombre, 'MD. Stevan J. Camelo C.'),
       firma_cargo        = coalesce(firma_cargo, 'Anestesiólogo'),
       firma_documento    = coalesce(firma_documento, 'C.C. 1.136.882.468'),
       tarifas = case when tarifas = '[]'::jsonb then
         '[{"id":"general","nombre":"Cupo General","descripcion":"Acceso completo a los 7 módulos, prácticas y certificado.","precio":0,"destacada":true},
           {"id":"residente","nombre":"Residente / Estudiante","descripcion":"Tarifa especial. Requiere certificado de residencia vigente.","precio":0,"destacada":false}]'::jsonb
         else tarifas end
 where slug = 'taller-2026-10'
   and fecha_inicio is null;

-- Cualquier otra fila antigua: valores mínimos para poder exigir NOT NULL.
update public.talleres
   set titulo       = coalesce(titulo, nombre),
       fecha_inicio = coalesce(fecha_inicio, creado_en::date),
       fecha_fin    = coalesce(fecha_fin, creado_en::date),
       fechas_texto = coalesce(fechas_texto, ''),
       sede_nombre  = coalesce(sede_nombre, ''),
       ciudad       = coalesce(ciudad, ''),
       pais         = coalesce(pais, '')
 where titulo is null or fecha_inicio is null or fecha_fin is null
    or fechas_texto is null or sede_nombre is null or ciudad is null or pais is null;

alter table public.talleres
  alter column titulo       set not null,
  alter column fecha_inicio set not null,
  alter column fecha_fin    set not null,
  alter column fechas_texto set not null,
  alter column sede_nombre  set not null,
  alter column ciudad       set not null,
  alter column pais         set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'talleres_fechas_orden') then
    alter table public.talleres
      add constraint talleres_fechas_orden check (fecha_fin >= fecha_inicio);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'talleres_porcentajes_validos') then
    alter table public.talleres
      add constraint talleres_porcentajes_validos
      check (porcentajes_pago <@ array[25, 50, 75, 100] and 100 = any (porcentajes_pago));
  end if;

  -- La regla central: dos talleres activos (publicado o cerrado) nunca
  -- comparten un día. Los rangos son cerrados por ambos lados ('[]').
  if not exists (select 1 from pg_constraint where conname = 'talleres_sin_solape') then
    alter table public.talleres
      add constraint talleres_sin_solape
      exclude using gist (daterange(fecha_inicio, fecha_fin, '[]') with &&)
      where (estado in ('publicado', 'cerrado'));
  end if;
end
$$;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists talleres_actualizado_en on public.talleres;
create trigger talleres_actualizado_en
  before update on public.talleres
  for each row execute function public.tocar_actualizado_en();

alter table public.talleres enable row level security;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create or replace view public.talleres_disponibilidad
with (security_invoker = on) as
  select
    t.id,
    t.slug,
    t.cupos_total as total,
    (count(r.id) filter (where r.status <> 'cancelled'))::integer as ocupados,
    greatest(t.cupos_total - (count(r.id) filter (where r.status <> 'cancelled')), 0)::integer as libres
  from public.talleres t
  left join public.reservations r on r.edition = t.slug
  group by t.id, t.slug, t.cupos_total;

-- Vista de COMPATIBILIDAD: el código desplegado aún lee `taller_availability`
-- con las columnas antiguas. Existe solo hasta desplegar el código nuevo y se
-- eliminará en la etapa 2.
create or replace view public.taller_availability
with (security_invoker = on) as
  select
    t.slug,
    t.nombre as name,
    t.cupos_total as total_seats,
    (t.estado = 'publicado'
       and t.fecha_fin >= (now() at time zone 'America/Caracas')::date) as is_open,
    (count(r.id) filter (where r.status <> 'cancelled'))::integer as taken,
    greatest(t.cupos_total - (count(r.id) filter (where r.status <> 'cancelled')), 0)::integer as remaining
  from public.talleres t
  left join public.reservations r on r.edition = t.slug
  group by t.slug, t.nombre, t.cupos_total, t.estado, t.fecha_fin;

create or replace view public.taller_certificates
with (security_invoker = on) as
  select
    r.reference,
    r.name,
    r.email,
    r.profession,
    r.city,
    r.edition,
    trim(concat_ws(' ', t.titulo, t.titulo_acento)) as course_title,
    t.fechas_texto as dates_label,
    t.horas        as hours,
    t.aval         as endorsement,
    t.ciudad       as venue_city,
    t.region       as venue_region,
    t.firma_nombre    as signature_name,
    t.firma_cargo     as signature_title,
    t.firma_documento as signature_document,
    r.created_at
  from public.reservations r
  join public.talleres t on t.slug = r.edition
  where r.status = 'confirmed'
    and r.attended;

-- ---------------------------------------------------------------------------
-- Funciones de reserva y pago: misma firma, ahora leen `talleres`.
-- "Abierto" = publicado y sin haber terminado (hora de Caracas).
-- ---------------------------------------------------------------------------

create or replace function public.create_reservation(
  p_edition    text,
  p_reference  text,
  p_tier_id    text,
  p_tier_name  text,
  p_amount     integer,
  p_currency   text,
  p_name       text,
  p_email      text,
  p_phone      text,
  p_city       text,
  p_profession text,
  p_notes      text
)
returns table (
  ok             boolean,
  reason         text,
  reservation_id uuid,
  seats_total    integer,
  seats_taken    integer,
  seats_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_open  boolean;
  v_taken integer;
  v_id    uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_edition));

  select t.cupos_total,
         (t.estado = 'publicado' and t.fecha_fin >= (now() at time zone 'America/Caracas')::date)
    into v_total, v_open
    from public.talleres t
   where t.slug = p_edition;

  if not found then
    return query select false, 'unknown_edition'::text, null::uuid, 0, 0, 0;
    return;
  end if;

  select count(*)::integer
    into v_taken
    from public.reservations r
   where r.edition = p_edition
     and r.status <> 'cancelled';

  if not v_open then
    return query select false, 'closed'::text, null::uuid,
                        v_total, v_taken, greatest(v_total - v_taken, 0);
    return;
  end if;

  if v_taken >= v_total then
    return query select false, 'sold_out'::text, null::uuid, v_total, v_taken, 0;
    return;
  end if;

  insert into public.reservations (
    reference, edition, tier_id, tier_name, amount, currency,
    name, email, phone, city, profession, notes
  )
  values (
    p_reference, p_edition, p_tier_id, p_tier_name, p_amount, p_currency,
    p_name, p_email, p_phone, p_city, p_profession, coalesce(p_notes, '')
  )
  returning public.reservations.id into v_id;

  v_taken := v_taken + 1;

  return query select true, null::text, v_id,
                      v_total, v_taken, greatest(v_total - v_taken, 0);
end;
$$;

create or replace function public.register_payment_proof(
  p_edition            text,
  p_proof_id           uuid,
  p_existing_reference text,
  p_new_reference      text,
  p_tier_id            text,
  p_tier_name          text,
  p_amount             integer,
  p_currency           text,
  p_kind               text,
  p_name               text,
  p_document           text,
  p_email              text,
  p_phone              text,
  p_city               text,
  p_profession         text,
  p_notes              text,
  p_file_path          text,
  p_file_type          text,
  p_file_size          integer
)
returns table (
  ok                    boolean,
  reason                text,
  reservation_reference text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total  integer;
  v_open   boolean;
  v_taken  integer;
  v_res_id uuid;
  v_ref    text;
begin
  perform pg_advisory_xact_lock(hashtext(p_edition));

  select t.cupos_total,
         (t.estado = 'publicado' and t.fecha_fin >= (now() at time zone 'America/Caracas')::date)
    into v_total, v_open
    from public.talleres t
   where t.slug = p_edition;

  if not found then
    return query select false, 'unknown_edition'::text, null::text;
    return;
  end if;

  -- Antes el pago a una reserva existente se aceptaba siempre. Ahora el
  -- registro de pagos se cierra con el taller, igual que en la página.
  if not v_open then
    return query select false, 'closed'::text, null::text;
    return;
  end if;

  if p_existing_reference is not null then
    select r.id, r.reference
      into v_res_id, v_ref
      from public.reservations r
     where r.reference = p_existing_reference
       and r.edition   = p_edition
       and r.status   <> 'cancelled';

    if not found then
      return query select false, 'unknown_reference'::text, null::text;
      return;
    end if;

    update public.reservations
       set document = coalesce(document, p_document)
     where id = v_res_id;
  else
    select count(*)::integer
      into v_taken
      from public.reservations r
     where r.edition = p_edition
       and r.status <> 'cancelled';

    if v_taken >= v_total then
      return query select false, 'sold_out'::text, null::text;
      return;
    end if;

    insert into public.reservations (
      reference, edition, tier_id, tier_name, amount, currency,
      name, document, email, phone, city, profession
    )
    values (
      p_new_reference, p_edition, p_tier_id, p_tier_name, p_amount, p_currency,
      p_name, p_document, p_email, p_phone, p_city, p_profession
    )
    returning public.reservations.id, public.reservations.reference
      into v_res_id, v_ref;
  end if;

  insert into public.payment_proofs (
    id, edition, reservation_id, reference, kind,
    name, document, email, phone, notes, file_path, file_type, file_size
  )
  values (
    p_proof_id, p_edition, v_res_id, v_ref, p_kind::public.payment_kind,
    p_name, p_document, p_email, p_phone, coalesce(p_notes, ''),
    p_file_path, p_file_type, p_file_size
  );

  return query select true, null::text, v_ref;
end;
$$;

revoke all on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) to service_role;

revoke all on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) to service_role;

commit;
