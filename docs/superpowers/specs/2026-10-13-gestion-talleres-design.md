# Gestión de talleres, inscripciones, pagos y certificados — Diseño

Fecha: 2026-10-13
Estado: aprobado en conversación, pendiente de revisión escrita

## 1. Objetivo

Hoy el taller vive en el código (`src/lib/taller.ts`): una sola edición, con
`soldOut` y precios escritos a mano, y todo se relaciona por la referencia
`STA-XXXXXXXX`. Confirmar pagos y marcar asistencia se hace en el Table Editor
de Supabase.

Queremos:

1. Administrar talleres desde `/admin`: crear, editar, duplicar, programar,
   cambiar de estado, definir cupos, precios y porcentajes de pago aceptados.
2. Que `/taller` funcione sola: muestra el taller activo con datos reales de la
   base (cupos, estado, fechas, precios). Nunca dos talleres activos con fechas
   solapadas.
3. Que el **número de documento** sea el identificador único de la persona en
   toda la plataforma; una persona puede asistir a varios talleres.
4. Gestionar inscripciones y pagos desde el admin: inscribir a mano (cupos
   apartados por WhatsApp), revisar comprobantes, ajustar lo pagado, marcar
   asistencia, cancelar/eliminar, fusionar duplicados.
5. Certificados personales autogenerados (nombre y documento impresos), con
   código propio y QR de verificación; descargables por la persona (buscando
   por documento) y por el admin.
6. No perder nada de lo existente: las 8 reservas y sus comprobantes se migran.

### Fuera de alcance (por ahora)

- Contenido editable por taller (módulos, FAQ, galería, instructor) desde el
  admin — "opción B". El modelo deja el hueco (`contenido` JSON) para añadirlo
  después sin migrar datos.
- Usuarios/roles de admin: sigue una única contraseña (`CERTIFICADOS_PASSWORD`).
- Pasarela de pago automática.
- Envío de emails.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Contenido editable | Opción A (operativo) ahora; campo `contenido` JSON opcional para la B |
| Identidad | `personas.documento` único y normalizado |
| Formularios públicos | Se mantienen Reserva y Registrar pago; ambos exigen documento |
| Privacidad en consultas por documento | Solo documento; datos mostrados **enmascarados**; para corregir un dato se reescribe completo |
| Porcentajes de pago | Configurables por taller entre {25, 50, 75, 100}; 100 siempre incluido |
| Derecho a certificado | 100% pagado **y** asistencia marcada |
| Admin | Panel propio en `/admin`, misma contraseña |
| Modelo | Normalizado: personas / talleres / inscripciones / comprobantes / certificados |

## 3. Modelo de datos

Todo en `public`, RLS activo y sin políticas (solo `service_role`, igual que
hoy). Los nombres de tabla y columna nuevos van en español, coherentes con el
dominio. La migración vive en `supabase/migrations/` y se ejecuta en el SQL
Editor; es idempotente.

### 3.1 `personas`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| documento | text unique null | Normalizado: mayúsculas, sin puntos, espacios ni guiones. Nulo solo en personas migradas sin documento ("por identificar") |
| tipo_documento | text | `CC`, `CE`, `PAS`, `CI`, `OTRO`; por defecto `CC` |
| nombre | text not null | El que se imprime en el certificado |
| email | text not null | |
| telefono | text not null | |
| ciudad | text | |
| profesion | text | |
| creado_en / actualizado_en | timestamptz | |

### 3.2 `talleres` (evolución de `taller_editions`)

Se renombra/extiende `taller_editions` conservando `slug` como clave pública.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid pk | nuevo |
| slug | text unique | se conserva (`taller-2026-10`) |
| titulo / titulo_acento | text | "Anestesia Regional Ecoguiada" / "+ Sedación TCI" |
| modalidad | text | "Taller presencial" |
| estado | enum `taller_estado` | `borrador`, `publicado`, `cerrado`, `finalizado`, `archivado` |
| fecha_inicio / fecha_fin | date | `fecha_fin >= fecha_inicio` |
| fechas_texto | text | "Octubre 24 y 25, 2026" (para página y certificado) |
| sede_nombre, ciudad, region, pais | text | |
| cupos_total | int ≥ 0 | |
| horas | int null | nulo = el certificado no las menciona |
| aval | text null | |
| porcentajes_pago | int[] | subconjunto de {25,50,75,100}, debe contener 100 |
| moneda | text | |
| tarifas | jsonb | `[{id, nombre, precio}]` (precio en unidad menor); vacío = precios no publicados |
| foto_principal | text null | ruta en `/public` o URL |
| firma_nombre, firma_cargo, firma_documento | text | firma del certificado |
| contenido | jsonb null | reservado para la opción B (módulos, FAQ, galería…). Nulo = contenido por defecto del código |
| creado_en / actualizado_en | timestamptz | |

**Restricción de solapamiento** (`btree_gist`):

```sql
exclude using gist (
  daterange(fecha_inicio, fecha_fin, '[]') with &&
) where (estado in ('publicado', 'cerrado'))
```

### 3.3 `inscripciones` (evolución de `reservations`)

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid pk | se conserva el de `reservations` |
| referencia | text unique | se conserva `STA-XXXXXXXX` |
| persona_id | uuid fk personas | |
| taller_id | uuid fk talleres | |
| tarifa_id / tarifa_nombre / monto | | copia de la tarifa al inscribirse |
| porcentaje_pagado | int 0..100 | suma de comprobantes verificados, o ajuste manual del admin |
| cancelada | boolean | libera cupo |
| asistio | boolean | |
| origen | enum `web`, `admin`, `migracion` | |
| notas | text | |
| creado_en / actualizado_en | timestamptz | |

- `unique (persona_id, taller_id)`.
- Estado derivado (no se guarda): `cancelada` › `pagado` (100) › `abonado` (1–99) › `pendiente` (0).
- Ocupan cupo todas las no canceladas.

### 3.4 `comprobantes` (evolución de `payment_proofs`)

Se conservan columnas y archivos del bucket `comprobantes`. Cambios:

- `inscripcion_id` obligatorio (todas las filas actuales ya lo tienen vía `reservation_id`).
- `porcentaje` int: lo que cubre este pago. Filas migradas: `deposit` → 50, `full` → 100.
- `estado`: `pendiente`, `verificado`, `rechazado` (se conserva el enum actual).
- `nota_admin` text, `revisado_en` timestamptz.

Al verificar/rechazar, una función recalcula `inscripciones.porcentaje_pagado =
least(100, sum(porcentaje de verificados))`, salvo que el admin haya fijado un
valor manual (`porcentaje_manual boolean` en la inscripción).

### 3.5 `certificados`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| codigo | text unique | `C-XXXX-XXXX`, alfabeto sin 0/O/1/I/L, aleatorio |
| inscripcion_id | uuid unique fk | uno por inscripción |
| nombre, documento | text | copia de la persona; se actualiza si la persona corrige su nombre/documento |
| curso, fechas_texto, sede, ciudad, region, horas, aval, firma_* | | copia del taller a la fecha de emisión; no cambian |
| emitido_en | timestamptz | |
| revocado_en | timestamptz null | |

**Emisión automática** (trigger en `inscripciones`, y en `talleres` al pasar a
`finalizado`): cuando `porcentaje_pagado = 100 and asistio and not cancelada`
y el taller está `finalizado`, se inserta el certificado si no existe, o se
reactiva (`revocado_en = null`) si estaba revocado. Si deja de cumplirse, se
revoca (nunca se borra).

### 3.6 Funciones (todas `security definer`, ejecutables solo por `service_role`)

- `crear_inscripcion(...)`: con advisory lock por taller (como hoy). Busca o
  crea la persona por documento, valida estado `publicado`, cupo y duplicado.
  Devuelve `ok/reason` (`cerrado`, `sin_cupos`, `ya_inscrito`, …).
- `registrar_comprobante(...)`: exige inscripción activa del documento en el
  taller; valida que el porcentaje sea permitido y no supere el saldo; aplica
  correcciones de datos de la persona; inserta el comprobante.
- `revisar_comprobante(id, estado, nota)`: verifica o rechaza y recalcula.
- `fusionar_personas(origen, destino)`: mueve inscripciones; falla si ambas
  tienen inscripción en el mismo taller.
- Vistas: `talleres_disponibilidad` (taken/remaining/porcentaje) y
  `certificados_vigentes`.

### 3.7 Migración desde el esquema actual

1. Crear tablas nuevas, enums y extensión `btree_gist`.
2. `taller_editions` → `talleres`. La edición `taller-2026-10` se migra con los
   datos de `src/lib/taller.ts` (sede Policlínico San Francisco, Maracaibo,
   Zulia, Venezuela; 24–25 oct 2026; aval; firma; porcentajes {50,100}) en
   estado **`finalizado`**, como taller de prueba para certificados.
3. Cada `reservations` → una `personas` (documento si lo tiene, si no nulo
   "por identificar") + una `inscripciones` con mismo `id` y `referencia`,
   `origen = 'migracion'`, `porcentaje_pagado` según comprobantes verificados
   (hoy 0), `cancelada = status = 'cancelled'`, `asistio = attended`. Las
   reservas con `status = 'confirmed'` se migran con `porcentaje_pagado = 100`
   y `porcentaje_manual = true`.
4. `payment_proofs` → `comprobantes` (mismo `id`, `file_path`, archivo intacto).
5. Las tablas antiguas se renombran a `_legacy_*` y no se borran en esta
   etapa. Las funciones antiguas se eliminan cuando el código ya no las usa.
6. No se deduplican automáticamente los duplicados existentes; se resuelven
   con "fusionar" en el admin.

## 4. Panel de administración (`/admin`)

Misma puerta (`src/lib/admin-auth.ts`); la cookie pasa a cubrir todo `/admin`.
Navegación lateral: Inicio · Talleres · Inscritos · Pagos · Certificados.
Todas las mutaciones son Server Actions que comprueban `isAdmin()`.

- **Inicio**: taller activo, cupos (n/total, %), comprobantes por revisar,
  inscritos con pago incompleto, personas por identificar.
- **Talleres**: lista con estado, fechas y barra de cupos. Crear, editar,
  **duplicar** (copia todo salvo fechas, slug y estado → `borrador`), cambiar
  estado, eliminar (solo sin inscripciones; si tiene, se ofrece archivar). El
  error de solapamiento se traduce a un mensaje claro.
- **Inscritos** (por taller): tabla con documento, nombre, contacto, tarifa,
  % pagado, asistencia, origen; filtro y búsqueda. Inscribir a mano (pide
  documento primero y autocompleta si existe; puede exceder el cupo con aviso).
  Editar ficha de persona. Ajustar % pagado manualmente. Marcar asistencia
  individual y en lote. Cancelar; eliminar solo sin comprobantes verificados.
  Fusionar duplicados.
- **Pagos**: bandeja de comprobantes (filtro por estado y taller) con vista
  previa del archivo mediante URL firmada de corta duración. Verificar /
  Rechazar con nota.
- **Certificados** (por taller): lista con ver/descargar individual, "Imprimir
  todos" (un PDF, una página por certificado) y revocar/reactivar.

## 5. Página pública `/taller`

**Taller activo**: el `publicado` o `cerrado` cuya `fecha_fin >= hoy`; si no
hay, el último `finalizado`; si no hay ninguno, página "Próxima edición pronto"
con WhatsApp. Lógica en una función pura `elegirTallerActivo(talleres, hoy)`.

| | Publicado | Cerrado | Finalizado |
|---|---|---|---|
| Hero / escasez | % real de cupos | "100% de cupos vendidos" | "Edición finalizada" |
| Formulario de reserva | sí | panel agotado + lista de espera | no |
| Registrar pago | sí | no | no |
| Certificados | sí | sí | destacada |

Lo operativo (título, fechas, sede, cupos, precios, porcentajes, foto, aval)
viene de la base. Módulos, highlights, FAQ, galería e instructor vienen de
`src/lib/taller.ts` (que queda como "contenido por defecto"), salvo que
`talleres.contenido` los defina. Se eliminan de `taller.ts` `edition`,
`soldOut`, `scarcity`, `dates`, `venue` y precios.

**Reserva**: documento (obligatorio), nombre (con aviso "así aparecerá en tu
certificado"), email, teléfono, ciudad, profesión. Documento existente →
actualiza la ficha. Ya inscrito en este taller → "Ya tienes una reserva" y
enlace a Registrar pago.

**Registrar pago** (dos pasos):

1. Documento → server action `buscarInscripcion`. Sin inscripción activa en el
   taller: "No encontramos una reserva con ese documento" + enlace a reservar.
2. Con inscripción: datos enmascarados (`Lu** Fer***`, `lu***@gmail.com`,
   `*** *** **12`) con opción "corregir" que pide el valor completo; aviso de
   nombre del certificado; % ya pagado; selector de porcentajes válidos
   (permitidos ≤ saldo, más "saldo restante"); archivo. Al enviar se revalida
   todo en el servidor (el paso 1 no da ningún token de confianza).

**Descarga tu certificado**: campo documento → lista (curso, fechas) con
botón ver/descargar a `/certificado/<codigo>`. Sin resultados → mensaje neutro.

Consultas por documento con límite de frecuencia simple por IP (en memoria del
proceso) para frenar enumeración.

## 6. Certificados

- Hoja: diseño actual de `src/components/certificado/sheet.tsx`, con **nombre y
  documento impresos** sobre sus líneas; ciudad/región, fechas, horas, aval y
  firma desde el certificado (copia), no desde `taller.ts`.
- QR → `${NEXT_PUBLIC_SITE_URL}/certificado/verificar/<codigo>`; el código se
  imprime pequeño junto al QR.
- `/certificado/<codigo>`: hoja + botón "Guardar PDF" (como hoy; reemplaza el
  acceso por referencia; las URLs antiguas por referencia redirigen al código
  si existe).
- `/certificado/verificar/<codigo>`: "Válido" o "Revocado" con nombre,
  documento enmascarado (`CC ****468`), curso, fechas, sede y fecha de emisión;
  "No encontrado" si no existe.

## 7. Errores

- Supabase no disponible: aviso "inténtalo más tarde", nunca página rota (como hoy).
- Toda regla se valida en servidor y en base: solapamiento, inscripción
  duplicada, pago > 100%, porcentaje no permitido, taller no publicado,
  borrado de taller con historial.
- Las funciones devuelven `ok/reason`; el código traduce cada `reason` a un
  mensaje en español.
- Acciones del admin devuelven estado de éxito/error visible.

## 8. Pruebas

- Añadir **Vitest** para lógica pura: `normalizarDocumento`, `enmascarar*`,
  `porcentajesDisponibles`, `elegirTallerActivo`, `vistaSegunEstado`,
  `generarCodigoCertificado`, `estadoPago`.
- Script SQL de pruebas (`supabase/tests/`) para restricciones y funciones,
  a ejecutar sobre un proyecto de prueba, nunca en producción.
- Checklist manual del flujo completo con el taller migrado `taller-2026-10`.

## 9. Entrega por etapas

Un spec, tres planes de implementación:

1. **Datos + admin de talleres**: migración de `taller_editions` → `talleres`
   (3.2 y paso 2 de 3.7), funciones de reserva/pago adaptadas a la tabla
   nueva, admin de talleres (CRUD, estados, duplicar), `/taller` leyendo el
   taller activo. `reservations` y `payment_proofs` no cambian todavía.
2. **Inscripciones y pagos**: migración a `personas` / `inscripciones` /
   `comprobantes` (3.1, 3.3, 3.4, pasos 3–6 de 3.7), formularios con documento
   (reserva y pago en dos pasos), admin de inscritos y pagos. `talleres.id`
   pasa a ser la clave primaria.
3. **Certificados**: tabla `certificados` (3.5), emisión automática, hoja
   personalizada, QR, verificación, descarga pública por documento y desde el
   admin.

Cada etapa deja el sitio funcionando y desplegable.
