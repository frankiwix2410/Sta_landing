-- ---------------------------------------------------------------------------
-- Reservas del taller — esquema Supabase
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar este archivo → Run.
-- Es idempotente solo ANTES de la migración 20261013_01: una vez que existe
-- `public.talleres`, este archivo se niega a ejecutarse (ver el guard de abajo).
--
-- Después de este archivo se aplican, en orden, los de `supabase/migrations/`.
-- Este archivo describe el esquema inicial; las migraciones lo transforman
-- (p. ej. `taller_editions` pasa a llamarse `talleres`).
--
-- Modelo de seguridad: RLS activo y SIN políticas. Eso deja las tablas
-- inaccesibles para las claves `anon` y `authenticated`; solo la clave
-- `service_role` (que vive únicamente en el servidor, en
-- SUPABASE_SERVICE_ROLE_KEY) puede leer y escribir. La landing nunca habla con
-- Supabase desde el navegador.
-- ---------------------------------------------------------------------------

-- Guard: tras la migración, volver a correr este archivo recrearía una
-- `taller_editions` vacía y devolvería las funciones a la versión antigua.
do $$
begin
  if to_regclass('public.talleres') is not null then
    raise exception 'schema.sql ya fue migrado: aplica solo supabase/migrations/';
  end if;
end
$$;

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
  -- Fechas tal cual se imprimen ("Octubre 24 y 25, 2026").
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
  -- Cédula o pasaporte. Nulo en las reservas que se hacen sin pagar: solo se
  -- pide al registrar un comprobante, que es cuando hay que cruzar quién pagó.
  document    text,
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
alter table public.reservations add column if not exists document text;

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
-- Comprobantes de pago
--
-- Lo que sube quien ya pagó el abono (50%) o el taller completo desde la
-- sección «Registrar pago». Registrarlo asigna número de reserva, pero NO la
-- confirma: se revisa el archivo y se pasa a mano la reserva a «confirmed».
--
-- Para ver un comprobante: Storage → comprobantes → carpeta de la edición →
-- el archivo cuyo nombre coincide con `file_path`.
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.payment_kind as enum ('deposit', 'full');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_proof_status as enum ('pending', 'verified', 'rejected');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.payment_proofs (
  id          uuid primary key default gen_random_uuid(),
  edition     text not null references public.taller_editions (slug),
  -- Referencia STA-XXXXXXXX que la persona escribió. Sin FK a propósito: puede
  -- no tenerla o equivocarse, y el comprobante igual tiene que quedar guardado.
  reference   text,
  -- deposit: abono del 50%. full: pago completo.
  kind        public.payment_kind not null,
  name        text not null,
  -- Documento tal cual lo escribió quien subió el comprobante. Se guarda aquí
  -- además de en la reserva: si el pago se cuelga de una reserva anterior, este
  -- es el dato de quien hizo la transferencia.
  document    text,
  email       text not null,
  phone       text not null,
  notes       text not null default '',
  -- Ruta dentro del bucket `comprobantes` (`<edición>/<id>.<ext>`).
  file_path   text not null unique,
  file_type   text not null,
  file_size   integer not null check (file_size > 0),
  -- pending: sin revisar. verified: pago comprobado. rejected: no es válido.
  status      public.payment_proof_status not null default 'pending',
  created_at  timestamptz not null default now()
);

-- Reserva a la que pertenece el comprobante. Nulo solo en filas anteriores a
-- esta columna: `register_payment_proof` siempre la rellena.
alter table public.payment_proofs
  add column if not exists reservation_id uuid references public.reservations (id);

alter table public.payment_proofs add column if not exists document text;

create index if not exists payment_proofs_edition_created_at_idx
  on public.payment_proofs (edition, created_at desc);

create index if not exists payment_proofs_reservation_id_idx
  on public.payment_proofs (reservation_id);

alter table public.payment_proofs enable row level security;

-- ---------------------------------------------------------------------------
-- Alta de comprobante
--
-- Registrar el pago es lo que asigna el número de reserva:
--   · Con `p_existing_reference`: el comprobante se cuelga de esa reserva y se
--     devuelve la misma referencia. No se crea otra, así nadie ocupa dos cupos.
--   · Sin ella: se crea la reserva (reclamando cupo, igual que
--     `create_reservation`) y se devuelve la referencia nueva.
--
-- Reserva y comprobante se insertan en la misma transacción: nunca queda un
-- número de reserva sin su comprobante ni un comprobante sin reserva. El
-- archivo ya está en el bucket cuando se llama; si esto devuelve `ok = false`
-- el servidor lo borra.
-- ---------------------------------------------------------------------------

-- Añadir un parámetro crea una sobrecarga en vez de reemplazar la función, así
-- que la firma anterior (sin `p_document`) se elimina antes.
drop function if exists public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, integer
);

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

    -- La reserva pudo crearse desde el formulario de reserva, que no pide
    -- documento. `coalesce` evita pisar uno ya guardado con una errata nueva.
    update public.reservations
       set document = coalesce(document, p_document)
     where id = v_res_id;
  else
    select e.total_seats, e.is_open
      into v_total, v_open
      from public.taller_editions e
     where e.slug = p_edition;

    if not found then
      return query select false, 'unknown_edition'::text, null::text;
      return;
    end if;

    select count(*)::integer
      into v_taken
      from public.reservations r
     where r.edition = p_edition
       and r.status <> 'cancelled';

    if not v_open then
      return query select false, 'closed'::text, null::text;
      return;
    end if;

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

revoke all on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;

grant execute on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) to service_role;

-- Bucket privado: sin políticas en storage.objects, solo service_role lee y
-- escribe. Los límites repiten los del servidor (`PROOF_MAX_BYTES`) como segunda
-- barrera.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

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
  'Octubre 24 y 25, 2026',
  -- TODO: horas académicas reales. Mientras sea NULL el certificado no las menciona.
  null,
  'Avalado por SCARE – SARG'
)
on conflict (slug) do nothing;

-- Relleno para bases que ya tenían la fila antes de existir estos campos. Solo
-- toca lo que esté vacío, así que no pisa nada que hayas editado a mano.
update public.taller_editions
   set course_title = coalesce(course_title, 'Anestesia Regional Ecoguiada + Sedación TCI'),
       dates_label  = coalesce(dates_label,  'Octubre 24 y 25, 2026'),
       endorsement  = coalesce(endorsement,  'Avalado por SCARE – SARG')
 where slug = 'taller-2026-10';

-- Corrección de fecha: la edición es el 24 y 25 de octubre, no el 23 y 24. Se
-- acota al valor equivocado para no pisar una fecha editada a mano.
update public.taller_editions
   set dates_label = 'Octubre 24 y 25, 2026'
 where slug = 'taller-2026-10'
   and dates_label = 'Octubre 23 y 24, 2026';
