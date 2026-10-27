-- Solo lectura. Tras 20261027_02: cada certificado con fecha de emisión = día
-- siguiente al fin de su taller (en hora de Caracas).
select t.slug,
       t.fecha_fin,
       count(*) as certificados,
       min((c.emitido_en at time zone 'America/Caracas')::date) as emision_min,
       max((c.emitido_en at time zone 'America/Caracas')::date) as emision_max
  from public.certificados c
  join public.inscripciones i on i.id = c.inscripcion_id
  join public.talleres t on t.id = i.taller_id
 group by t.slug, t.fecha_fin
 order by t.slug;
