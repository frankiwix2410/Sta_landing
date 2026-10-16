-- Solo lectura. Tras 20261015_03: las tres columnas deben salir vacías (null).
select to_regclass('public.taller_certificates') as vista_antigua,
       to_regprocedure('public.create_reservation(text,text,text,text,integer,text,text,text,text,text,text,text)') as reserva_antigua,
       to_regprocedure('public.register_payment_proof(text,uuid,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer)') as pago_antiguo;
