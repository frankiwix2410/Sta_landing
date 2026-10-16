-- Filas como las de producción ANTES de la etapa 2, para probar la migración
-- en la base desechable de scripts/probar-migraciones.sh. NUNCA en Supabase.
-- Va después de schema.sql y 20261013_01_talleres.sql.

begin;

-- La migración exige que ningún taller esté publicado (en producción se cierra
-- a mano antes de migrar, según el plan de despliegue).
update public.talleres set estado = 'cerrado' where estado = 'publicado';

insert into public.reservations
  (id, reference, edition, tier_id, tier_name, amount, currency, name, document, email, phone,
   city, profession, notes, status, attended, created_at)
values
  -- Luis reservó dos veces; solo el comprobante de la primera trae documento.
  ('10000000-0000-0000-0000-000000000001', 'STA-SEED0001', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Luis Pérez', null, 'luis@example.com', '+57 300 000 0001', 'Maracaibo', 'Anestesiólogo', '', 'pending', false, '2026-09-20 10:00-05'),
  ('10000000-0000-0000-0000-000000000002', 'STA-SEED0002', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Luis Pérez', null, 'luis@example.com', '+57 300 000 0001', 'Maracaibo', 'Anestesiólogo', '', 'pending', false, '2026-09-20 10:05-05'),
  -- María, dos veces con el mismo documento escrito distinto.
  ('10000000-0000-0000-0000-000000000003', 'STA-SEED0003', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'María Gómez', 'V-20.111.222', 'maria@example.com', '+58 414 000 0003', 'Caracas', 'Residente', 'Factura a la clínica', 'pending', false, '2026-09-21 09:00-05'),
  ('10000000-0000-0000-0000-000000000004', 'STA-SEED0004', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'María Gómez', 'V20111222', 'maria@example.com', '+58 414 000 0003', 'Caracas', 'Residente', '', 'pending', false, '2026-09-21 09:10-05'),
  -- El certificado de prueba.
  ('10000000-0000-0000-0000-000000000005', 'STA-SEED0005', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Prueba Certificado', null, 'prueba@example.com', '+57 300 000 0005', 'Bogotá', 'Médico', '', 'confirmed', true, '2026-09-22 12:00-05'),
  ('10000000-0000-0000-0000-000000000006', 'STA-SEED0006', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Carla Ruiz', '987654', 'carla@example.com', '+57 300 000 0006', 'Medellín', 'Anestesióloga', '', 'cancelled', false, '2026-09-23 08:00-05'),
  ('10000000-0000-0000-0000-000000000007', 'STA-SEED0007', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Test', null, 'test@example.com', '+57 300 000 0007', 'X', 'X', 'prueba', 'pending', false, '2026-09-24 08:00-05'),
  ('10000000-0000-0000-0000-000000000008', 'STA-SEED0008', 'taller-2026-10', 'general', 'Cupo General', null, null,
   'Pedro Díaz', null, 'pedro@example.com', '+57 300 000 0008', 'Maracaibo', 'Médico general', '', 'pending', false, '2026-09-25 08:00-05');

insert into public.payment_proofs
  (id, edition, reservation_id, reference, kind, name, document, email, phone, notes,
   file_path, file_type, file_size, status, created_at)
values
  ('20000000-0000-0000-0000-000000000001', 'taller-2026-10', '10000000-0000-0000-0000-000000000001', 'STA-SEED0001', 'deposit',
   'Luis Pérez', '12.345.678', 'luis@example.com', '+57 300 000 0001', '', 'taller-2026-10/20000000-0000-0000-0000-000000000001.jpg', 'image/jpeg', 1000, 'pending', '2026-09-20 11:00-05'),
  ('20000000-0000-0000-0000-000000000002', 'taller-2026-10', '10000000-0000-0000-0000-000000000002', 'STA-SEED0002', 'full',
   'Luis Pérez', null, 'luis@example.com', '+57 300 000 0001', '', 'taller-2026-10/20000000-0000-0000-0000-000000000002.pdf', 'application/pdf', 2000, 'pending', '2026-09-20 11:05-05'),
  ('20000000-0000-0000-0000-000000000003', 'taller-2026-10', '10000000-0000-0000-0000-000000000003', 'STA-SEED0003', 'full',
   'María Gómez', 'V-20.111.222', 'maria@example.com', '+58 414 000 0003', 'Bancolombia', 'taller-2026-10/20000000-0000-0000-0000-000000000003.png', 'image/png', 3000, 'pending', '2026-09-21 10:00-05'),
  ('20000000-0000-0000-0000-000000000004', 'taller-2026-10', '10000000-0000-0000-0000-000000000004', 'STA-SEED0004', 'deposit',
   'María Gómez', 'V20111222', 'maria@example.com', '+58 414 000 0003', '', 'taller-2026-10/20000000-0000-0000-0000-000000000004.jpg', 'image/jpeg', 4000, 'pending', '2026-09-21 10:10-05'),
  ('20000000-0000-0000-0000-000000000005', 'taller-2026-10', '10000000-0000-0000-0000-000000000005', 'STA-SEED0005', 'full',
   'Prueba Certificado', null, 'prueba@example.com', '+57 300 000 0005', '', 'taller-2026-10/20000000-0000-0000-0000-000000000005.jpg', 'image/jpeg', 5000, 'pending', '2026-09-22 13:00-05'),
  ('20000000-0000-0000-0000-000000000006', 'taller-2026-10', '10000000-0000-0000-0000-000000000006', 'STA-SEED0006', 'deposit',
   'Carla Ruiz', '987654', 'carla@example.com', '+57 300 000 0006', '', 'taller-2026-10/20000000-0000-0000-0000-000000000006.heic', 'image/heic', 6000, 'pending', '2026-09-23 09:00-05'),
  ('20000000-0000-0000-0000-000000000007', 'taller-2026-10', '10000000-0000-0000-0000-000000000007', 'STA-SEED0007', 'full',
   'Test', null, 'test@example.com', '+57 300 000 0007', '', 'taller-2026-10/20000000-0000-0000-0000-000000000007.jpg', 'image/jpeg', 7000, 'pending', '2026-09-24 09:00-05'),
  ('20000000-0000-0000-0000-000000000008', 'taller-2026-10', '10000000-0000-0000-0000-000000000008', 'STA-SEED0008', 'deposit',
   'Pedro Díaz', '31.222.333', 'pedro@example.com', '+57 300 000 0008', '', 'taller-2026-10/20000000-0000-0000-0000-000000000008.webp', 'image/webp', 8000, 'pending', '2026-09-25 09:00-05');

commit;
