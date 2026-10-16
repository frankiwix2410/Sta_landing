-- ---------------------------------------------------------------------------
-- Limpieza tras desplegar la etapa 3
--
-- Quita lo que solo existía para que el código de etapas anteriores siguiera
-- en pie durante los despliegues. Las tablas `_legacy_*` se conservan.
--
-- Cómo aplicarlo, SOLO con la etapa 3 ya desplegada:
--   ./scripts/migrar.sh supabase/migrations/20261015_03_limpieza.sql
-- Idempotente.
-- ---------------------------------------------------------------------------

begin;

-- Si otra sesión retiene un bloqueo, falla en vez de quedarse esperando.
set local lock_timeout = '10s';

drop view if exists public.taller_certificates;

drop function if exists public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
);

drop function if exists public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
);

-- Una firma que no coincida haría que `drop ... if exists` no borrara nada en
-- silencio: se comprueba que no quede ninguna de las tres.
do $$
begin
  if to_regclass('public.taller_certificates') is not null
     or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public'
                   and p.proname in ('create_reservation', 'register_payment_proof')) then
    raise exception 'La limpieza no quitó todo: revisa las firmas';
  end if;
end
$$;

-- Que la API de Supabase (PostgREST) vea ya las funciones y vistas nuevas;
-- el aviso se entrega al hacer commit.
notify pgrst, 'reload schema';

commit;
