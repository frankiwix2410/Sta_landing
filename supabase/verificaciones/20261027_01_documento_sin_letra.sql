-- Solo lectura. Tras 20261027_01: ninguna persona con V/E delante del número,
-- y la función ya la quita.
select count(*) filter (where documento ~ '^[VE][0-9]{5,}$') as con_letra,
       count(*) as personas,
       public.normalizar_documento('V-20.111.222') as prueba_v,
       public.normalizar_documento('VE123456') as prueba_otro
  from public.personas;
