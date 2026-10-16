-- Solo lectura. scripts/migrar.sh lo ejecuta después de 20261013_01_talleres.sql.
select slug, estado, titulo, titulo_acento, fecha_inicio, fecha_fin, cupos_total from public.talleres;
select * from public.talleres_disponibilidad;
