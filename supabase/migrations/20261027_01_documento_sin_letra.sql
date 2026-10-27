-- ---------------------------------------------------------------------------
-- La V o la E de las cédulas venezolanas deja de contar
--
-- "V-20.111.222" y "20.111.222" son la misma persona, pero se guardaban como
-- `V20111222` y `20111222`: quien escribía el número sin la letra no
-- encontraba su reserva ni su certificado. Desde aquí una V o E delante de un
-- número de 5 o más cifras se quita al normalizar, igual que hace
-- `normalizarDocumento` en src/lib/inscripciones/documento.ts. Otros
-- documentos con letras (pasaportes, "VE123456"...) quedan como estaban.
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261027_01_documento_sin_letra.sql
-- Idempotente.
-- ---------------------------------------------------------------------------

begin;

-- Si otra sesión retiene un bloqueo, falla en vez de quedarse esperando.
set local lock_timeout = '10s';

create or replace function public.normalizar_documento(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(upper(normalize(coalesce(p, ''), nfd)), '[^A-Z0-9]', '', 'g'),
      '^[VE]([0-9]{5,})$', '\1'),
    '')
$$;

-- Documentos ya guardados con la letra. Si al quitarla chocan con otra persona
-- (la misma, inscrita dos veces con y sin letra), se para: eso se resuelve
-- fusionando las fichas desde el admin, no aquí.
do $$
declare
  v_choques integer;
begin
  select count(*) into v_choques
    from public.personas p
    join public.personas q on q.documento = substr(p.documento, 2)
   where p.documento ~ '^[VE][0-9]{5,}$';

  if v_choques > 0 then
    raise exception
      'Hay % persona(s) guardadas con y sin la letra: fusiona esas fichas en el admin y vuelve a ejecutar.',
      v_choques;
  end if;

  -- El trigger de personas lleva el documento corregido a sus certificados.
  update public.personas
     set documento = substr(documento, 2)
   where documento ~ '^[VE][0-9]{5,}$';
end
$$;

commit;
