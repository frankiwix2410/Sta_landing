-- ---------------------------------------------------------------------------
-- Reservas del taller — esquema Supabase
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar este archivo → Run.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- Modelo de seguridad: RLS activo y SIN políticas. Eso deja las tablas
-- inaccesibles para las claves `anon` y `authenticated`; solo la clave
-- `service_role` (que vive únicamente en el servidor, en
-- SUPABASE_SERVICE_ROLE_KEY) puede leer y escribir. La landing nunca habla con
-- Supabase desde el navegador.
-- ---------------------------------------------------------------------------

-- Estado de la reserva como ENUM y no como texto con CHECK: el Table Editor de
-- Supabase pinta los ENUM como desplegable, así que confirmar un pago es elegir
-- de una lista en vez de escribir «confirmed» a mano y arriesgar una errata.
do $$
begin
  create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

-- Ediciones del taller: una fila por convocatoria. El cupo se edita aquí, no en
-- el código, para poder ampliarlo o cerrar ventas sin volver a desplegar.
--
-- Los campos de certificado viven aquí y no en `src/lib/taller.ts` a propósito:
-- cuando se programe la edición siguiente, el código apuntará a otras fechas y
-- los certificados ya emitidos tienen que seguir diciendo lo que decían.
create table if not exists public.taller_editions (
  slug          text primary key,
  name          text not null,
  total_seats   integer not null check (total_seats >= 0),
  is_open       boolean not null default true,
  -- Título tal cual se imprime en el certificado.
  course_title  text,
  -- Fechas tal cual se imprimen ("Octubre 23 y 24, 2026").
  dates_label   text,
  -- Horas académicas acreditadas. Nulo = el certificado no las menciona.
  hours         integer check (hours is null or hours > 0),
  endorsement   text,
  created_at    timestamptz not null default now()
);

-- Altas para bases que ya tenían la tabla de una versión anterior.
alter table public.taller_editions add column if not exists course_title text;
alter table public.taller_editions add column if not exists dates_label  text;
alter table public.taller_editions add column if not exists hours        integer;
alter table public.taller_editions add column if not exists endorsement  text;

create table if not exists public.reservations (
  id          uuid primary key default gen_random_uuid(),
  -- La referencia la genera el servidor (STA-XXXXXXXX) y es lo que el asistente
  -- ve en pantalla. Única: dos reservas nunca comparten referencia.
  reference   text not null unique,
  edition     text not null references public.taller_editions (slug),
  tier_id     text not null,
  tier_name   text not null,
  -- Importe en la unidad menor de la moneda. Nulo mientras los precios no estén
  -- publicados (`taller.pricing.published === false`).
  amount      integer,
  currency    text,
  name        text not null,
  email       text not null,
  phone       text not null,
  city        text not null,
  profession  text not null,
  notes       text not null default '',
  -- pending: reserva registrada, pago sin confirmar. Ocupa cupo.
  -- confirmed: pago registrado. Ocupa cupo.
  -- cancelled: libera el cupo.
  status      public.reservation_status not null default 'pending',
  -- Se marca al terminar el taller. Es lo que habilita el certificado: pagar y
  -- presentarse no son lo mismo, y quien no asistió no debe certificarse.
  attended    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.reservations add column if not exists attended boolean not null default false;

-- Conversión para bases que ya tenían `status` como texto con CHECK. El bloque
-- no hace nada si la columna ya es del tipo ENUM, así que el archivo se puede
-- volver a ejecutar tantas veces como haga falta.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'reservations'
       and column_name  = 'status'
       and data_type    = 'text'
  ) then
    alter table public.reservations alter column status drop default;
    alter table public.reservations drop constraint if exists reservations_status_check;
    alter table public.reservations
      alter column status type public.reservation_status
      using status::public.reservation_status;
    alter table public.reservations alter column status set default 'pending';
  end if;
end
$$;

-- El conteo de cupos filtra por edición y estado; sin este índice cada envío
-- del formulario hace un seq scan de la tabla entera.
create index if not exists reservations_edition_status_idx
  on public.reservations (edition, status);

create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);

alter table public.taller_editions enable row level security;
alter table public.reservations    enable row level security;

-- ---------------------------------------------------------------------------
-- Disponibilidad
-- ---------------------------------------------------------------------------

create or replace view public.taller_availability
with (security_invoker = on) as
  select
    e.slug,
    e.name,
    e.total_seats,
    e.is_open,
    (count(r.id) filter (where r.status <> 'cancelled'))::integer as taken,
    greatest(
      e.total_seats - (count(r.id) filter (where r.status <> 'cancelled')),
      0
    )::integer as remaining
  from public.taller_editions e
  left join public.reservations r on r.edition = e.slug
  group by e.slug;

-- ---------------------------------------------------------------------------
-- Certificados
--
-- Quién tiene derecho a certificado: pago confirmado Y asistencia marcada. La
-- vista se queda con los datos de la edición para que un certificado emitido
-- hoy siga siendo correcto cuando `taller_editions` tenga convocatorias nuevas.
-- ---------------------------------------------------------------------------

create or replace view public.taller_certificates
with (security_invoker = on) as
  select
    r.reference,
    r.name,
    r.email,
    r.profession,
    r.city,
    r.edition,
    coalesce(e.course_title, e.name) as course_title,
    e.dates_label,
    e.hours,
    e.endorsement,
    r.created_at
  from public.reservations r
  join public.taller_editions e on e.slug = r.edition
  where r.status = 'confirmed'
    and r.attended;

-- ---------------------------------------------------------------------------
-- Alta de reserva
--
-- Toda la reserva pasa por aquí en vez de por un INSERT suelto porque el
-- "¿queda cupo?" y el "insertar" tienen que ser una sola operación atómica.
-- Con dos consultas separadas, dos envíos simultáneos leen el mismo conteo y
-- ambos venden el último cupo. El advisory lock serializa las reservas de la
-- edición durante la transacción.
--
-- Devuelve una fila de estado en lugar de lanzar excepciones: así el servidor
-- distingue "sin cupos" de un fallo real de red o credenciales.
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
-- Los nombres de salida llevan prefijo (`seats_*`, `reservation_id`) a
-- propósito: en plpgsql los parámetros OUT son variables en el mismo espacio de
-- nombres que las columnas, y llamarlos `id` o `total_seats` haría ambiguas las
-- referencias dentro del cuerpo.
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

  select e.total_seats, e.is_open
    into v_total, v_open
    from public.taller_editions e
   where e.slug = p_edition;

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

-- La función es SECURITY DEFINER: revocamos el acceso público y lo damos solo
-- a service_role, que es quien la llama desde el servidor.
revoke all on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Edición actual — ajusta `total_seats` al cupo real del taller.
-- ---------------------------------------------------------------------------

insert into public.taller_editions (
  slug, name, total_seats, course_title, dates_label, hours, endorsement
)
values (
  'taller-2026-10',
  'Anestesia Regional Ecoguiada + Sedación TCI · Octubre 2026',
  20,
  'Anestesia Regional Ecoguiada + Sedación TCI',
  'Octubre 23 y 24, 2026',
  -- TODO: horas académicas reales. Mientras sea NULL el certificado no las menciona.
  null,
  'Avalado por SCARE – SARG'
)
on conflict (slug) do nothing;

-- Relleno para bases que ya tenían la fila antes de existir estos campos. Solo
-- toca lo que esté vacío, así que no pisa nada que hayas editado a mano.
update public.taller_editions
   set course_title = coalesce(course_title, 'Anestesia Regional Ecoguiada + Sedación TCI'),
       dates_label  = coalesce(dates_label,  'Octubre 23 y 24, 2026'),
       endorsement  = coalesce(endorsement,  'Avalado por SCARE – SARG')
 where slug = 'taller-2026-10';
