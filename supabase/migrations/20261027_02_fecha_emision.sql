-- ---------------------------------------------------------------------------
-- Fecha de emisión del certificado = día siguiente al fin del taller
--
-- Hasta aquí `emitido_en` era el momento en que la base emitía el certificado
-- (al marcar el último pago o la asistencia), así que dos asistentes del mismo
-- taller podían tener fechas distintas. Ahora todos los de un taller llevan el
-- día siguiente a su `fecha_fin` (24–25 oct → 26 oct), a mediodía de Caracas
-- para que ninguna zona horaria mueva el día. Si se cambia la fecha de fin del
-- taller, sus certificados la siguen.
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261027_02_fecha_emision.sql
-- Idempotente.
-- ---------------------------------------------------------------------------

begin;

-- Si otra sesión retiene un bloqueo, falla en vez de quedarse esperando.
set local lock_timeout = '10s';

create or replace function public.fecha_emision_taller(p_fecha_fin date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_fecha_fin + 1)::timestamp + interval '12 hours') at time zone 'America/Caracas'
$$;

-- Certificado nuevo: toma la fecha de su taller.
create or replace function public.certificado_fecha_emision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select public.fecha_emision_taller(t.fecha_fin)
    into new.emitido_en
    from public.inscripciones i
    join public.talleres t on t.id = i.taller_id
   where i.id = new.inscripcion_id;
  return new;
end;
$$;

drop trigger if exists certificados_fecha_emision on public.certificados;
create trigger certificados_fecha_emision
  before insert on public.certificados
  for each row execute function public.certificado_fecha_emision();

-- Cambia la fecha de fin del taller: sus certificados la siguen.
create or replace function public.taller_fecha_emision_certificados()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.certificados c
     set emitido_en = public.fecha_emision_taller(new.fecha_fin)
    from public.inscripciones i
   where i.taller_id = new.id
     and c.inscripcion_id = i.id;
  return null;
end;
$$;

drop trigger if exists talleres_fecha_emision_certificados on public.talleres;
create trigger talleres_fecha_emision_certificados
  after update of fecha_fin on public.talleres
  for each row
  when (old.fecha_fin is distinct from new.fecha_fin)
  execute function public.taller_fecha_emision_certificados();

-- Los certificados ya emitidos.
update public.certificados c
   set emitido_en = public.fecha_emision_taller(t.fecha_fin)
  from public.inscripciones i
  join public.talleres t on t.id = i.taller_id
 where c.inscripcion_id = i.id
   and c.emitido_en is distinct from public.fecha_emision_taller(t.fecha_fin);

-- Solo las usan los triggers: nadie de fuera las llama.
revoke all on function public.fecha_emision_taller(date) from public, anon, authenticated;
revoke all on function public.certificado_fecha_emision() from public, anon, authenticated;
revoke all on function public.taller_fecha_emision_certificados() from public, anon, authenticated;

commit;
