# Etapas 2 y 3 — Inscripciones, pagos y certificados: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el número de documento identifique a la persona en toda la plataforma; que la reserva y el registro de pago lo exijan (el pago en dos pasos, con datos enmascarados); que el admin gestione por taller a sus inscritos (pagos, asistencia, cancelar/eliminar, editar ficha, fusionar duplicados, inscribir a mano) y revise comprobantes; y que los certificados se emitan solos con nombre y documento impresos, código propio y QR de verificación, descargables por la persona (buscando por documento) y por el admin.

**Architecture:** Etapa 2: `reservations`/`payment_proofs` se migran (sin perder una fila) a `personas` / `inscripciones` / `comprobantes`, y las antiguas se renombran a `_legacy_*`. Todas las reglas (cupo, duplicado, porcentaje permitido ≤ saldo, recálculo de lo pagado, fusión) viven en funciones SQL `security definer` que devuelven `ok/reason`; `src/lib/inscripciones/` tiene una capa pura (normalizar/enmascarar documento, porcentajes, formularios, filtros) probada con Vitest y un `repo.ts` que es el único que habla con Supabase. Etapa 3: tabla `certificados` con copia de los datos al emitir, mantenida por triggers (emitir/revocar/reactivar, nunca borrar); la hoja actual imprime nombre, documento, código y QR a `/certificado/verificar/<codigo>`. El admin sigue con una sola contraseña y Server Actions que empiezan por `isAdmin()`.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, Route Handlers), React 19.2, TypeScript, Tailwind 4, Supabase (`@supabase/supabase-js` con `service_role`, Storage privado), Postgres 16 (local en Docker para probar), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-gestion-talleres-design.md` (secciones 2, 3.1, 3.3–3.7, 4 «Inscritos», «Pagos», «Certificados», «Inicio», 5, 6, 7, 8, 9 etapas 2 y 3). Plan previo (ya desplegado): `docs/superpowers/plans/2026-10-13-etapa-1-talleres.md`.

### Desviaciones del spec (decididas en este plan)

1. **`talleres` conserva `slug` como clave primaria** (spec 3.2 y 9 dicen que `id` pasa a PK). Las tablas nuevas apuntan a `talleres(id)`, que se convierte de índice único en restricción `UNIQUE` (válida como destino de FK). Cambiar la PK obligaría a reescribir las FK de las tablas `_legacy_*` y no aporta nada: el código nuevo nunca usa el slug como clave.
2. **`fusionar_personas` une las inscripciones del mismo taller** en vez de fallar (spec 3.6). Los duplicados reales de producción son la misma persona dos veces *en el mismo taller*; con la regla del spec la fusión sería inútil justo para ellos. La inscripción del origen se borra tras mover sus comprobantes al destino (asistencia = OR, nota «Fusionada con STA-…»). Se rechaza si la inscripción que desaparecería tiene certificado.
3. **Archivar un taller no revoca sus certificados**: la condición de emisión acepta `finalizado` o `archivado` (spec 3.5 dice solo `finalizado`; con la regla literal, archivar un taller viejo invalidaría todos sus certificados).
4. **Revocación manual persistente** (`certificados.revocado_manual`): la emisión automática no reactiva lo que el admin revocó a mano (spec 4 pide revocar/reactivar sin definir cómo convive con la emisión automática).
5. **El código del certificado se genera en SQL** (lo emite un trigger); en TS solo se normaliza y valida (`normalizarCodigo`). `generarCodigoCertificado` del spec 8 se prueba en `supabase/tests/certificados.sql`, no en Vitest.
6. **`personas.email` y `personas.telefono` admiten nulo**: el admin inscribe a gente que reservó por WhatsApp y a veces no tiene su email. Los formularios públicos los siguen exigiendo.
7. **`comprobantes.estado` conserva el enum `payment_proof_status` (`pending`/`verified`/`rejected`)**; en pantalla se muestran «Por revisar / Verificado / Rechazado».
8. **Reservar con una inscripción cancelada la reactiva** (misma fila y referencia; la regla `unique (persona_id, taller_id)` impide otra). «Ya inscrito» **no** modifica la ficha (evita que alguien que conoce un documento ajeno reescriba los datos de esa persona); la ficha se actualiza solo cuando se crea o reactiva la inscripción.
9. **Las migraciones se aplican con `scripts/migrar.sh`** (psql por el session pooler), no pegando en el SQL Editor. Las funciones y la vista antiguas (`create_reservation`, `register_payment_proof`, `taller_certificates`) se eliminan en una tercera migración mínima, **después** del despliegue de la etapa 3, cuando ningún código desplegado las usa (spec 3.7 paso 5).

## Global Constraints

- Lee `node_modules/next/dist/docs/` antes de usar una API de Next que no aparezca en este plan (AGENTS.md: «This is NOT the Next.js you know»). `params` y `searchParams` son `Promise` y se leen con `await`; `headers()` es `async`; en Route Handlers `ctx.params` es `Promise`.
- **Toda página bajo `src/app/admin/` exporta `export const dynamic = "force-dynamic"`** (lo exige `src/lib/talleres/__tests__/admin-dinamico.test.ts`: CI compila sin `CERTIFICADOS_PASSWORD` y sin esa línea Next congela la página como 404). Las páginas públicas nuevas de certificados también.
- Toda la UI y los mensajes, en español; los comentarios del código en español, explicando el porqué (estilo del repo).
- Supabase solo desde el servidor (`getSupabase()` de `src/lib/reservations/supabase.ts`); nunca claves `NEXT_PUBLIC_` para Supabase. CI compila sin variables de entorno: nada puede crear el cliente en el nivel superior de un módulo.
- Toda Server Action del admin empieza comprobando `await isAdmin()`. Las públicas revalidan todo en el servidor: el paso 1 del pago no da ningún token de confianza.
- Un archivo `"use server"` solo exporta funciones `async` (y tipos). Las constantes van sin `export`.
- Documento: se normaliza igual en TS (`normalizarDocumento`) y en SQL (`public.normalizar_documento`): sin tildes, mayúsculas, solo `[A-Z0-9]`; válido si tiene de 4 a 20 caracteres. Tipos: `CC`, `CE`, `PAS`, `CI`, `OTRO` (por defecto `CC`).
- Porcentajes: un pago es válido si `0 < p ≤ saldo` y `p` está en `talleres.porcentajes_pago` o es exactamente el saldo; `saldo = 100 − min(100, pagado + en revisión)`. `porcentaje_pagado = min(100, Σ verificados)` salvo `porcentaje_manual`.
- Certificado vigente ⇔ `porcentaje_pagado = 100` y `asistio` y no `cancelada` y taller `finalizado`/`archivado` y no revocado a mano. Nunca se borra un certificado.
- «Hoy» del negocio: `America/Caracas` (en código y en SQL).
- Migraciones: idempotentes y dentro de `begin; … commit;`. Las aplica el controlador con `scripts/migrar.sh` (Task 8, Task 14). **Ningún agente escribe en la base de producción ni lee `.env.local`.** Todo SQL se prueba antes en un Postgres 16 desechable con `scripts/probar-migraciones.sh` (Docker; el host no tiene `psql`).
- No se pierde nada: `reservations` y `payment_proofs` se renombran a `_legacy_*`, no se borran; no hay deduplicación automática.
- Sin dependencias nuevas.
- **No hagas `git push` hasta la puerta de despliegue de cada etapa**: un push a `main` despliega (GitHub Actions → Dokploy). El código de la etapa 2 no funciona contra la base sin migrar.

## Review Focus

1. **La migración pierde o mapea mal filas reales** (mismo documento dos veces en el mismo taller, documento que solo está en el comprobante, `confirmed` → 100% manual, comprobante sin reserva) → nada debe perderse ni chocar con `unique (persona_id, taller_id)`. Test: Task 3 (`supabase/tests/migracion_inscripciones.sql` sobre `supabase/tests/semilla_produccion.sql`).
2. **Pagar más del 100% o un porcentaje no permitido** con el paso 2 abierto en dos pestañas o con un POST a mano → la base cuenta lo que está en revisión y rechaza. Tests: Task 1 (`porcentajesDisponibles`, `saldoPendiente`), Task 3 (`inscripciones.sql` casos 6–7).
3. **El paso 1 del pago filtra datos en claro o permite enumerar documentos** → al navegador solo viaja `ConsultaPago` enmascarado y las consultas por documento tienen límite por IP. Tests: Task 4 (`consulta.test.ts` «no deja nada en claro»), Task 2 (`limite.test.ts`).
4. **Fusionar los duplicados reales (mismo taller) falla o pierde pagos/asistencia** → se unen en la inscripción del destino con sus comprobantes y el porcentaje recalculado; se rechaza si borraría un certificado. Tests: Task 3 (`inscripciones.sql` caso 14), Task 10 (`certificados.sql` caso 8).
5. **Certificados revocados o reemitidos mal al cambiar el taller o la persona** (archivar no revoca, la revocación manual se respeta, el código no cambia al reactivar, la corrección del nombre llega al certificado, la copia del taller no cambia). Test: Task 10 (`certificados.sql` casos 2–6).

## Orden de despliegue

**Etapa 2 (hay ventana corta):**
1. Tasks 1–7 terminadas y comiteadas en local, **sin push**. `scripts/probar-migraciones.sh`, `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` en verde.
2. Task 8: el controlador hace backup, corre `scripts/migrar.sh supabase/migrations/20261015_01_inscripciones.sql` (la comprobación previa muestra los talleres: ninguno debe estar `publicado`) y **acto seguido** `git push origin main`.
3. **Ventana** = desde que termina la migración hasta que Dokploy sirve la imagen nueva (≈5–10 min). Durante ella el código viejo (etapa 1) sigue en pie así: `/taller` funciona (lee `talleres` y `talleres_disponibilidad`, que conserva sus columnas); `/certificado/STA-…` y `/admin/certificados` funcionan (la vista `taller_certificates` se rehace sobre las tablas nuevas con las mismas columnas); **editar o eliminar un taller en el admin da error genérico** (cuenta en `reservations`, que ya no existe) — no lo hagas en la ventana. Reservar y registrar pagos fallarían con el aviso de WhatsApp, pero no se puede llegar a esos formularios porque el único taller está `finalizado` (por eso la comprobación previa).

**Etapa 3 (sin ventana):**
1. Tasks 9–13 comiteadas, sin push; mismas verificaciones.
2. Task 14: `scripts/migrar.sh supabase/migrations/20261015_02_certificados.sql` (aditiva: la etapa 2 desplegada sigue funcionando igual), luego `git push origin main`.
3. Con la etapa 3 ya servida: `scripts/migrar.sh supabase/migrations/20261015_03_limpieza.sql` (borra lo antiguo que ya nadie usa). **Pasa siempre la ruta explícita**: sin argumento `migrar.sh` toma la más reciente.

---

## Mapa de archivos

**Nuevos — etapa 2**
- `src/lib/inscripciones/tipos.ts` — tipos y etiquetas del dominio (persona, inscrito, comprobante, estados).
- `src/lib/inscripciones/documento.ts` — normalizar, validar y enmascarar documento, nombre, email y teléfono.
- `src/lib/inscripciones/pagos.ts` — `estadoPago`, `saldoPendiente`, `porcentajesDisponibles`, `porcentajeValido`, `montoDePorcentaje`.
- `src/lib/inscripciones/formulario.ts` — `leerPersonaForm`, `leerCorrecciones`, `esUuid`, `MAX`.
- `src/lib/inscripciones/errores.ts` — `reason` de SQL → motivo → mensaje.
- `src/lib/inscripciones/filtros.ts` — filtro y búsqueda de la lista de inscritos.
- `src/lib/inscripciones/consulta.ts` — respuesta enmascarada del paso 1 del pago.
- `src/lib/inscripciones/mapeo.ts` — filas de vistas SQL → tipos.
- `src/lib/inscripciones/repo.ts` — acceso a Supabase (solo servidor).
- `src/lib/inscripciones/comprobantes.ts` — subida del archivo + `registrar_comprobante`.
- `src/lib/inscripciones/__tests__/{fabrica.ts,documento,pagos,formulario,errores,filtros,consulta,mapeo}.test.ts`.
- `src/lib/limite.ts`, `src/lib/__tests__/limite.test.ts` — límite de frecuencia en memoria.
- `supabase/migrations/20261015_01_inscripciones.sql`.
- `supabase/tests/semilla_produccion.sql`, `supabase/tests/migracion_inscripciones.sql`, `supabase/tests/inscripciones.sql`.
- `supabase/verificaciones/20261013_01_talleres.sql`, `antes_20261015_01_inscripciones.sql`, `20261015_01_inscripciones.sql`.
- `scripts/probar-migraciones.sh`.
- `src/app/admin/inscritos/{page.tsx,actions.ts}`, `src/app/admin/pagos/{page.tsx,actions.ts}`, `src/app/admin/pagos/archivo/[id]/route.ts`.
- `src/components/admin/{mensaje,selector-taller,inscrito-fila,asistencia-lote,inscribir-form,comprobante-revision}.tsx`.

**Modificados — etapa 2**
- `scripts/migrar.sh` (archivo como argumento, verificaciones antes/después).
- `supabase/tests/talleres.sql` (casos 6–8 usan `crear_inscripcion`).
- `src/lib/talleres/{vista,repo,publico}.ts`, `src/lib/talleres/__tests__/vista.test.ts`.
- `src/lib/payments/{types,manual}.ts`, `src/lib/reservations/{types,payment-proofs}.ts`.
- `src/app/taller/actions.ts`, `src/components/taller/{reserva-form,pago-form}.tsx`, `src/lib/taller.ts` (FAQ).
- `src/app/admin/page.tsx`, `src/app/admin/talleres/[id]/page.tsx`, `src/app/admin/certificados/page.tsx` (texto), `src/components/admin/{shell,taller-acciones}.tsx`.

**Eliminados — etapa 2**
- `src/lib/reservations/index.ts`.

**Nuevos — etapa 3**
- `src/lib/certificados/{tipos,codigo,hoja,mapeo,repo}.ts`, `src/lib/certificados/__tests__/{codigo,hoja,mapeo}.test.ts`.
- `supabase/migrations/20261015_02_certificados.sql`, `supabase/migrations/20261015_03_limpieza.sql`.
- `supabase/tests/certificados.sql`, `supabase/verificaciones/{20261015_02_certificados,20261015_03_limpieza}.sql`.
- `src/components/certificado/aviso.tsx`, `src/app/certificado/verificar/[codigo]/page.tsx`.
- `src/components/taller/certificados.tsx`.
- `src/app/admin/certificados/actions.ts`, `src/components/admin/certificado-fila.tsx`.

**Modificados — etapa 3**
- `src/components/certificado/sheet.tsx`, `src/app/certificado/[code]/page.tsx`.
- `src/app/admin/certificados/page.tsx`, `src/app/admin/certificados/imprimir/page.tsx`.
- `src/app/taller/{actions.ts,page.tsx}`, `src/components/taller/{nav,footer}.tsx`, `src/lib/taller.ts` (FAQ).
- `src/lib/inscripciones/mapeo.ts` (columnas del certificado), `src/app/admin/inscritos/page.tsx`, `src/app/admin/talleres/[id]/page.tsx`, `src/lib/talleres/publico.ts`.

**Eliminados — etapa 3**
- `src/lib/reservations/certificates.ts`.

---

# ETAPA 2 — Personas, inscripciones y pagos

### Task 1: Dominio puro — documento y pagos

**Files:**
- Create: `src/lib/inscripciones/tipos.ts`, `src/lib/inscripciones/documento.ts`, `src/lib/inscripciones/pagos.ts`
- Test: `src/lib/inscripciones/__tests__/documento.test.ts`, `src/lib/inscripciones/__tests__/pagos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (`tipos.ts`): `TIPOS_DOCUMENTO`, `TipoDocumento`, `TIPO_DOCUMENTO_ETIQUETA`, `Origen`, `ORIGEN_ETIQUETA`, `ESTADOS_COMPROBANTE`, `EstadoComprobante`, `ESTADO_COMPROBANTE_ETIQUETA`, `EstadoPago`, `ESTADO_PAGO_ETIQUETA`, `Persona`, `DatosPersona`, `Inscrito`, `ComprobanteAdmin`.
- Produces (`documento.ts`): `normalizarDocumento(texto: string): string`, `documentoValido(normalizado: string): boolean`, `enmascararNombre(nombre: string): string`, `enmascararEmail(email: string | null): string`, `enmascararTelefono(telefono: string | null): string`, `enmascararDocumento(tipo: TipoDocumento, documento: string | null): string`.
- Produces (`pagos.ts`): `estadoPago(i: { cancelada: boolean; porcentajePagado: number }): EstadoPago`, `saldoPendiente(pagado: number, enRevision: number): number`, `OpcionPago = { porcentaje: number; etiqueta: string }`, `porcentajesDisponibles(permitidos: readonly number[], pagado: number, enRevision: number): OpcionPago[]`, `porcentajeValido(p: number, permitidos: readonly number[], pagado: number, enRevision: number): boolean`, `montoDePorcentaje(monto: number, porcentaje: number): number`.

- [ ] **Step 1: Crear los tipos**

`src/lib/inscripciones/tipos.ts`:

```ts
/**
 * Tipos del dominio de inscripciones: personas, inscripciones y comprobantes.
 * No importan nada de Supabase ni de React: los usan por igual el servidor, el
 * admin, los formularios del navegador y las pruebas.
 */

export const TIPOS_DOCUMENTO = ["CC", "CE", "PAS", "CI", "OTRO"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPO_DOCUMENTO_ETIQUETA: Record<TipoDocumento, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  PAS: "Pasaporte",
  CI: "Cédula de identidad",
  OTRO: "Otro",
};

export type Origen = "web" | "admin" | "migracion";

export const ORIGEN_ETIQUETA: Record<Origen, string> = {
  web: "Web",
  admin: "Admin",
  migracion: "Migración",
};

/**
 * Valores del enum `payment_proof_status`. Se conserva el de la etapa
 * anterior para no reescribir las filas migradas; en pantalla van en español.
 */
export const ESTADOS_COMPROBANTE = ["pending", "verified", "rejected"] as const;
export type EstadoComprobante = (typeof ESTADOS_COMPROBANTE)[number];

export const ESTADO_COMPROBANTE_ETIQUETA: Record<EstadoComprobante, string> = {
  pending: "Por revisar",
  verified: "Verificado",
  rejected: "Rechazado",
};

/** Derivado, nunca se guarda: cancelada › pagado (100) › abonado (1–99) › pendiente (0). */
export type EstadoPago = "cancelada" | "pagado" | "abonado" | "pendiente";

export const ESTADO_PAGO_ETIQUETA: Record<EstadoPago, string> = {
  cancelada: "Cancelada",
  pagado: "Pagado",
  abonado: "Abonado",
  pendiente: "Pendiente",
};

export type Persona = {
  id: string;
  /** Normalizado. `null` = persona migrada «por identificar». */
  documento: string | null;
  tipoDocumento: TipoDocumento;
  /** El que se imprime en el certificado. */
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  profesion: string | null;
};

/** Lo que escriben el formulario público o el admin: aquí el documento es obligatorio. */
export type DatosPersona = Omit<Persona, "id" | "documento"> & { documento: string };

export type Inscrito = {
  id: string;
  referencia: string;
  tallerId: string;
  persona: Persona;
  tarifaNombre: string;
  monto: number | null;
  moneda: string | null;
  porcentajePagado: number;
  /** El admin fijó el porcentaje a mano: verificar comprobantes no lo cambia. */
  porcentajeManual: boolean;
  /** Suma de los comprobantes por revisar. */
  porcentajeEnRevision: number;
  comprobantesVerificados: number;
  cancelada: boolean;
  asistio: boolean;
  origen: Origen;
  notas: string;
  creadoEn: string;
  /** Llega con la etapa 3; mientras tanto siempre `null`. */
  certificado: { codigo: string; revocado: boolean } | null;
};

/** Una fila de la bandeja de pagos del admin. La ruta del archivo no viaja al navegador. */
export type ComprobanteAdmin = {
  id: string;
  inscripcionId: string;
  referencia: string;
  tallerId: string;
  tallerNombre: string;
  personaNombre: string;
  personaDocumento: string | null;
  personaTipoDocumento: TipoDocumento;
  porcentaje: number;
  estado: EstadoComprobante;
  notas: string;
  notaAdmin: string | null;
  fileType: string;
  fileSize: number;
  creadoEn: string;
  revisadoEn: string | null;
  porcentajePagado: number;
  porcentajeManual: boolean;
};
```

- [ ] **Step 2: Escribir las pruebas (fallan)**

`src/lib/inscripciones/__tests__/documento.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  documentoValido,
  enmascararDocumento,
  enmascararEmail,
  enmascararNombre,
  enmascararTelefono,
  normalizarDocumento,
} from "../documento";

describe("normalizarDocumento", () => {
  it("quita puntos, espacios y guiones y pasa a mayúsculas", () => {
    expect(normalizarDocumento(" 1.136.882.468 ")).toBe("1136882468");
    expect(normalizarDocumento("v-20.111.222")).toBe("V20111222");
    expect(normalizarDocumento("AB 12-34")).toBe("AB1234");
  });

  it("quita tildes igual que public.normalizar_documento", () => {
    expect(normalizarDocumento("ñá-123")).toBe("NA123");
  });

  it("sin letras ni números queda vacío", () => {
    expect(normalizarDocumento("  ..  ")).toBe("");
  });
});

describe("documentoValido", () => {
  it("de 4 a 20 letras o números, ya normalizado", () => {
    expect(documentoValido("1234")).toBe(true);
    expect(documentoValido("V20111222")).toBe(true);
    expect(documentoValido("123")).toBe(false);
    expect(documentoValido("A".repeat(21))).toBe(false);
    expect(documentoValido("12.34")).toBe(false);
  });
});

describe("enmascarar", () => {
  it("nombre: deja ver el principio de cada palabra", () => {
    expect(enmascararNombre("Luis Fernando")).toBe("Lu** Fer*****");
    expect(enmascararNombre("  Ana   Li ")).toBe("A** L*");
  });

  it("email: una o dos letras y el dominio", () => {
    expect(enmascararEmail("luis.fer@gmail.com")).toBe("lu***@gmail.com");
    expect(enmascararEmail("a@x.co")).toBe("a***@x.co");
    expect(enmascararEmail(null)).toBe("");
  });

  it("teléfono: solo los dos últimos dígitos", () => {
    expect(enmascararTelefono("+57 300 123 4512")).toBe("*** *** **12");
    expect(enmascararTelefono(null)).toBe("");
  });

  it("documento: tipo y los tres últimos", () => {
    expect(enmascararDocumento("CC", "1136882468")).toBe("CC ****468");
    expect(enmascararDocumento("CC", null)).toBe("Por identificar");
  });
});
```

`src/lib/inscripciones/__tests__/pagos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  estadoPago,
  montoDePorcentaje,
  porcentajesDisponibles,
  porcentajeValido,
  saldoPendiente,
} from "../pagos";

describe("estadoPago", () => {
  it("cancelada manda sobre lo pagado", () => {
    expect(estadoPago({ cancelada: true, porcentajePagado: 100 })).toBe("cancelada");
  });
  it("100 pagado, 1–99 abonado, 0 pendiente", () => {
    expect(estadoPago({ cancelada: false, porcentajePagado: 100 })).toBe("pagado");
    expect(estadoPago({ cancelada: false, porcentajePagado: 50 })).toBe("abonado");
    expect(estadoPago({ cancelada: false, porcentajePagado: 0 })).toBe("pendiente");
  });
});

describe("saldoPendiente", () => {
  it("cuenta lo que está en revisión y nunca baja de 0", () => {
    expect(saldoPendiente(0, 0)).toBe(100);
    expect(saldoPendiente(50, 25)).toBe(25);
    expect(saldoPendiente(80, 50)).toBe(0);
  });
});

describe("porcentajesDisponibles", () => {
  it("sin pagos: los permitidos", () => {
    expect(porcentajesDisponibles([50, 100], 0, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Abono del 50%" },
      { porcentaje: 100, etiqueta: "Pago completo (100%)" },
    ]);
  });

  it("con la mitad pagada: solo el saldo", () => {
    expect(porcentajesDisponibles([50, 100], 50, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Saldo restante (50%)" },
    ]);
  });

  it("taller que solo acepta el 100%", () => {
    expect(porcentajesDisponibles([100], 0, 0)).toEqual([
      { porcentaje: 100, etiqueta: "Pago completo (100%)" },
    ]);
  });

  it("saldo que no está entre los permitidos se ofrece igual", () => {
    expect(porcentajesDisponibles([50, 100], 25, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Abono del 50%" },
      { porcentaje: 75, etiqueta: "Saldo restante (75%)" },
    ]);
  });

  it("lo que está en revisión reduce el saldo", () => {
    expect(porcentajesDisponibles([25, 50, 75, 100], 0, 50)).toEqual([
      { porcentaje: 25, etiqueta: "Abono del 25%" },
      { porcentaje: 50, etiqueta: "Saldo restante (50%)" },
    ]);
  });

  it("sin saldo no hay opciones", () => {
    expect(porcentajesDisponibles([50, 100], 100, 0)).toEqual([]);
    expect(porcentajesDisponibles([50, 100], 60, 50)).toEqual([]);
  });
});

describe("porcentajeValido", () => {
  it("solo lo que se ofrece", () => {
    expect(porcentajeValido(50, [50, 100], 50, 0)).toBe(true);
    expect(porcentajeValido(100, [50, 100], 50, 0)).toBe(false);
    expect(porcentajeValido(25, [50, 100], 0, 0)).toBe(false);
  });
});

describe("montoDePorcentaje", () => {
  it("redondea a la unidad", () => {
    expect(montoDePorcentaje(350000, 50)).toBe(175000);
    expect(montoDePorcentaje(100001, 25)).toBe(25000);
  });
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

Run: `npx vitest run src/lib/inscripciones`
Expected: FAIL — `Failed to resolve import "../documento"` y `"../pagos"`.

- [ ] **Step 4: Implementar `documento.ts`**

`src/lib/inscripciones/documento.ts`:

```ts
import type { TipoDocumento } from "./tipos";

/** Marcas que NFD separa de su letra (tildes, virgulilla de la ñ, diéresis…). */
const DIACRITICOS = /[̀-ͯ]/g;

/**
 * Forma única del documento: sin tildes, en mayúsculas y solo letras y
 * números. "1.136.882.468", "1136 882 468" y "1136-882-468" son la misma
 * persona. Tiene que dar lo mismo que `public.normalizar_documento` en SQL:
 * la base busca y compara con esa función.
 */
export function normalizarDocumento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Validación laxa a propósito: conviven cédulas colombianas y venezolanas,
 * pasaportes y documentos de otros países. Igual que la restricción de
 * `personas.documento`.
 */
export function documentoValido(normalizado: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(normalizado);
}

const estrellas = (n: number) => "*".repeat(Math.max(0, n));

/**
 * "Luis Fernando" → "Lu** Fer*****". Lo justo para que la persona se reconozca,
 * no para que un extraño copie el dato.
 */
export function enmascararNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => {
      const letras = [...palabra];
      const visibles = letras.length <= 2 ? 1 : Math.min(3, Math.floor(letras.length / 2));
      return letras.slice(0, visibles).join("") + estrellas(letras.length - visibles);
    })
    .join(" ");
}

/** "luis.fer@gmail.com" → "lu***@gmail.com". El dominio ayuda a reconocerlo y no identifica a nadie. */
export function enmascararEmail(email: string | null): string {
  if (!email) return "";
  const [local, dominio] = email.trim().split("@");
  if (!dominio) return "***";
  const visibles = [...local].slice(0, local.length > 2 ? 2 : 1).join("");
  return `${visibles}***@${dominio}`;
}

/** "+57 300 123 4512" → "*** *** **12". */
export function enmascararTelefono(telefono: string | null): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length < 4) return "***";
  return `*** *** **${digitos.slice(-2)}`;
}

/** "CC ****468", para la página de verificación del certificado. */
export function enmascararDocumento(tipo: TipoDocumento, documento: string | null): string {
  if (!documento) return "Por identificar";
  return `${tipo} ****${documento.slice(-3)}`;
}
```

- [ ] **Step 5: Implementar `pagos.ts`**

`src/lib/inscripciones/pagos.ts`:

```ts
import type { EstadoPago } from "./tipos";

export function estadoPago(i: { cancelada: boolean; porcentajePagado: number }): EstadoPago {
  if (i.cancelada) return "cancelada";
  if (i.porcentajePagado >= 100) return "pagado";
  if (i.porcentajePagado > 0) return "abonado";
  return "pendiente";
}

/**
 * Lo que falta por cubrir. Cuenta también lo que está en revisión: si no, dos
 * comprobantes del 100% subidos antes de que el admin revise sumarían 200%.
 * Es la misma cuenta que hace `registrar_comprobante` en la base.
 */
export function saldoPendiente(pagado: number, enRevision: number): number {
  return Math.max(0, 100 - Math.min(100, pagado + enRevision));
}

export type OpcionPago = { porcentaje: number; etiqueta: string };

function etiqueta(p: number, saldo: number) {
  if (p === 100) return "Pago completo (100%)";
  if (p === saldo) return `Saldo restante (${p}%)`;
  return `Abono del ${p}%`;
}

/**
 * Lo que se puede pagar ahora: los porcentajes del taller que caben en el
 * saldo, más el saldo exacto (para quien abonó 25% en un taller de {50, 100}).
 */
export function porcentajesDisponibles(
  permitidos: readonly number[],
  pagado: number,
  enRevision: number,
): OpcionPago[] {
  const saldo = saldoPendiente(pagado, enRevision);
  if (saldo === 0) return [];
  const valores = [...new Set([...permitidos.filter((p) => p > 0 && p <= saldo), saldo])].sort(
    (a, b) => a - b,
  );
  return valores.map((p) => ({ porcentaje: p, etiqueta: etiqueta(p, saldo) }));
}

export function porcentajeValido(
  p: number,
  permitidos: readonly number[],
  pagado: number,
  enRevision: number,
): boolean {
  return porcentajesDisponibles(permitidos, pagado, enRevision).some((o) => o.porcentaje === p);
}

/** Importe que corresponde a un porcentaje de la tarifa (COP no usa decimales). */
export function montoDePorcentaje(monto: number, porcentaje: number): number {
  return Math.round((monto * porcentaje) / 100);
}
```

- [ ] **Step 6: Ejecutar y ver que pasan**

Run: `npx vitest run src/lib/inscripciones`
Expected: PASS — 2 archivos, todas las pruebas en verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/inscripciones
git commit -m "feat(inscripciones): tipos, documento enmascarado y porcentajes de pago

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Formularios, errores, filtros y límite de frecuencia

**Files:**
- Create: `src/lib/inscripciones/formulario.ts`, `src/lib/inscripciones/errores.ts`, `src/lib/inscripciones/filtros.ts`, `src/lib/limite.ts`, `src/lib/inscripciones/__tests__/fabrica.ts`
- Test: `src/lib/inscripciones/__tests__/formulario.test.ts`, `errores.test.ts`, `filtros.test.ts`, `src/lib/__tests__/limite.test.ts`

**Interfaces:**
- Consumes (Task 1): `normalizarDocumento`, `documentoValido`, `estadoPago`, `TIPOS_DOCUMENTO`, `DatosPersona`, `TipoDocumento`, `Inscrito`, `Persona`.
- Produces (`formulario.ts`): `MAX`, `esUuid(v: string): boolean`, `LecturaPersona = { ok: true; datos: DatosPersona; notas: string } | { ok: false; errores: Record<string, string> }`, `leerPersonaForm(fd: FormData, modo: "publico" | "admin"): LecturaPersona`, `Correcciones = { nombre: string | null; email: string | null; telefono: string | null }`, `leerCorrecciones(fd: FormData, errores: Record<string, string>): Correcciones`.
- Produces (`errores.ts`): `MotivoInscripcion`, `motivoDesdeReason(reason: string | null | undefined): MotivoInscripcion`, `motivoDesdeErrorPg(error: { code?: string } | null | undefined): MotivoInscripcion`, `MENSAJES_INSCRIPCION: Record<MotivoInscripcion, string>`.
- Produces (`filtros.ts`): `FILTROS_ESTADO`, `FiltroEstado`, `FILTRO_ETIQUETA`, `FiltroInscritos = { q: string; estado: FiltroEstado }`, `leerFiltro(sp: { q?: string | string[]; estado?: string | string[] }): FiltroInscritos`, `filtrarInscritos(lista: readonly Inscrito[], f: FiltroInscritos): Inscrito[]`.
- Produces (`limite.ts`): `Limitador = { permitir(clave: string, ahora?: number): boolean }`, `crearLimitador(o: { max: number; ventanaMs: number }): Limitador`, `ipDeCabeceras(h: Pick<Headers, "get">): string`.
- Produces (`__tests__/fabrica.ts`): `personaDePrueba(p?: Partial<Persona>): Persona`, `inscritoDePrueba(p?: Partial<Omit<Inscrito, "persona">> & { persona?: Partial<Persona> }): Inscrito`.

- [ ] **Step 1: Fábrica de pruebas**

`src/lib/inscripciones/__tests__/fabrica.ts`:

```ts
import type { Inscrito, Persona } from "../tipos";

export function personaDePrueba(p: Partial<Persona> = {}): Persona {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    documento: "1136882468",
    tipoDocumento: "CC",
    nombre: "José Pérez",
    email: "jose@example.com",
    telefono: "+57 300 000 0012",
    ciudad: "Maracaibo",
    profesion: "Anestesiólogo",
    ...p,
  };
}

export function inscritoDePrueba(
  p: Partial<Omit<Inscrito, "persona">> & { persona?: Partial<Persona> } = {},
): Inscrito {
  const { persona, ...resto } = p;
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    referencia: "STA-AAAA1111",
    tallerId: "00000000-0000-0000-0000-000000000001",
    persona: personaDePrueba(persona),
    tarifaNombre: "Cupo General",
    monto: null,
    moneda: null,
    porcentajePagado: 0,
    porcentajeManual: false,
    porcentajeEnRevision: 0,
    comprobantesVerificados: 0,
    cancelada: false,
    asistio: false,
    origen: "web",
    notas: "",
    creadoEn: "2026-10-01T10:00:00Z",
    certificado: null,
    ...resto,
  };
}
```

- [ ] **Step 2: Escribir las pruebas (fallan)**

`src/lib/inscripciones/__tests__/formulario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { esUuid, leerCorrecciones, leerPersonaForm } from "../formulario";

function fd(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

const completo = {
  documento: "1.136.882.468",
  tipo_documento: "CC",
  nombre: "  Ana   María  ",
  email: "ana@example.com",
  telefono: "+57 300 111 2233",
  ciudad: "Maracaibo",
  profesion: "Anestesióloga",
  notas: "Factura a la clínica",
};

describe("leerPersonaForm", () => {
  it("público completo: normaliza documento y espacios del nombre", () => {
    expect(leerPersonaForm(fd(completo), "publico")).toEqual({
      ok: true,
      notas: "Factura a la clínica",
      datos: {
        documento: "1136882468",
        tipoDocumento: "CC",
        nombre: "Ana María",
        email: "ana@example.com",
        telefono: "+57 300 111 2233",
        ciudad: "Maracaibo",
        profesion: "Anestesióloga",
      },
    });
  });

  it("público exige email, teléfono, ciudad y profesión", () => {
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez" }), "publico");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["ciudad", "email", "profesion", "telefono"]);
  });

  it("admin acepta solo documento y nombre (reservas por WhatsApp)", () => {
    const r = leerPersonaForm(fd({ documento: "V-20.111.222", tipo_documento: "CI", nombre: "Ana Pérez" }), "admin");
    expect(r).toEqual({
      ok: true,
      notas: "",
      datos: {
        documento: "V20111222",
        tipoDocumento: "CI",
        nombre: "Ana Pérez",
        email: null,
        telefono: null,
        ciudad: null,
        profesion: null,
      },
    });
  });

  it("admin valida el email si lo trae", () => {
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez", email: "no-es-email" }), "admin");
    expect(r.ok === false && r.errores.email).toBeTruthy();
  });

  it("documento demasiado corto", () => {
    const r = leerPersonaForm(fd({ ...completo, documento: "1.2" }), "publico");
    expect(r.ok === false && r.errores.documento).toBeTruthy();
  });

  it("tipo de documento desconocido cae a CC", () => {
    const r = leerPersonaForm(fd({ ...completo, tipo_documento: "XX" }), "publico");
    expect(r.ok && r.datos.tipoDocumento).toBe("CC");
  });
});

describe("leerCorrecciones", () => {
  it("vacío = sin cambios", () => {
    const errores: Record<string, string> = {};
    expect(leerCorrecciones(fd({}), errores)).toEqual({ nombre: null, email: null, telefono: null });
    expect(errores).toEqual({});
  });

  it("valida lo que se reescribe", () => {
    const errores: Record<string, string> = {};
    const r = leerCorrecciones(fd({ nombre: "Lu", email: "luis@example.com" }), errores);
    expect(r.email).toBe("luis@example.com");
    expect(Object.keys(errores)).toEqual(["nombre"]);
  });
});

describe("esUuid", () => {
  it("solo uuids", () => {
    expect(esUuid("10000000-0000-0000-0000-000000000001")).toBe(true);
    expect(esUuid("x")).toBe(false);
    expect(esUuid("10000000-0000-0000-0000-00000000000Z")).toBe(false);
  });
});
```

`src/lib/inscripciones/__tests__/errores.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MENSAJES_INSCRIPCION, motivoDesdeErrorPg, motivoDesdeReason } from "../errores";

describe("motivoDesdeReason", () => {
  it("reconoce los reason de las funciones SQL", () => {
    expect(motivoDesdeReason("sin_cupos")).toBe("sin_cupos");
    expect(motivoDesdeReason("porcentaje_no_permitido")).toBe("porcentaje_no_permitido");
    expect(motivoDesdeReason("tiene_certificado")).toBe("tiene_certificado");
  });

  it("lo desconocido es un error genérico", () => {
    expect(motivoDesdeReason("algo_raro")).toBe("error");
    expect(motivoDesdeReason(null)).toBe("error");
  });
});

describe("motivoDesdeErrorPg", () => {
  it("documento repetido y id mal formado", () => {
    expect(motivoDesdeErrorPg({ code: "23505" })).toBe("documento_duplicado");
    expect(motivoDesdeErrorPg({ code: "22P02" })).toBe("no_encontrado");
    expect(motivoDesdeErrorPg(null)).toBe("error");
  });
});

describe("MENSAJES_INSCRIPCION", () => {
  it("todo motivo tiene mensaje", () => {
    for (const m of Object.values(MENSAJES_INSCRIPCION)) expect(m.length).toBeGreaterThan(10);
  });
});
```

`src/lib/inscripciones/__tests__/filtros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filtrarInscritos, leerFiltro } from "../filtros";
import { inscritoDePrueba } from "./fabrica";

const jose = inscritoDePrueba();
const ana = inscritoDePrueba({
  id: "b2",
  referencia: "STA-BBBB2222",
  porcentajePagado: 100,
  persona: { id: "a2", nombre: "Ana Gómez", documento: "V20111222", email: "ana@example.com" },
});
const sinDoc = inscritoDePrueba({
  id: "b3",
  referencia: "STA-CCCC3333",
  porcentajePagado: 50,
  persona: { id: "a3", nombre: "Luis Díaz", documento: null, email: null },
});
const cancelada = inscritoDePrueba({
  id: "b4",
  referencia: "STA-DDDD4444",
  cancelada: true,
  persona: { id: "a4", nombre: "Carla Ruiz", documento: "987654", email: "carla@example.com" },
});
const todos = [jose, ana, sinDoc, cancelada];

describe("filtrarInscritos", () => {
  it("busca por nombre sin importar tildes ni mayúsculas", () => {
    expect(filtrarInscritos(todos, { q: "jose", estado: "todos" })).toEqual([jose]);
    expect(filtrarInscritos(todos, { q: "DÍAZ", estado: "todos" })).toEqual([sinDoc]);
  });

  it("busca por documento aunque lo escriban con puntos", () => {
    expect(filtrarInscritos(todos, { q: "1.136.882", estado: "todos" })).toEqual([jose]);
  });

  it("busca por referencia y por email", () => {
    expect(filtrarInscritos(todos, { q: "sta-bbbb2222", estado: "todos" })).toEqual([ana]);
    expect(filtrarInscritos(todos, { q: "ana@", estado: "todos" })).toEqual([ana]);
  });

  it("filtra por estado de pago y por identificar", () => {
    expect(filtrarInscritos(todos, { q: "", estado: "pagado" })).toEqual([ana]);
    expect(filtrarInscritos(todos, { q: "", estado: "abonado" })).toEqual([sinDoc]);
    expect(filtrarInscritos(todos, { q: "", estado: "cancelada" })).toEqual([cancelada]);
    expect(filtrarInscritos(todos, { q: "", estado: "sin_documento" })).toEqual([sinDoc]);
  });
});

describe("leerFiltro", () => {
  it("estado desconocido = todos; arrays toman el primero", () => {
    expect(leerFiltro({ q: ["  ana ", "x"], estado: "raro" })).toEqual({ q: "ana", estado: "todos" });
    expect(leerFiltro({})).toEqual({ q: "", estado: "todos" });
  });
});
```

`src/lib/__tests__/limite.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { crearLimitador, ipDeCabeceras } from "../limite";

describe("crearLimitador", () => {
  it("deja pasar max por ventana y por clave", () => {
    const l = crearLimitador({ max: 2, ventanaMs: 1000 });
    expect(l.permitir("a", 0)).toBe(true);
    expect(l.permitir("a", 1)).toBe(true);
    expect(l.permitir("a", 2)).toBe(false);
    expect(l.permitir("b", 2)).toBe(true);
  });

  it("al pasar la ventana vuelve a dejar pasar", () => {
    const l = crearLimitador({ max: 2, ventanaMs: 1000 });
    l.permitir("a", 0);
    l.permitir("a", 1);
    expect(l.permitir("a", 999)).toBe(false);
    expect(l.permitir("a", 1001)).toBe(true);
  });
});

describe("ipDeCabeceras", () => {
  it("primera IP de x-forwarded-for, luego x-real-ip", () => {
    expect(ipDeCabeceras(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(ipDeCabeceras(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipDeCabeceras(new Headers())).toBe("desconocida");
  });
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

Run: `npx vitest run src/lib/inscripciones src/lib/__tests__`
Expected: FAIL — no se resuelven `../formulario`, `../errores`, `../filtros`, `../limite`.

- [ ] **Step 4: Implementar `formulario.ts`**

`src/lib/inscripciones/formulario.ts`:

```ts
import { documentoValido, normalizarDocumento } from "./documento";
import { TIPOS_DOCUMENTO, type DatosPersona, type TipoDocumento } from "./tipos";

/** Límites de longitud: los mismos `maxLength` que llevan los formularios. */
export const MAX = {
  nombre: 120,
  documento: 30,
  email: 160,
  telefono: 40,
  ciudad: 80,
  profesion: 120,
  notas: 800,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los ids llegan de formularios y URLs: uno mal formado haría fallar a Postgres con 22P02. */
export function esUuid(v: string): boolean {
  return UUID.test(v);
}

function texto(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function validarNombre(nombre: string, errores: Record<string, string>) {
  if (nombre.length < 3) errores.nombre = "Escribe el nombre completo.";
  else if (nombre.length > MAX.nombre) errores.nombre = "Nombre demasiado largo.";
}

// Validación deliberadamente laxa: rechazar direcciones raras pero válidas es
// peor que dejar pasar una errata, porque cada pago se confirma a mano.
function validarEmail(email: string, errores: Record<string, string>) {
  if (!EMAIL.test(email) || email.length > MAX.email) errores.email = "Escribe un email válido.";
}

function validarTelefono(telefono: string, errores: Record<string, string>) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7 || digitos.length > 15 || telefono.length > MAX.telefono)
    errores.telefono = "Escribe un teléfono válido con indicativo.";
}

export type LecturaPersona =
  | { ok: true; datos: DatosPersona; notas: string }
  | { ok: false; errores: Record<string, string> };

/**
 * Lee la ficha de una persona.
 *
 * - `publico`: el formulario de reserva; todo es obligatorio salvo las notas.
 * - `admin`: inscribir a mano o editar la ficha; basta documento y nombre,
 *   porque de quien apartó cupo por WhatsApp a veces solo se sabe eso.
 */
export function leerPersonaForm(fd: FormData, modo: "publico" | "admin"): LecturaPersona {
  const errores: Record<string, string> = {};

  const crudo = texto(fd, "documento");
  const documento = normalizarDocumento(crudo);
  if (crudo.length > MAX.documento || !documentoValido(documento))
    errores.documento = "Escribe el número de documento (cédula o pasaporte).";

  const tipo = texto(fd, "tipo_documento").toUpperCase();
  const tipoDocumento: TipoDocumento = (TIPOS_DOCUMENTO as readonly string[]).includes(tipo)
    ? (tipo as TipoDocumento)
    : "CC";

  const nombre = texto(fd, "nombre").replace(/\s+/g, " ");
  const email = texto(fd, "email");
  const telefono = texto(fd, "telefono");
  const ciudad = texto(fd, "ciudad");
  const profesion = texto(fd, "profesion");
  const notas = texto(fd, "notas");

  validarNombre(nombre, errores);
  if (modo === "publico" || email) validarEmail(email, errores);
  if (modo === "publico" || telefono) validarTelefono(telefono, errores);

  if (modo === "publico" && ciudad.length < 2) errores.ciudad = "Indica tu ciudad.";
  else if (ciudad.length > MAX.ciudad) errores.ciudad = "Ciudad demasiado larga.";

  if (modo === "publico" && profesion.length < 2) errores.profesion = "Indica tu profesión o especialidad.";
  else if (profesion.length > MAX.profesion) errores.profesion = "Texto demasiado largo.";

  if (notas.length > MAX.notas) errores.notas = "El mensaje supera los 800 caracteres.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    notas,
    datos: {
      documento,
      tipoDocumento,
      nombre,
      email: email || null,
      telefono: telefono || null,
      ciudad: ciudad || null,
      profesion: profesion || null,
    },
  };
}

export type Correcciones = { nombre: string | null; email: string | null; telefono: string | null };

/**
 * Paso 2 del pago: la persona ve sus datos enmascarados y solo corrige el que
 * reescribe completo. Un campo vacío significa «está bien así».
 */
export function leerCorrecciones(fd: FormData, errores: Record<string, string>): Correcciones {
  const nombre = texto(fd, "nombre").replace(/\s+/g, " ");
  const email = texto(fd, "email");
  const telefono = texto(fd, "telefono");
  if (nombre) validarNombre(nombre, errores);
  if (email) validarEmail(email, errores);
  if (telefono) validarTelefono(telefono, errores);
  return { nombre: nombre || null, email: email || null, telefono: telefono || null };
}
```

- [ ] **Step 5: Implementar `errores.ts`**

`src/lib/inscripciones/errores.ts`:

```ts
/**
 * Las funciones SQL de inscripciones devuelven `ok/reason` en vez de lanzar
 * excepciones. Aquí cada `reason` recibe nombre y mensaje en español.
 */

export type MotivoInscripcion =
  | "sin_conexion"
  | "taller_desconocido"
  | "cerrado"
  | "sin_cupos"
  | "ya_inscrito"
  | "documento_invalido"
  | "sin_inscripcion"
  | "porcentaje_no_permitido"
  | "sin_saldo"
  | "no_encontrado"
  | "tiene_pagos_verificados"
  | "tiene_certificado"
  | "misma_persona"
  | "documento_duplicado"
  | "limite"
  | "error";

/** Los que pueden llegar como `reason` desde la base. */
const DE_LA_BASE: readonly MotivoInscripcion[] = [
  "taller_desconocido",
  "cerrado",
  "sin_cupos",
  "ya_inscrito",
  "documento_invalido",
  "sin_inscripcion",
  "porcentaje_no_permitido",
  "sin_saldo",
  "no_encontrado",
  "tiene_pagos_verificados",
  "tiene_certificado",
  "misma_persona",
];

export function motivoDesdeReason(reason: string | null | undefined): MotivoInscripcion {
  return DE_LA_BASE.includes(reason as MotivoInscripcion) ? (reason as MotivoInscripcion) : "error";
}

/** Errores de Postgres en escrituras directas (editar la ficha, marcar asistencia…). */
export function motivoDesdeErrorPg(error: { code?: string } | null | undefined): MotivoInscripcion {
  if (error?.code === "23505") return "documento_duplicado"; // unique_violation de personas.documento
  if (error?.code === "22P02") return "no_encontrado"; // id que no es uuid
  return "error";
}

export const MENSAJES_INSCRIPCION: Record<MotivoInscripcion, string> = {
  sin_conexion:
    "No pudimos conectar con el sistema de inscripciones. Inténtalo en unos minutos o escríbenos por WhatsApp.",
  taller_desconocido: "No encontramos ese taller. Recarga la página.",
  cerrado: "Las inscripciones y pagos de esta edición están cerrados.",
  sin_cupos: "Los cupos de esta edición se agotaron.",
  ya_inscrito: "Ya hay una reserva en este taller con ese documento.",
  documento_invalido: "Escribe un número de documento válido (de 4 a 20 letras o números).",
  sin_inscripcion: "No encontramos una reserva activa con ese documento en esta edición.",
  porcentaje_no_permitido: "Ese porcentaje no está disponible para tu reserva. Elige otro.",
  sin_saldo:
    "Ya registraste pagos por el 100% del taller. Si necesitas corregir un comprobante, escríbenos por WhatsApp.",
  no_encontrado: "No encontramos ese registro. Puede que se haya eliminado.",
  tiene_pagos_verificados: "Tiene pagos verificados: no se puede eliminar. Cancélala en su lugar.",
  tiene_certificado:
    "Tiene un certificado emitido: no se puede eliminar ni fusionar. Revoca el certificado o cancela la inscripción.",
  misma_persona: "Elige una persona distinta para fusionar.",
  documento_duplicado: "Ya existe otra persona con ese documento. Usa «Fusionar» para unirlas.",
  limite: "Demasiadas consultas seguidas. Espera unos minutos e inténtalo de nuevo.",
  error: "No se pudo completar. Inténtalo otra vez en unos segundos.",
};
```

- [ ] **Step 6: Implementar `filtros.ts`**

`src/lib/inscripciones/filtros.ts`:

```ts
import { normalizarDocumento } from "./documento";
import { estadoPago } from "./pagos";
import type { Inscrito } from "./tipos";

export const FILTROS_ESTADO = [
  "todos",
  "pendiente",
  "abonado",
  "pagado",
  "cancelada",
  "sin_documento",
] as const;
export type FiltroEstado = (typeof FILTROS_ESTADO)[number];

export const FILTRO_ETIQUETA: Record<FiltroEstado, string> = {
  todos: "Todos",
  pendiente: "Pendientes",
  abonado: "Abonados",
  pagado: "Pagados",
  cancelada: "Cancelados",
  sin_documento: "Por identificar",
};

export type FiltroInscritos = { q: string; estado: FiltroEstado };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lee el filtro de la URL; cualquier valor raro cae a "todos". */
export function leerFiltro(sp: { q?: string | string[]; estado?: string | string[] }): FiltroInscritos {
  const estado = uno(sp.estado);
  return {
    q: uno(sp.q).trim().slice(0, 80),
    estado: (FILTROS_ESTADO as readonly string[]).includes(estado) ? (estado as FiltroEstado) : "todos",
  };
}

const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Filtra en memoria: un taller tiene decenas de inscritos, no miles, y así el
 * filtro no necesita otra consulta a la base.
 */
export function filtrarInscritos(lista: readonly Inscrito[], f: FiltroInscritos): Inscrito[] {
  const q = plano(f.q);
  const qDocumento = normalizarDocumento(f.q);
  const qReferencia = f.q.trim().toUpperCase();

  return lista.filter((i) => {
    if (f.estado === "sin_documento" && i.persona.documento !== null) return false;
    if (f.estado !== "todos" && f.estado !== "sin_documento" && estadoPago(i) !== f.estado) return false;
    if (!q) return true;
    return (
      plano(i.persona.nombre).includes(q) ||
      plano(i.persona.email ?? "").includes(q) ||
      (qDocumento.length > 0 && (i.persona.documento ?? "").includes(qDocumento)) ||
      i.referencia.includes(qReferencia)
    );
  });
}
```

- [ ] **Step 7: Implementar `limite.ts`**

`src/lib/limite.ts`:

```ts
/**
 * Límite de frecuencia en la memoria del proceso.
 *
 * Frena a quien prueba documentos uno tras otro para ver quién está inscrito.
 * No es un sistema distribuido: el sitio corre en un solo contenedor y, si se
 * reinicia, el contador vuelve a cero — para este riesgo basta.
 */

export type Limitador = { permitir(clave: string, ahora?: number): boolean };

export function crearLimitador({ max, ventanaMs }: { max: number; ventanaMs: number }): Limitador {
  const golpes = new Map<string, number[]>();

  return {
    permitir(clave, ahora = Date.now()) {
      const recientes = (golpes.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      if (recientes.length >= max) {
        golpes.set(clave, recientes);
        return false;
      }
      recientes.push(ahora);
      golpes.set(clave, recientes);

      // Barrido ocasional: sin él, el mapa crece con cada IP que pasa.
      if (golpes.size > 5000) {
        for (const [k, v] of golpes) if (v.every((t) => ahora - t >= ventanaMs)) golpes.delete(k);
      }
      return true;
    },
  };
}

/**
 * IP del visitante tras el proxy de Dokploy, que añade `x-forwarded-for`. La
 * primera de la lista es la del navegador.
 */
export function ipDeCabeceras(h: Pick<Headers, "get">): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "desconocida";
  return h.get("x-real-ip")?.trim() || "desconocida";
}
```

- [ ] **Step 8: Ejecutar y ver que pasan**

Run: `npx vitest run src/lib/inscripciones src/lib/__tests__ && npx tsc --noEmit`
Expected: PASS en todas; `tsc` sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/lib/inscripciones src/lib/limite.ts src/lib/__tests__
git commit -m "feat(inscripciones): formularios, errores, filtros y límite de consultas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Migración SQL de la etapa 2 (con semilla, pruebas y scripts)

**Files:**
- Create: `supabase/migrations/20261015_01_inscripciones.sql`, `supabase/tests/semilla_produccion.sql`, `supabase/tests/migracion_inscripciones.sql`, `supabase/tests/inscripciones.sql`, `supabase/verificaciones/20261013_01_talleres.sql`, `supabase/verificaciones/antes_20261015_01_inscripciones.sql`, `supabase/verificaciones/20261015_01_inscripciones.sql`, `scripts/probar-migraciones.sh`
- Modify: `scripts/migrar.sh` (completo), `supabase/tests/talleres.sql:1-4` y casos 6–8

**Interfaces:**
- Consumes: la base tal como la dejó `20261013_01_talleres.sql` (tabla `talleres` con PK `slug` e índice único `talleres_id_key` sobre `id`; `reservations`, `payment_proofs`; función `public.tocar_actualizado_en()`).
- Produces (base de datos):
  - Restricción `talleres_id_key UNIQUE (id)`.
  - Enum `public.inscripcion_origen ('web','admin','migracion')`.
  - `public.normalizar_documento(text) returns text` (inmutable; igual que `normalizarDocumento`).
  - Tablas `public.personas`, `public.inscripciones`, `public.comprobantes` (columnas abajo), RLS activo y sin políticas.
  - Tablas `public._legacy_reservations`, `public._legacy_payment_proofs` (las antiguas, renombradas, intactas).
  - Vistas (`security_invoker`): `talleres_disponibilidad (id, slug, total, ocupados, libres)` sobre `inscripciones`; `taller_certificates` (compatibilidad, mismas columnas de antes); `inscritos_admin (id, referencia, taller_id, persona_id, documento, tipo_documento, nombre, email, telefono, ciudad, profesion, tarifa_nombre, monto, moneda, porcentaje_pagado, porcentaje_manual, porcentaje_en_revision, comprobantes_verificados, cancelada, asistio, origen, notas, creado_en)`; `comprobantes_admin (id, inscripcion_id, referencia, taller_id, taller_nombre, persona_nombre, persona_documento, persona_tipo_documento, porcentaje, estado, notas, nota_admin, file_path, file_type, file_size, creado_en, revisado_en, porcentaje_pagado, porcentaje_manual)`. Se elimina `taller_availability`.
  - Funciones (`security definer`, solo `service_role`):
    - `crear_inscripcion(p_taller_id uuid, p_referencia text, p_documento text, p_tipo_documento text, p_nombre text, p_email text, p_telefono text, p_ciudad text, p_profesion text, p_tarifa_id text, p_tarifa_nombre text, p_monto integer, p_moneda text, p_notas text, p_origen text, p_forzar_cupo boolean) returns table (ok boolean, reason text, inscripcion_id uuid, inscripcion_referencia text, reactivada boolean, cupos_total integer, cupos_ocupados integer)` — reasons: `taller_desconocido`, `documento_invalido`, `cerrado`, `ya_inscrito`, `sin_cupos`.
    - `consultar_inscripcion(p_taller_id uuid, p_documento text) returns table (inscripcion_id uuid, referencia text, tipo_documento text, nombre text, email text, telefono text, monto integer, moneda text, porcentaje_pagado integer, porcentaje_en_revision integer)` — cero filas si no hay inscripción activa.
    - `registrar_comprobante(p_taller_id uuid, p_documento text, p_comprobante_id uuid, p_porcentaje integer, p_nombre text, p_email text, p_telefono text, p_notas text, p_file_path text, p_file_type text, p_file_size integer) returns table (ok boolean, reason text, inscripcion_referencia text, nuevo_en_revision integer)` — reasons: `taller_desconocido`, `cerrado`, `sin_inscripcion`, `sin_saldo`, `porcentaje_no_permitido`.
    - `recalcular_porcentaje(p_inscripcion_id uuid) returns void`.
    - `revisar_comprobante(p_comprobante_id uuid, p_estado text, p_nota text) returns table (ok boolean, reason text, nuevo_porcentaje integer)`.
    - `ajustar_porcentaje(p_inscripcion_id uuid, p_porcentaje integer) returns table (ok boolean, reason text, nuevo_porcentaje integer)` — `null` = volver a automático.
    - `eliminar_inscripcion(p_inscripcion_id uuid) returns table (ok boolean, reason text, archivos text[])` — reasons: `no_encontrado`, `tiene_pagos_verificados`, `tiene_certificado` (desde la etapa 3).
    - `fusionar_personas(p_origen uuid, p_destino uuid) returns table (ok boolean, reason text)` — reasons: `misma_persona`, `no_encontrado`, `tiene_certificado` (desde la etapa 3).
  - `create_reservation` y `register_payment_proof` siguen existiendo (sin uso) hasta `20261015_03_limpieza.sql`.
- Produces (scripts): `scripts/migrar.sh [archivo]`; `scripts/probar-migraciones.sh`.

- [ ] **Step 1: Escribir la migración**

`supabase/migrations/20261015_01_inscripciones.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Etapa 2 · Personas, inscripciones y comprobantes
--
-- El número de documento pasa a identificar a la persona en toda la
-- plataforma. `reservations` y `payment_proofs` se migran fila por fila a
-- `personas` / `inscripciones` / `comprobantes` (mismos id, referencias y
-- archivos) y se renombran a `_legacy_*`: no se borra nada. Los duplicados no
-- se resuelven aquí: se fusionan a mano desde el admin.
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261015_01_inscripciones.sql
-- Va después de 20261013_01_talleres.sql. Es idempotente: puede volver a
-- ejecutarse mientras no se haya aplicado 20261015_02 (que amplía una vista).
-- Si algo falla, la transacción se deshace entera.
-- ---------------------------------------------------------------------------

begin;

do $$
begin
  create type public.inscripcion_origen as enum ('web', 'admin', 'migracion');
exception
  when duplicate_object then null;
end
$$;

-- `talleres.id` es único por un índice; una FK necesita una restricción. Se
-- reutiliza el mismo índice. La PK sigue siendo `slug`: las tablas `_legacy_*`
-- apuntan a ella y el código nuevo usa `id`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'talleres_id_key' and conrelid = 'public.talleres'::regclass
  ) then
    alter table public.talleres add constraint talleres_id_key unique using index talleres_id_key;
  end if;
end
$$;

-- Misma normalización que `normalizarDocumento` en src/lib/inscripciones/documento.ts.
create or replace function public.normalizar_documento(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      upper(translate(coalesce(p, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^A-Z0-9]', '', 'g'),
    '')
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  -- Normalizado. Nulo solo en personas migradas sin documento: quedan
  -- «por identificar» hasta que el admin lo complete o las fusione.
  documento      text unique check (documento ~ '^[A-Z0-9]{4,20}$'),
  tipo_documento text not null default 'CC'
                 check (tipo_documento in ('CC', 'CE', 'PAS', 'CI', 'OTRO')),
  -- El que se imprime en el certificado.
  nombre         text not null check (length(nombre) between 1 and 160),
  -- Nulos permitidos: el admin inscribe a gente que apartó cupo por WhatsApp
  -- y a veces no tiene su email. La web los exige.
  email          text,
  telefono       text,
  ciudad         text,
  profesion      text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.inscripciones (
  -- Las migradas conservan el id y la referencia de `reservations`.
  id                uuid primary key default gen_random_uuid(),
  referencia        text not null unique,
  persona_id        uuid not null references public.personas (id),
  taller_id         uuid not null references public.talleres (id),
  -- Copia de la tarifa al inscribirse: cambiar precios no reescribe lo pasado.
  tarifa_id         text not null,
  tarifa_nombre     text not null,
  monto             integer,
  moneda            text,
  -- Suma de comprobantes verificados (tope 100), o el valor que fije el admin.
  porcentaje_pagado integer not null default 0 check (porcentaje_pagado between 0 and 100),
  porcentaje_manual boolean not null default false,
  -- Cancelada libera el cupo; la fila se conserva por su historial.
  cancelada         boolean not null default false,
  asistio           boolean not null default false,
  origen            public.inscripcion_origen not null default 'web',
  notas             text not null default '',
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint inscripciones_persona_taller_key unique (persona_id, taller_id)
);

create index if not exists inscripciones_taller_idx on public.inscripciones (taller_id);

create table if not exists public.comprobantes (
  -- Las migradas conservan el id y el archivo de `payment_proofs`.
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones (id),
  -- Lo que cubre este pago, en % del total.
  porcentaje     integer not null check (porcentaje between 1 and 100),
  estado         public.payment_proof_status not null default 'pending',
  -- Datos de quien pagó tal como estaban al subirlo (para cruzar con el banco).
  nombre         text,
  documento      text,
  email          text,
  telefono       text,
  notas          text not null default '',
  -- Ruta dentro del bucket privado `comprobantes` (`<slug>/<id>.<ext>`).
  file_path      text not null unique,
  file_type      text not null,
  file_size      integer not null check (file_size > 0),
  nota_admin     text,
  revisado_en    timestamptz,
  creado_en      timestamptz not null default now()
);

create index if not exists comprobantes_inscripcion_idx on public.comprobantes (inscripcion_id);
create index if not exists comprobantes_estado_idx on public.comprobantes (estado, creado_en desc);

drop trigger if exists personas_actualizado_en on public.personas;
create trigger personas_actualizado_en
  before update on public.personas
  for each row execute function public.tocar_actualizado_en();

drop trigger if exists inscripciones_actualizado_en on public.inscripciones;
create trigger inscripciones_actualizado_en
  before update on public.inscripciones
  for each row execute function public.tocar_actualizado_en();

alter table public.personas      enable row level security;
alter table public.inscripciones enable row level security;
alter table public.comprobantes  enable row level security;

-- ---------------------------------------------------------------------------
-- Migración de datos. Solo la primera vez: después `reservations` ya se llama
-- `_legacy_reservations` y el bloque no hace nada.
-- ---------------------------------------------------------------------------

do $$
declare
  r           record;
  v_doc       text;
  v_duplicado text;
  v_taller    uuid;
  v_persona   uuid;
  v_huerfanos integer;
begin
  if to_regclass('public.reservations') is null then
    return;
  end if;

  -- Un comprobante sin reserva no tiene inscripción a la que colgarse. Antes
  -- que perderlo, se aborta (y la transacción no deja nada a medias).
  select count(*) into v_huerfanos from public.payment_proofs where reservation_id is null;
  if v_huerfanos > 0 then
    raise exception 'Hay % comprobantes sin reserva (payment_proofs.reservation_id nulo). Asígnalos a mano antes de migrar.', v_huerfanos;
  end if;

  for r in
    select res.*,
           -- La reserva hecha sin pagar no pedía documento; el comprobante sí.
           coalesce(res.document, (
             select p.document from public.payment_proofs p
              where p.reservation_id = res.id and p.document is not null
              order by p.created_at
              limit 1
           )) as doc_original
      from public.reservations res
     order by res.created_at, res.id
  loop
    v_doc := public.normalizar_documento(r.doc_original);
    if v_doc !~ '^[A-Z0-9]{4,20}$' then
      v_doc := null;
    end if;

    select t.id into v_taller from public.talleres t where t.slug = r.edition;

    v_persona := null;
    v_duplicado := null;
    if v_doc is not null then
      select p.id into v_persona from public.personas p where p.documento = v_doc;
      -- Mismo documento dos veces en el mismo taller: la segunda no puede ser
      -- la misma persona (unique persona+taller). Queda por identificar, con
      -- una nota, y el admin decide si la fusiona.
      if v_persona is not null and exists (
        select 1 from public.inscripciones i where i.persona_id = v_persona and i.taller_id = v_taller
      ) then
        v_duplicado := v_doc;
        v_persona := null;
        v_doc := null;
      end if;
    end if;

    if v_persona is null then
      insert into public.personas (documento, nombre, email, telefono, ciudad, profesion, creado_en)
      values (v_doc, r.name, nullif(r.email, ''), nullif(r.phone, ''), nullif(r.city, ''),
              nullif(r.profession, ''), r.created_at)
      returning id into v_persona;
    end if;

    insert into public.inscripciones (
      id, referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, monto, moneda,
      porcentaje_pagado, porcentaje_manual, cancelada, asistio, origen, notas, creado_en
    )
    values (
      r.id, r.reference, v_persona, v_taller, r.tier_id, r.tier_name, r.amount, r.currency,
      -- `confirmed` se confirmaba a mano tras ver el pago: equivale a 100% fijado.
      case when r.status = 'confirmed' then 100 else 0 end,
      r.status = 'confirmed',
      r.status = 'cancelled',
      r.attended,
      'migracion',
      concat_ws(E'\n',
        nullif(r.notes, ''),
        case when v_duplicado is not null then
          'Migración: el documento ' || v_duplicado
          || ' ya tenía otra reserva en este taller. Revisa si es un duplicado y fusiónalo.'
        end),
      r.created_at
    );
  end loop;

  insert into public.comprobantes (
    id, inscripcion_id, porcentaje, estado, nombre, documento, email, telefono, notas,
    file_path, file_type, file_size, creado_en
  )
  select p.id, p.reservation_id,
         case p.kind when 'deposit' then 50 else 100 end,
         p.status, p.name, p.document, p.email, p.phone, p.notes,
         p.file_path, p.file_type, p.file_size, p.created_at
    from public.payment_proofs p;

  -- Lo pagado según comprobantes verificados (hoy ninguno); las confirmadas
  -- conservan su 100% manual.
  update public.inscripciones i
     set porcentaje_pagado = least(100, s.total)
    from (
      select c.inscripcion_id, sum(c.porcentaje)::integer as total
        from public.comprobantes c
       where c.estado = 'verified'
       group by c.inscripcion_id
    ) s
   where s.inscripcion_id = i.id
     and not i.porcentaje_manual;

  alter table public.payment_proofs rename to _legacy_payment_proofs;
  alter table public.reservations rename to _legacy_reservations;
end
$$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

-- La de compatibilidad de la etapa 1 ya no la usa ningún código.
drop view if exists public.taller_availability;

-- Mismas columnas que antes: el código desplegado de la etapa 1 la sigue
-- leyendo durante el despliegue.
create or replace view public.talleres_disponibilidad
with (security_invoker = on) as
  select
    t.id,
    t.slug,
    t.cupos_total as total,
    (count(i.id) filter (where not i.cancelada))::integer as ocupados,
    greatest(t.cupos_total - (count(i.id) filter (where not i.cancelada)), 0)::integer as libres
  from public.talleres t
  left join public.inscripciones i on i.taller_id = t.id
  group by t.id, t.slug, t.cupos_total;

-- COMPATIBILIDAD: las páginas de certificados de la etapa 1 y 2 leen esta
-- vista. Mismas columnas; «confirmado» pasa a ser 100% pagado. Se elimina en
-- 20261015_03_limpieza.sql, cuando ya nadie la usa.
create or replace view public.taller_certificates
with (security_invoker = on) as
  select
    i.referencia as reference,
    p.nombre as name,
    coalesce(p.email, '') as email,
    coalesce(p.profesion, '') as profession,
    coalesce(p.ciudad, '') as city,
    t.slug as edition,
    trim(concat_ws(' ', t.titulo, t.titulo_acento)) as course_title,
    t.fechas_texto as dates_label,
    t.horas as hours,
    t.aval as endorsement,
    t.ciudad as venue_city,
    t.region as venue_region,
    t.firma_nombre as signature_name,
    t.firma_cargo as signature_title,
    t.firma_documento as signature_document,
    i.creado_en as created_at
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  join public.talleres t on t.id = i.taller_id
  where i.porcentaje_pagado = 100
    and i.asistio
    and not i.cancelada;

-- Lista de inscritos del admin: una fila por inscripción con su persona y lo
-- que está en revisión. La etapa 3 le añade columnas al final.
create or replace view public.inscritos_admin
with (security_invoker = on) as
  select
    i.id,
    i.referencia,
    i.taller_id,
    i.persona_id,
    p.documento,
    p.tipo_documento,
    p.nombre,
    p.email,
    p.telefono,
    p.ciudad,
    p.profesion,
    i.tarifa_nombre,
    i.monto,
    i.moneda,
    i.porcentaje_pagado,
    i.porcentaje_manual,
    coalesce(sum(c.porcentaje) filter (where c.estado = 'pending'), 0)::integer as porcentaje_en_revision,
    (count(c.id) filter (where c.estado = 'verified'))::integer as comprobantes_verificados,
    i.cancelada,
    i.asistio,
    i.origen,
    i.notas,
    i.creado_en
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  left join public.comprobantes c on c.inscripcion_id = i.id
  group by i.id, p.id;

create or replace view public.comprobantes_admin
with (security_invoker = on) as
  select
    c.id,
    c.inscripcion_id,
    i.referencia,
    i.taller_id,
    t.nombre as taller_nombre,
    p.nombre as persona_nombre,
    p.documento as persona_documento,
    p.tipo_documento as persona_tipo_documento,
    c.porcentaje,
    c.estado,
    c.notas,
    c.nota_admin,
    c.file_path,
    c.file_type,
    c.file_size,
    c.creado_en,
    c.revisado_en,
    i.porcentaje_pagado,
    i.porcentaje_manual
  from public.comprobantes c
  join public.inscripciones i on i.id = c.inscripcion_id
  join public.personas p on p.id = i.persona_id
  join public.talleres t on t.id = i.taller_id;

revoke all on public.talleres_disponibilidad, public.taller_certificates,
              public.inscritos_admin, public.comprobantes_admin
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones. Devuelven una fila `ok/reason` en vez de lanzar excepciones: así
-- el servidor distingue «sin cupos» de un fallo real.
-- ---------------------------------------------------------------------------

-- Alta de inscripción (web o admin). El advisory lock por taller serializa el
-- «¿queda cupo?» con el insert: dos envíos simultáneos no venden la misma plaza.
create or replace function public.crear_inscripcion(
  p_taller_id      uuid,
  p_referencia     text,
  p_documento      text,
  p_tipo_documento text,
  p_nombre         text,
  p_email          text,
  p_telefono       text,
  p_ciudad         text,
  p_profesion      text,
  p_tarifa_id      text,
  p_tarifa_nombre  text,
  p_monto          integer,
  p_moneda         text,
  p_notas          text,
  p_origen         text,
  p_forzar_cupo    boolean
)
returns table (
  ok                     boolean,
  reason                 text,
  inscripcion_id         uuid,
  inscripcion_referencia text,
  reactivada             boolean,
  cupos_total            integer,
  cupos_ocupados         integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taller    public.talleres%rowtype;
  v_abierto   boolean;
  v_ocupados  integer;
  v_doc       text := public.normalizar_documento(p_documento);
  v_persona   uuid;
  v_existente public.inscripciones%rowtype;
  v_id        uuid;
begin
  if p_origen not in ('web', 'admin') then
    raise exception 'origen no válido: %', p_origen;
  end if;

  perform pg_advisory_xact_lock(hashtext('taller:' || p_taller_id::text));

  select * into v_taller from public.talleres t where t.id = p_taller_id;
  if not found then
    return query select false, 'taller_desconocido'::text, null::uuid, null::text, false, 0, 0;
    return;
  end if;

  if v_doc is null or v_doc !~ '^[A-Z0-9]{4,20}$' then
    return query select false, 'documento_invalido'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, 0;
    return;
  end if;

  select count(*)::integer into v_ocupados
    from public.inscripciones i
   where i.taller_id = p_taller_id and not i.cancelada;

  v_abierto := v_taller.estado = 'publicado'
               and v_taller.fecha_fin >= (now() at time zone 'America/Caracas')::date;

  -- El admin inscribe en cualquier estado: los cupos apartados por WhatsApp a
  -- veces se registran con el taller ya cerrado o terminado.
  if p_origen = 'web' and not v_abierto then
    return query select false, 'cerrado'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, v_ocupados;
    return;
  end if;

  select p.id into v_persona from public.personas p where p.documento = v_doc;

  if v_persona is not null then
    select * into v_existente
      from public.inscripciones i
     where i.persona_id = v_persona and i.taller_id = p_taller_id;
    -- Ya inscrita: no se toca su ficha (quien conoce un documento ajeno no
    -- debe poder reescribir los datos de esa persona).
    if found and not v_existente.cancelada then
      return query select false, 'ya_inscrito'::text, v_existente.id, v_existente.referencia, false,
                          v_taller.cupos_total, v_ocupados;
      return;
    end if;
  end if;

  if v_ocupados >= v_taller.cupos_total
     and not (p_origen = 'admin' and coalesce(p_forzar_cupo, false)) then
    return query select false, 'sin_cupos'::text, null::uuid, null::text, false,
                        v_taller.cupos_total, v_ocupados;
    return;
  end if;

  -- Documento conocido → se actualiza la ficha. Un campo vacío no borra lo guardado.
  if v_persona is null then
    insert into public.personas (documento, tipo_documento, nombre, email, telefono, ciudad, profesion)
    values (v_doc, coalesce(nullif(p_tipo_documento, ''), 'CC'), p_nombre, nullif(p_email, ''),
            nullif(p_telefono, ''), nullif(p_ciudad, ''), nullif(p_profesion, ''))
    returning id into v_persona;
  else
    update public.personas p
       set tipo_documento = coalesce(nullif(p_tipo_documento, ''), p.tipo_documento),
           nombre         = coalesce(nullif(p_nombre, ''), p.nombre),
           email          = coalesce(nullif(p_email, ''), p.email),
           telefono       = coalesce(nullif(p_telefono, ''), p.telefono),
           ciudad         = coalesce(nullif(p_ciudad, ''), p.ciudad),
           profesion      = coalesce(nullif(p_profesion, ''), p.profesion)
     where p.id = v_persona;
  end if;

  if v_existente.id is not null then
    -- Estaba cancelada: se reactiva la misma fila, con su referencia y sus comprobantes.
    update public.inscripciones i set cancelada = false where i.id = v_existente.id;
    return query select true, null::text, v_existente.id, v_existente.referencia, true,
                        v_taller.cupos_total, v_ocupados + 1;
    return;
  end if;

  insert into public.inscripciones (
    referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, monto, moneda, origen, notas
  )
  values (
    p_referencia, v_persona, p_taller_id, p_tarifa_id, p_tarifa_nombre, p_monto, p_moneda,
    p_origen::public.inscripcion_origen, coalesce(p_notas, '')
  )
  returning id into v_id;

  return query select true, null::text, v_id, p_referencia, false,
                      v_taller.cupos_total, v_ocupados + 1;
end;
$$;

-- Paso 1 del registro de pago: ¿hay inscripción activa con este documento?
-- El servidor enmascara lo que devuelve antes de mandarlo al navegador.
create or replace function public.consultar_inscripcion(p_taller_id uuid, p_documento text)
returns table (
  inscripcion_id         uuid,
  referencia             text,
  tipo_documento         text,
  nombre                 text,
  email                  text,
  telefono               text,
  monto                  integer,
  moneda                 text,
  porcentaje_pagado      integer,
  porcentaje_en_revision integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.referencia, p.tipo_documento, p.nombre, p.email, p.telefono, i.monto, i.moneda,
         i.porcentaje_pagado,
         coalesce((
           select sum(c.porcentaje) from public.comprobantes c
            where c.inscripcion_id = i.id and c.estado = 'pending'
         ), 0)::integer
    from public.personas p
    join public.inscripciones i on i.persona_id = p.id
   where p.documento = public.normalizar_documento(p_documento)
     and i.taller_id = p_taller_id
     and not i.cancelada
$$;

-- Paso 2: registra el comprobante. Lo vuelve a validar todo (el paso 1 no deja
-- ningún token): taller abierto, inscripción activa, porcentaje permitido y
-- que no supere el saldo contando lo que está en revisión. Aplica las
-- correcciones que la persona reescribió completas. El archivo ya está en el
-- bucket; si esto devuelve ok = false, el servidor lo borra.
create or replace function public.registrar_comprobante(
  p_taller_id      uuid,
  p_documento      text,
  p_comprobante_id uuid,
  p_porcentaje     integer,
  p_nombre         text,
  p_email          text,
  p_telefono       text,
  p_notas          text,
  p_file_path      text,
  p_file_type      text,
  p_file_size      integer
)
returns table (
  ok                     boolean,
  reason                 text,
  inscripcion_referencia text,
  nuevo_en_revision      integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taller   public.talleres%rowtype;
  v_persona  public.personas%rowtype;
  v_ins      public.inscripciones%rowtype;
  v_revision integer;
  v_saldo    integer;
begin
  perform pg_advisory_xact_lock(hashtext('taller:' || p_taller_id::text));

  select * into v_taller from public.talleres t where t.id = p_taller_id;
  if not found then
    return query select false, 'taller_desconocido'::text, null::text, 0;
    return;
  end if;

  if not (v_taller.estado = 'publicado'
          and v_taller.fecha_fin >= (now() at time zone 'America/Caracas')::date) then
    return query select false, 'cerrado'::text, null::text, 0;
    return;
  end if;

  select * into v_persona
    from public.personas p
   where p.documento = public.normalizar_documento(p_documento);
  if found then
    select * into v_ins
      from public.inscripciones i
     where i.persona_id = v_persona.id and i.taller_id = p_taller_id and not i.cancelada;
  end if;
  if v_ins.id is null then
    return query select false, 'sin_inscripcion'::text, null::text, 0;
    return;
  end if;

  select coalesce(sum(c.porcentaje), 0)::integer into v_revision
    from public.comprobantes c
   where c.inscripcion_id = v_ins.id and c.estado = 'pending';

  v_saldo := greatest(0, 100 - least(100, v_ins.porcentaje_pagado + v_revision));

  if v_saldo = 0 then
    return query select false, 'sin_saldo'::text, v_ins.referencia, v_revision;
    return;
  end if;

  if p_porcentaje is null or p_porcentaje <= 0 or p_porcentaje > v_saldo
     or not (p_porcentaje = any (v_taller.porcentajes_pago) or p_porcentaje = v_saldo) then
    return query select false, 'porcentaje_no_permitido'::text, v_ins.referencia, v_revision;
    return;
  end if;

  update public.personas p
     set nombre   = coalesce(nullif(p_nombre, ''), p.nombre),
         email    = coalesce(nullif(p_email, ''), p.email),
         telefono = coalesce(nullif(p_telefono, ''), p.telefono)
   where p.id = v_persona.id
  returning * into v_persona;

  insert into public.comprobantes (
    id, inscripcion_id, porcentaje, nombre, documento, email, telefono, notas,
    file_path, file_type, file_size
  )
  values (
    p_comprobante_id, v_ins.id, p_porcentaje, v_persona.nombre, v_persona.documento,
    v_persona.email, v_persona.telefono, coalesce(p_notas, ''),
    p_file_path, p_file_type, p_file_size
  );

  return query select true, null::text, v_ins.referencia, v_revision + p_porcentaje;
end;
$$;

-- Lo pagado = suma de verificados (tope 100), salvo que el admin lo fijara a mano.
create or replace function public.recalcular_porcentaje(p_inscripcion_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.inscripciones i
     set porcentaje_pagado = least(100, coalesce((
           select sum(c.porcentaje) from public.comprobantes c
            where c.inscripcion_id = i.id and c.estado = 'verified'
         ), 0))
   where i.id = p_inscripcion_id
     and not i.porcentaje_manual;
$$;

create or replace function public.revisar_comprobante(
  p_comprobante_id uuid,
  p_estado         text,
  p_nota           text
)
returns table (ok boolean, reason text, nuevo_porcentaje integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ins uuid;
  v_pct integer;
begin
  if p_estado not in ('pending', 'verified', 'rejected') then
    return query select false, 'estado_invalido'::text, null::integer;
    return;
  end if;

  update public.comprobantes c
     set estado      = p_estado::public.payment_proof_status,
         nota_admin  = nullif(trim(coalesce(p_nota, '')), ''),
         revisado_en = case when p_estado = 'pending' then null else now() end
   where c.id = p_comprobante_id
  returning c.inscripcion_id into v_ins;

  if v_ins is null then
    return query select false, 'no_encontrado'::text, null::integer;
    return;
  end if;

  perform public.recalcular_porcentaje(v_ins);
  select i.porcentaje_pagado into v_pct from public.inscripciones i where i.id = v_ins;
  return query select true, null::text, v_pct;
end;
$$;

-- Ajuste manual del admin (pagos por fuera de la web). `null` = volver a
-- calcularlo con los comprobantes verificados.
create or replace function public.ajustar_porcentaje(p_inscripcion_id uuid, p_porcentaje integer)
returns table (ok boolean, reason text, nuevo_porcentaje integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pct integer;
begin
  if p_porcentaje is not null and (p_porcentaje < 0 or p_porcentaje > 100) then
    return query select false, 'porcentaje_no_permitido'::text, null::integer;
    return;
  end if;

  update public.inscripciones i
     set porcentaje_manual = p_porcentaje is not null,
         porcentaje_pagado = coalesce(p_porcentaje, i.porcentaje_pagado)
   where i.id = p_inscripcion_id;

  if not found then
    return query select false, 'no_encontrado'::text, null::integer;
    return;
  end if;

  perform public.recalcular_porcentaje(p_inscripcion_id);
  select i.porcentaje_pagado into v_pct from public.inscripciones i where i.id = p_inscripcion_id;
  return query select true, null::text, v_pct;
end;
$$;

-- Borra una inscripción (p. ej. de prueba) con sus comprobantes sin verificar.
-- Devuelve las rutas de los archivos para que el servidor los quite del bucket.
create or replace function public.eliminar_inscripcion(p_inscripcion_id uuid)
returns table (ok boolean, reason text, archivos text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona  uuid;
  v_archivos text[];
begin
  select i.persona_id into v_persona from public.inscripciones i where i.id = p_inscripcion_id;
  if v_persona is null then
    return query select false, 'no_encontrado'::text, null::text[];
    return;
  end if;

  if exists (
    select 1 from public.comprobantes c
     where c.inscripcion_id = p_inscripcion_id and c.estado = 'verified'
  ) then
    return query select false, 'tiene_pagos_verificados'::text, null::text[];
    return;
  end if;

  -- La tabla `certificados` llega en la etapa 3. El IF anidado evita que
  -- plpgsql planifique la consulta mientras la tabla no existe.
  if to_regclass('public.certificados') is not null then
    if exists (select 1 from public.certificados ce where ce.inscripcion_id = p_inscripcion_id) then
      return query select false, 'tiene_certificado'::text, null::text[];
      return;
    end if;
  end if;

  with borrados as (
    delete from public.comprobantes c where c.inscripcion_id = p_inscripcion_id
    returning c.file_path
  )
  select coalesce(array_agg(b.file_path), '{}') into v_archivos from borrados b;

  delete from public.inscripciones i where i.id = p_inscripcion_id;

  -- Si la persona se queda sin inscripciones, se va con ella.
  delete from public.personas p
   where p.id = v_persona
     and not exists (select 1 from public.inscripciones i where i.persona_id = p.id);

  return query select true, null::text, v_archivos;
end;
$$;

-- Fusiona dos fichas de la misma persona. El destino conserva sus datos y solo
-- hereda lo que le falte. Si las dos están en el mismo taller (el duplicado
-- típico: reservó dos veces), sus inscripciones se unen en la del destino.
create or replace function public.fusionar_personas(p_origen uuid, p_destino uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen  public.personas%rowtype;
  v_destino public.personas%rowtype;
  r         record;
begin
  if p_origen = p_destino then
    return query select false, 'misma_persona'::text;
    return;
  end if;

  select * into v_origen from public.personas p where p.id = p_origen for update;
  select * into v_destino from public.personas p where p.id = p_destino for update;
  if v_origen.id is null or v_destino.id is null then
    return query select false, 'no_encontrado'::text;
    return;
  end if;

  -- Una inscripción con certificado no puede desaparecer (llega en la etapa 3).
  if to_regclass('public.certificados') is not null then
    if exists (
      select 1
        from public.inscripciones io
        join public.inscripciones id_ on id_.taller_id = io.taller_id and id_.persona_id = p_destino
        join public.certificados ce on ce.inscripcion_id = io.id
       where io.persona_id = p_origen
    ) then
      return query select false, 'tiene_certificado'::text;
      return;
    end if;
  end if;

  for r in
    select io.id as origen_id, io.referencia as origen_ref, io.porcentaje_pagado as origen_pct,
           io.porcentaje_manual as origen_manual, io.asistio as origen_asistio,
           io.cancelada as origen_cancelada, io.notas as origen_notas,
           id_.id as destino_id
      from public.inscripciones io
      join public.inscripciones id_ on id_.taller_id = io.taller_id and id_.persona_id = p_destino
     where io.persona_id = p_origen
  loop
    update public.comprobantes c set inscripcion_id = r.destino_id where c.inscripcion_id = r.origen_id;

    update public.inscripciones i
       set asistio           = i.asistio or r.origen_asistio,
           cancelada         = i.cancelada and r.origen_cancelada,
           porcentaje_manual = i.porcentaje_manual or r.origen_manual,
           porcentaje_pagado = case when i.porcentaje_manual or r.origen_manual
                                    then greatest(i.porcentaje_pagado, r.origen_pct)
                                    else i.porcentaje_pagado end,
           notas = concat_ws(E'\n', nullif(i.notas, ''), nullif(r.origen_notas, ''),
                             'Fusionada con ' || r.origen_ref || '.')
     where i.id = r.destino_id;

    delete from public.inscripciones i where i.id = r.origen_id;
    perform public.recalcular_porcentaje(r.destino_id);
  end loop;

  update public.inscripciones i set persona_id = p_destino where i.persona_id = p_origen;

  -- Primero se borra el origen para liberar su documento (es único).
  delete from public.personas p where p.id = p_origen;

  update public.personas p
     set documento      = coalesce(p.documento, v_origen.documento),
         tipo_documento = case when p.documento is null and v_origen.documento is not null
                               then v_origen.tipo_documento else p.tipo_documento end,
         email          = coalesce(p.email, v_origen.email),
         telefono       = coalesce(p.telefono, v_origen.telefono),
         ciudad         = coalesce(p.ciudad, v_origen.ciudad),
         profesion      = coalesce(p.profesion, v_origen.profesion)
   where p.id = p_destino;

  return query select true, null::text;
end;
$$;

-- Son SECURITY DEFINER: nadie salvo service_role (el servidor) las ejecuta.
-- Supabase da EXECUTE a anon/authenticated por defecto en `public`; se quita.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.normalizar_documento(text)',
    'public.crear_inscripcion(uuid, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, boolean)',
    'public.consultar_inscripcion(uuid, text)',
    'public.registrar_comprobante(uuid, text, uuid, integer, text, text, text, text, text, text, integer)',
    'public.recalcular_porcentaje(uuid)',
    'public.revisar_comprobante(uuid, text, text)',
    'public.ajustar_porcentaje(uuid, integer)',
    'public.eliminar_inscripcion(uuid)',
    'public.fusionar_personas(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

-- Que la API de Supabase (PostgREST) vea ya las funciones y vistas nuevas;
-- el aviso se entrega al hacer commit.
notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 2: Semilla con filas como las de producción**

`supabase/tests/semilla_produccion.sql` (simula, ANTES de migrar, lo que hay en producción: 8 reservas pendientes, documento casi siempre nulo, dos personas repetidas, una prueba `confirmed` + `attended`, y 8 comprobantes con su `reservation_id`):

```sql
-- Filas como las de producción ANTES de la etapa 2, para probar la migración
-- en la base desechable de scripts/probar-migraciones.sh. NUNCA en Supabase.
-- Va después de schema.sql y 20261013_01_talleres.sql.

begin;

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
```

- [ ] **Step 3: Pruebas de la migración (sobre la semilla)**

`supabase/tests/migracion_inscripciones.sql`:

```sql
-- Comprueba que la migración de la etapa 2 no perdió ni mapeó mal nada.
-- SOLO en la base desechable, después de semilla_produccion.sql y de las
-- migraciones. No escribe nada. Cada comprobación imprime "OK ..." o aborta
-- con "FALLO ...".

do $$
declare
  v       integer;
  v_doc   text;
  v_notas text;
begin
  if to_regclass('public.reservations') is not null or to_regclass('public.payment_proofs') is not null then
    raise exception 'FALLO: las tablas antiguas siguen con su nombre';
  end if;
  if to_regclass('public.taller_availability') is not null then
    raise exception 'FALLO: taller_availability sigue existiendo';
  end if;

  -- 1. Ninguna reserva perdida: mismo id y misma referencia.
  select count(*) into v
    from public._legacy_reservations r
    left join public.inscripciones i on i.id = r.id and i.referencia = r.reference
   where i.id is null;
  if v <> 0 then raise exception 'FALLO: % reservas sin inscripción', v; end if;
  raise notice 'OK reservas migradas con su id y referencia';

  -- 2. Ningún comprobante perdido: mismo id, archivo e inscripción.
  select count(*) into v
    from public._legacy_payment_proofs p
    left join public.comprobantes c
      on c.id = p.id and c.file_path = p.file_path and c.inscripcion_id = p.reservation_id
   where c.id is null;
  if v <> 0 then raise exception 'FALLO: % comprobantes sin migrar', v; end if;
  raise notice 'OK comprobantes migrados con su archivo';

  -- 3. deposit → 50, full → 100.
  if (select porcentaje from public.comprobantes where id = '20000000-0000-0000-0000-000000000001') <> 50
     or (select porcentaje from public.comprobantes where id = '20000000-0000-0000-0000-000000000003') <> 100 then
    raise exception 'FALLO: porcentaje de los comprobantes';
  end if;
  raise notice 'OK deposit = 50 y full = 100';

  -- 4. El documento que solo estaba en el comprobante pasa a la persona.
  select p.documento into v_doc
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000001';
  if v_doc is distinct from '12345678' then raise exception 'FALLO: documento recuperado = %', v_doc; end if;
  raise notice 'OK documento recuperado del comprobante';

  -- 5. Mismo documento dos veces en el mismo taller: la primera lo conserva, la
  --    segunda queda por identificar con una nota.
  select p.documento into v_doc
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000003';
  if v_doc is distinct from 'V20111222' then raise exception 'FALLO: documento normalizado = %', v_doc; end if;
  select p.documento, i.notas into v_doc, v_notas
    from public.inscripciones i join public.personas p on p.id = i.persona_id
   where i.id = '10000000-0000-0000-0000-000000000004';
  if v_doc is not null or v_notas not like '%V20111222%' then
    raise exception 'FALLO: duplicado por documento (doc %, notas %)', v_doc, v_notas;
  end if;
  raise notice 'OK duplicado por documento queda por identificar';

  -- 6. confirmed → 100% fijado a mano, con la asistencia.
  if not exists (
    select 1 from public.inscripciones
     where id = '10000000-0000-0000-0000-000000000005'
       and porcentaje_pagado = 100 and porcentaje_manual and asistio
  ) then raise exception 'FALLO: la confirmada no quedó al 100%% manual'; end if;
  raise notice 'OK confirmed = 100%% manual';

  -- 7. cancelled → cancelada; pending → 0% (ningún comprobante verificado).
  if not exists (select 1 from public.inscripciones where id = '10000000-0000-0000-0000-000000000006' and cancelada)
     or exists (select 1 from public.inscripciones where id = '10000000-0000-0000-0000-000000000001' and porcentaje_pagado <> 0) then
    raise exception 'FALLO: cancelada o pendiente mal migradas';
  end if;
  raise notice 'OK cancelada y pendientes';

  -- 8. Cupos: la cancelada no ocupa.
  if (select ocupados from public.talleres_disponibilidad where slug = 'taller-2026-10') <> 7 then
    raise exception 'FALLO: ocupados';
  end if;
  raise notice 'OK disponibilidad sobre inscripciones';

  -- 9. Por identificar: Luis (2.ª), María (2.ª), la prueba y "Test".
  select count(*) into v from public.personas where documento is null;
  if v <> 4 then raise exception 'FALLO: % personas por identificar, esperaba 4', v; end if;
  raise notice 'OK personas por identificar';

  -- 10. Todas con origen migracion.
  if exists (select 1 from public.inscripciones where origen <> 'migracion') then
    raise exception 'FALLO: origen';
  end if;
  raise notice 'OK origen migracion';

  -- 11. La vista de compatibilidad sigue dando el certificado de prueba
  --     (hasta que 20261015_03 la elimina).
  if to_regclass('public.taller_certificates') is not null then
    if (select count(*) from public.taller_certificates) <> 1 then
      raise exception 'FALLO: taller_certificates';
    end if;
    raise notice 'OK vista de compatibilidad';
  else
    raise notice 'OK vista de compatibilidad ya eliminada';
  end if;
end
$$;
```

- [ ] **Step 4: Pruebas de las funciones**

`supabase/tests/inscripciones.sql`:

```sql
-- Pruebas de personas, inscripciones y comprobantes (etapa 2). SOLO en una
-- base de prueba con schema.sql y las migraciones aplicadas
-- (scripts/probar-migraciones.sh). Todo corre dentro de una transacción que se
-- deshace al final: no deja datos. Cada comprobación imprime "OK ..." o aborta
-- con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais,
   cupos_total, porcentajes_pago)
values
  ('prueba-i', 'I', 'I', 'publicado', '2031-05-10', '2031-05-11', 'x', 'S', 'C', 'P', 2, '{50,100}');

do $$
declare
  v_taller uuid := (select id from public.talleres where slug = 'prueba-i');
  r        record;
  v_ana    uuid;
  v_beto   uuid;
  v_c1     uuid := gen_random_uuid();
  v_c2     uuid := gen_random_uuid();
  v_dup_p  uuid;
  v_dup_i  uuid;
  v_notas  text;
begin
  -- 1. Reserva web: el documento se normaliza y se crea la persona.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA01', ' 1.136-882 468 ', 'CC',
    'Ana Prueba', 'ana@example.com', '3001112233', 'Maracaibo', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok then raise exception 'FALLO 1: %', r.reason; end if;
  if not exists (select 1 from public.personas where documento = '1136882468') then
    raise exception 'FALLO 1: documento no normalizado';
  end if;
  v_ana := r.inscripcion_id;
  raise notice 'OK reserva con documento normalizado';

  -- 2. Mismo documento en el mismo taller: ya_inscrito, sin tocar la ficha.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA02', '1136882468', 'CC',
    'Otro Nombre', 'otro@example.com', '3009999999', 'X', 'X',
    'general', 'Cupo General', null, null, '', 'web', false);
  if r.reason is distinct from 'ya_inscrito' then raise exception 'FALLO 2: %', r.reason; end if;
  if (select nombre from public.personas where documento = '1136882468') <> 'Ana Prueba' then
    raise exception 'FALLO 2: ya_inscrito cambió la ficha';
  end if;
  raise notice 'OK inscripción duplicada rechazada';

  -- 3. Documento demasiado corto.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA03', '12', 'CC',
    'Xavi Yuste', 'x@example.com', '3000000000', 'X', 'X',
    'general', 'Cupo General', null, null, '', 'web', false);
  if r.reason is distinct from 'documento_invalido' then raise exception 'FALLO 3: %', r.reason; end if;
  raise notice 'OK documento inválido';

  -- 4. Cupo (2): la segunda entra; la tercera no por la web, aunque pida
  --    forzar; el admin sí puede forzar.
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA04', '2000001', 'CE',
    'Beto Prueba', 'beto@example.com', '3002223344', 'Bogotá', 'Residente',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok then raise exception 'FALLO 4a: %', r.reason; end if;
  v_beto := r.inscripcion_id;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA05', '3000001', 'CC',
    'Caro Prueba', 'caro@example.com', '3003334455', 'Cali', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', true);
  if r.reason is distinct from 'sin_cupos' then raise exception 'FALLO 4b: la web forzó el cupo (%)', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA05', '3000001', 'CC',
    'Caro Prueba', '', '', '', '', 'general', 'Cupo General', null, null, 'Por WhatsApp', 'admin', true);
  if not r.ok then raise exception 'FALLO 4c: %', r.reason; end if;
  if (select email from public.personas where documento = '3000001') is not null then
    raise exception 'FALLO 4c: un email vacío debe quedar nulo';
  end if;
  if (select ocupados from public.talleres_disponibilidad where id = v_taller) <> 3 then
    raise exception 'FALLO 4d: ocupados';
  end if;
  raise notice 'OK cupo respetado y forzable solo por el admin';

  -- 5. Consulta por documento con otro formato.
  select * into r from public.consultar_inscripcion(v_taller, '1.136.882.468');
  if r.inscripcion_id is distinct from v_ana or r.porcentaje_pagado <> 0 or r.porcentaje_en_revision <> 0 then
    raise exception 'FALLO 5a';
  end if;
  if exists (select 1 from public.consultar_inscripcion(v_taller, '99999999')) then
    raise exception 'FALLO 5b: devolvió algo para un documento desconocido';
  end if;
  raise notice 'OK consulta por documento';

  -- 6. 75 no está entre {50,100}; 50 sí, con corrección del nombre.
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 75,
    null, null, null, '', 'prueba-i/x75.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'porcentaje_no_permitido' then raise exception 'FALLO 6a: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', v_c1, 50,
    'Ana María Prueba', '', null, '', 'prueba-i/c1.jpg', 'image/jpeg', 10);
  if not r.ok or r.nuevo_en_revision <> 50 then raise exception 'FALLO 6b: %', r.reason; end if;
  if (select nombre from public.personas where documento = '1136882468') <> 'Ana María Prueba'
     or (select email from public.personas where documento = '1136882468') <> 'ana@example.com' then
    raise exception 'FALLO 6c: corrección mal aplicada';
  end if;
  raise notice 'OK porcentaje permitido y corrección de datos';

  -- 7. Con 50% en revisión el saldo es 50: 100 no; 50 (el saldo) sí; luego nada.
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 100,
    null, null, null, '', 'prueba-i/x100.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'porcentaje_no_permitido' then raise exception 'FALLO 7a: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', v_c2, 50,
    null, null, null, '', 'prueba-i/c2.jpg', 'image/jpeg', 10);
  if not r.ok then raise exception 'FALLO 7b: %', r.reason; end if;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x3.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'sin_saldo' then raise exception 'FALLO 7c: %', r.reason; end if;
  raise notice 'OK nunca más del 100%%';

  -- 8. Verificar suma, rechazar resta, y queda la nota.
  select * into r from public.revisar_comprobante(v_c1, 'verified', 'Banco X');
  if r.nuevo_porcentaje <> 50 then raise exception 'FALLO 8a: %', r.nuevo_porcentaje; end if;
  select * into r from public.revisar_comprobante(v_c2, 'verified', null);
  if r.nuevo_porcentaje <> 100 then raise exception 'FALLO 8b: %', r.nuevo_porcentaje; end if;
  select * into r from public.revisar_comprobante(v_c2, 'rejected', 'Ilegible');
  if r.nuevo_porcentaje <> 50 then raise exception 'FALLO 8c: %', r.nuevo_porcentaje; end if;
  if (select nota_admin from public.comprobantes where id = v_c2) <> 'Ilegible'
     or (select revisado_en from public.comprobantes where id = v_c2) is null then
    raise exception 'FALLO 8d: nota o fecha de revisión';
  end if;
  raise notice 'OK verificar y rechazar recalculan';

  -- 9. El ajuste manual manda hasta volver a automático.
  select * into r from public.ajustar_porcentaje(v_ana, 100);
  if r.nuevo_porcentaje <> 100 then raise exception 'FALLO 9a'; end if;
  perform public.revisar_comprobante(v_c1, 'rejected', null);
  if (select porcentaje_pagado from public.inscripciones where id = v_ana) <> 100 then
    raise exception 'FALLO 9b: el ajuste manual se perdió';
  end if;
  select * into r from public.ajustar_porcentaje(v_ana, null);
  if r.nuevo_porcentaje <> 0 then raise exception 'FALLO 9c: %', r.nuevo_porcentaje; end if;
  raise notice 'OK ajuste manual';

  -- 10. Taller cerrado: ni pagos ni reservas web; el admin sí inscribe.
  update public.talleres set estado = 'cerrado' where id = v_taller;
  select * into r from public.registrar_comprobante(v_taller, '1136882468', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x4.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'cerrado' then raise exception 'FALLO 10a: %', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA06', '4000001', 'CC',
    'Dani Prueba', 'd@example.com', '3004445566', 'X', 'X', 'general', 'Cupo General', null, null, '', 'web', false);
  if r.reason is distinct from 'cerrado' then raise exception 'FALLO 10b: %', r.reason; end if;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA06', '4000001', 'CC',
    'Dani Prueba', '', '', '', '', 'general', 'Cupo General', null, null, '', 'admin', true);
  if not r.ok then raise exception 'FALLO 10c: %', r.reason; end if;
  update public.talleres set estado = 'publicado' where id = v_taller;
  raise notice 'OK taller cerrado';

  -- 11. Sin reserva activa.
  select * into r from public.registrar_comprobante(v_taller, '99999999', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x5.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'sin_inscripcion' then raise exception 'FALLO 11: %', r.reason; end if;
  raise notice 'OK pago sin reserva rechazado';

  -- 12. Cancelada: no admite pagos; al reservar de nuevo se reactiva la misma.
  update public.inscripciones set cancelada = true where id = v_beto;
  select * into r from public.registrar_comprobante(v_taller, '2000001', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/x6.jpg', 'image/jpeg', 10);
  if r.reason is distinct from 'sin_inscripcion' then raise exception 'FALLO 12a: %', r.reason; end if;
  update public.talleres set cupos_total = 10 where id = v_taller;
  select * into r from public.crear_inscripcion(v_taller, 'STA-PRUEBA07', '2000001', 'CE',
    'Beto Prueba', 'beto@example.com', '3002223344', 'Bogotá', 'Residente',
    'general', 'Cupo General', null, null, '', 'web', false);
  if not r.ok or not r.reactivada or r.inscripcion_referencia <> 'STA-PRUEBA04' then
    raise exception 'FALLO 12b: % %', r.reason, r.inscripcion_referencia;
  end if;
  raise notice 'OK cancelar y reactivar';

  -- 13. Eliminar: con pago verificado no; sin él sí, con sus archivos y la
  --     persona que se queda sola.
  perform public.revisar_comprobante(v_c1, 'verified', null);
  select * into r from public.eliminar_inscripcion(v_ana);
  if r.reason is distinct from 'tiene_pagos_verificados' then raise exception 'FALLO 13a: %', r.reason; end if;
  perform public.registrar_comprobante(v_taller, '2000001', gen_random_uuid(), 50,
    null, null, null, '', 'prueba-i/beto.jpg', 'image/jpeg', 10);
  select * into r from public.eliminar_inscripcion(v_beto);
  if not r.ok or r.archivos <> array['prueba-i/beto.jpg'] then
    raise exception 'FALLO 13b: % %', r.reason, r.archivos;
  end if;
  if exists (select 1 from public.personas where documento = '2000001') then
    raise exception 'FALLO 13c: persona huérfana';
  end if;
  raise notice 'OK eliminar inscripción';

  -- 14. Duplicado en el mismo taller (el caso real de producción): se une en
  --     la inscripción del destino con su comprobante y su asistencia.
  insert into public.personas (documento, nombre, email, telefono)
  values (null, 'Ana Prueba', 'ana.vieja@example.com', '3001112233')
  returning id into v_dup_p;
  insert into public.inscripciones (referencia, persona_id, taller_id, tarifa_id, tarifa_nombre, asistio, origen, notas)
  values ('STA-PRUEBA08', v_dup_p, v_taller, 'general', 'Cupo General', true, 'migracion', 'Reservó dos veces')
  returning id into v_dup_i;
  insert into public.comprobantes (inscripcion_id, porcentaje, estado, file_path, file_type, file_size)
  values (v_dup_i, 50, 'verified', 'prueba-i/dup.jpg', 'image/jpeg', 10);

  select * into r from public.fusionar_personas(v_dup_p, (select persona_id from public.inscripciones where id = v_ana));
  if not r.ok then raise exception 'FALLO 14a: %', r.reason; end if;
  if exists (select 1 from public.personas where id = v_dup_p)
     or exists (select 1 from public.inscripciones where id = v_dup_i) then
    raise exception 'FALLO 14b: el duplicado sigue ahí';
  end if;
  select notas into v_notas from public.inscripciones where id = v_ana;
  if not (select asistio from public.inscripciones where id = v_ana) or v_notas not like '%STA-PRUEBA08%' then
    raise exception 'FALLO 14c: asistencia o nota';
  end if;
  if (select porcentaje_pagado from public.inscripciones where id = v_ana) <> 100 then
    raise exception 'FALLO 14d: el comprobante del duplicado no sumó';
  end if;
  raise notice 'OK fusionar duplicados del mismo taller';

  -- 15. El destino sin documento hereda el del origen; misma persona: no.
  insert into public.personas (documento, nombre) values (null, 'Sin Doc') returning id into v_dup_p;
  select * into r from public.fusionar_personas((select id from public.personas where documento = '3000001'), v_dup_p);
  if not r.ok or (select documento from public.personas where id = v_dup_p) is distinct from '3000001' then
    raise exception 'FALLO 15a: %', r.reason;
  end if;
  select * into r from public.fusionar_personas(v_dup_p, v_dup_p);
  if r.reason is distinct from 'misma_persona' then raise exception 'FALLO 15b'; end if;
  raise notice 'OK fusionar hereda el documento';

  -- 16. Solo service_role ejecuta las funciones.
  if has_function_privilege('anon', 'public.crear_inscripcion(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_comprobante(uuid,text,uuid,integer,text,text,text,text,text,text,integer)', 'execute')
     or has_function_privilege('anon', 'public.consultar_inscripcion(uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.fusionar_personas(uuid,uuid)', 'execute') then
    raise exception 'FALLO 16: permisos de las funciones';
  end if;
  raise notice 'OK permisos';
end
$$;

rollback;
```

- [ ] **Step 5: Adaptar `supabase/tests/talleres.sql` a la función nueva**

Sustituye las líneas 1–2 de la cabecera:

```sql
-- Pruebas de las reglas de `talleres`. Ejecutar SOLO en un proyecto de prueba
-- que ya tenga `schema.sql` y la migración 20261013_01 aplicados. Todo corre
```

por:

```sql
-- Pruebas de las reglas de `talleres`. Ejecutar SOLO en una base de prueba con
-- `schema.sql` y las migraciones de `supabase/migrations/` aplicadas. Todo corre
```

Y sustituye el bloque que va desde `  -- 6. Reserva en publicado con cupo: ok; la segunda: sold_out.` hasta `  raise notice 'OK publicado vencido no acepta reservas';` (ambas incluidas) por:

```sql
  -- 6. Reserva en publicado con cupo: ok; la segunda: sin_cupos.
  select reason into v_reason from public.crear_inscripcion(
    (select id from public.talleres where slug = 'prueba-a'), 'STA-TEST0001', '900001', 'CC',
    'Prueba Uno', 'p@example.com', '3000000000', 'C', 'P', 'general', 'Cupo General', null, null, '', 'web', false);
  if v_reason is not null then raise exception 'FALLO: reserva rechazada (%)', v_reason; end if;

  select reason into v_reason from public.crear_inscripcion(
    (select id from public.talleres where slug = 'prueba-a'), 'STA-TEST0002', '900002', 'CC',
    'Prueba Dos', 'p@example.com', '3000000000', 'C', 'P', 'general', 'Cupo General', null, null, '', 'web', false);
  if v_reason is distinct from 'sin_cupos' then raise exception 'FALLO: esperaba sin_cupos, llegó %', v_reason; end if;
  raise notice 'OK cupo respetado';

  -- 7. Taller cerrado: cerrado.
  update public.talleres set estado = 'cerrado', cupos_total = 10 where slug = 'prueba-a';
  select reason into v_reason from public.crear_inscripcion(
    (select id from public.talleres where slug = 'prueba-a'), 'STA-TEST0003', '900003', 'CC',
    'Prueba Tres', 'p@example.com', '3000000000', 'C', 'P', 'general', 'Cupo General', null, null, '', 'web', false);
  if v_reason is distinct from 'cerrado' then raise exception 'FALLO: esperaba cerrado, llegó %', v_reason; end if;
  raise notice 'OK cerrado no acepta reservas';

  -- 8. Publicado pero con fecha pasada: cerrado.
  update public.talleres
     set estado = 'publicado', fecha_inicio = '2020-01-01', fecha_fin = '2020-01-02'
   where slug = 'prueba-a';
  select reason into v_reason from public.crear_inscripcion(
    (select id from public.talleres where slug = 'prueba-a'), 'STA-TEST0004', '900004', 'CC',
    'Prueba Cuatro', 'p@example.com', '3000000000', 'C', 'P', 'general', 'Cupo General', null, null, '', 'web', false);
  if v_reason is distinct from 'cerrado' then raise exception 'FALLO: esperaba cerrado por fecha, llegó %', v_reason; end if;
  raise notice 'OK publicado vencido no acepta reservas';
```

- [ ] **Step 6: Verificaciones de solo lectura para `migrar.sh`**

`supabase/verificaciones/20261013_01_talleres.sql` (lo que `migrar.sh` mostraba antes, ahora en archivo):

```sql
-- Solo lectura. scripts/migrar.sh lo ejecuta después de 20261013_01_talleres.sql.
select slug, estado, titulo, titulo_acento, fecha_inicio, fecha_fin, cupos_total from public.talleres;
select * from public.talleres_disponibilidad;
```

`supabase/verificaciones/antes_20261015_01_inscripciones.sql`:

```sql
-- Solo lectura. scripts/migrar.sh lo muestra ANTES de pedir confirmación.
-- Ningún taller debe estar 'publicado' (ver «Orden de despliegue» del plan) y
-- no debe haber comprobantes sin reserva (la migración abortaría).
select slug, estado, fecha_inicio, fecha_fin from public.talleres order by fecha_inicio;
select count(*) as reservas,
       count(*) filter (where status = 'confirmed') as confirmadas,
       count(*) filter (where status = 'cancelled') as canceladas,
       count(*) filter (where document is not null) as con_documento
  from public.reservations;
select count(*) as comprobantes,
       count(*) filter (where reservation_id is null) as sin_reserva
  from public.payment_proofs;
```

`supabase/verificaciones/20261015_01_inscripciones.sql`:

```sql
-- Solo lectura. scripts/migrar.sh lo ejecuta después de aplicar la migración.
-- inscripciones = _legacy_reservations y comprobantes = _legacy_payment_proofs.
select 'inscripciones' as tabla, count(*) as filas from public.inscripciones
union all select '_legacy_reservations', count(*) from public._legacy_reservations
union all select 'comprobantes', count(*) from public.comprobantes
union all select '_legacy_payment_proofs', count(*) from public._legacy_payment_proofs
union all select 'personas', count(*) from public.personas
union all select 'personas por identificar', count(*) from public.personas where documento is null;
select referencia, nombre, documento, porcentaje_pagado, porcentaje_manual, porcentaje_en_revision,
       cancelada, asistio
  from public.inscritos_admin
 order by creado_en;
select * from public.talleres_disponibilidad;
```

- [ ] **Step 7: Generalizar `scripts/migrar.sh`**

Reemplaza el archivo entero por:

```bash
#!/usr/bin/env bash
# Aplica UNA migración de supabase/migrations/ a TU base de Supabase.
#
# Uso:
#   SUPABASE_DB_URL='postgresql://postgres:TU_CLAVE@HOST:5432/postgres' ./scripts/migrar.sh [archivo]
#
#   archivo: ruta de la migración, relativa a la raíz del repo o absoluta.
#            Sin argumento se toma la MÁS RECIENTE de supabase/migrations/
#            (orden por nombre). Pasa siempre la ruta cuando haya una
#            migración que todavía no toca aplicar.
#
# Si existe supabase/verificaciones/antes_<archivo>, se muestra antes de pedir
# confirmación (consultas de solo lectura sobre el punto de partida). Si existe
# supabase/verificaciones/<archivo>, se ejecuta después.
#
# Dónde sacar la URL: Supabase → Project Settings → Database → Connection string
# → pestaña URI. Recomendado: el "Session pooler" (los hosts de conexión directa
# son solo IPv6 y suelen fallar desde Docker en macOS). Sustituye
# [YOUR-PASSWORD] por la contraseña de la base de datos.
#
# Usa `psql` si está instalado; si no, Docker (imagen postgres:16).
# Antes de ejecutar, haz un backup en Supabase → Database → Backups.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -gt 0 ]; then
  case "$1" in
    /*) ARCHIVO="$1" ;;
    *) ARCHIVO="$RAIZ/$1" ;;
  esac
else
  ULTIMA="$(ls "$RAIZ/supabase/migrations" | grep '\.sql$' | sort | tail -n 1)"
  ARCHIVO="$RAIZ/supabase/migrations/$ULTIMA"
fi

NOMBRE="$(basename "$ARCHIVO")"
ANTES="$RAIZ/supabase/verificaciones/antes_$NOMBRE"
DESPUES="$RAIZ/supabase/verificaciones/$NOMBRE"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: falta SUPABASE_DB_URL." >&2
  echo "Uso: SUPABASE_DB_URL='postgresql://...' ./scripts/migrar.sh [archivo]" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO" ]; then
  echo "Error: no existe $ARCHIVO" >&2
  exit 1
fi

# Ejecuta SQL (por stdin o con -c) contra la base, sin mostrar nunca la URL.
if command -v psql >/dev/null 2>&1; then
  MODO="psql local"
  correr_sql() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 "$@"; }
elif command -v docker >/dev/null 2>&1; then
  MODO="Docker (postgres:16)"
  # --network host no existe en Docker Desktop de Mac; se usa la red por defecto.
  correr_sql() { docker run --rm -i -e SUPABASE_DB_URL postgres:16 \
    sh -c 'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 "$@"' sh "$@"; }
else
  echo "Error: no hay psql ni docker. Instala uno de los dos." >&2
  exit 1
fi

if [ -f "$ANTES" ]; then
  echo "Punto de partida (solo lectura):"
  correr_sql < "$ANTES" || echo "(La comprobación previa falló: ¿la migración ya estaba aplicada?)"
  echo
fi

echo "Se va a aplicar:"
echo "  archivo: ${ARCHIVO#"$RAIZ"/}"
echo "  destino: la base indicada en SUPABASE_DB_URL (no se muestra)"
echo "  cliente: $MODO"
echo "La migración es idempotente y corre dentro de una transacción."
echo
printf 'Escribe "si" para continuar: '
read -r RESPUESTA
if [ "$RESPUESTA" != "si" ]; then
  echo "Cancelado. No se cambió nada."
  exit 1
fi

echo
echo "Aplicando migración..."
correr_sql < "$ARCHIVO"

if [ -f "$DESPUES" ]; then
  echo
  echo "Verificación:"
  correr_sql < "$DESPUES"
fi

echo
echo "Listo."
```

- [ ] **Step 8: Script de prueba local**

`scripts/probar-migraciones.sh`:

```bash
#!/usr/bin/env bash
# Prueba el esquema y TODAS las migraciones en un Postgres 16 desechable
# (Docker). Nunca toca Supabase.
#
# Uso: ./scripts/probar-migraciones.sh
#
# Orden: esquema inicial → etapa 1 → semilla con filas como las de producción
# → cada migración posterior DOS veces (idempotencia) → pruebas de
# supabase/tests/. Cualquier error corta el script (ON_ERROR_STOP).

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENEDOR="pg-sta-prueba"
ETAPA1="supabase/migrations/20261013_01_talleres.sql"

docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
docker run --rm -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=x postgres:16 >/dev/null
trap 'docker stop "$CONTENEDOR" >/dev/null 2>&1 || true' EXIT

# La imagen arranca un servidor temporal para inicializarse y lo reinicia:
# hay que esperar a que termine ese primer arranque, no solo a que responda.
for _ in $(seq 1 60); do
  if docker logs "$CONTENEDOR" 2>&1 | grep -q "PostgreSQL init process complete"; then
    docker exec "$CONTENEDOR" pg_isready -U postgres -q && break
  fi
  sleep 1
done

sql() { docker exec -i "$CONTENEDOR" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
archivo() { echo "== $1"; sql < "$RAIZ/$1"; }

# Lo mínimo de Supabase que el esquema da por hecho: roles y storage.buckets.
sql -c "create role anon; create role authenticated; create role service_role;
        create schema storage;
        create table storage.buckets (id text primary key, name text, public boolean,
          file_size_limit bigint, allowed_mime_types text[]);"

archivo supabase/schema.sql
archivo "$ETAPA1"
archivo supabase/tests/semilla_produccion.sql

for m in "$RAIZ"/supabase/migrations/*.sql; do
  rel="supabase/migrations/$(basename "$m")"
  [ "$rel" = "$ETAPA1" ] && continue
  archivo "$rel"
  archivo "$rel"   # idempotencia
done

for t in migracion_inscripciones talleres inscripciones certificados; do
  if [ -f "$RAIZ/supabase/tests/$t.sql" ]; then archivo "supabase/tests/$t.sql"; fi
done

echo "Todo en verde."
```

Run: `chmod +x scripts/probar-migraciones.sh scripts/migrar.sh`

- [ ] **Step 9: Probar en Docker**

Run: `LOG=$(mktemp); ./scripts/probar-migraciones.sh 2>&1 | tee "$LOG"; grep -c 'NOTICE:  OK' "$LOG"; grep -E 'FALLO|ERROR' "$LOG" || true`
Expected: termina con `Todo en verde.`; el conteo de `NOTICE:  OK` es **36** (11 de `migracion_inscripciones.sql` + 9 de `talleres.sql` + 16 de `inscripciones.sql`); el último `grep` no imprime nada. Aparecen además avisos `NOTICE: … already exists, skipping` de la segunda pasada: son esperables.

Si falla, corrige la migración o la prueba (nunca relajes una comprobación para que pase) y repite.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261015_01_inscripciones.sql supabase/tests supabase/verificaciones scripts/migrar.sh scripts/probar-migraciones.sh
git commit -m "feat(db): personas, inscripciones y comprobantes con migración de las reservas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

No apliques nada en producción: eso es la Task 8.

---

### Task 4: Capa de datos de inscripciones

**Files:**
- Create: `src/lib/inscripciones/mapeo.ts`, `src/lib/inscripciones/consulta.ts`, `src/lib/inscripciones/repo.ts`, `src/lib/inscripciones/comprobantes.ts`
- Test: `src/lib/inscripciones/__tests__/mapeo.test.ts`, `src/lib/inscripciones/__tests__/consulta.test.ts`
- Modify: `src/lib/talleres/vista.ts` (campo `id`), `src/lib/talleres/__tests__/vista.test.ts`, `src/lib/talleres/repo.ts` (`contarInscripciones` por id), `src/lib/talleres/publico.ts` (`tallerIdParaAdmin`), `src/app/admin/talleres/[id]/page.tsx:37`

**Interfaces:**
- Consumes (Task 1–3): tipos, `enmascarar*`, `porcentajesDisponibles`, `OpcionPago`, `motivoDesdeReason`, `motivoDesdeErrorPg`, `MotivoInscripcion`, `Correcciones`; vistas y funciones SQL de Task 3; `PROOF_BUCKET`, `ProofFile` de `src/lib/reservations/payment-proofs.ts`; `getSupabase()`.
- Produces (`mapeo.ts`): `aTipoDocumento(v: string | null | undefined): TipoDocumento`, `FilaPersona`, `COLUMNAS_PERSONA`, `filaAPersona(f): Persona`, `FilaInscrito`, `COLUMNAS_INSCRITO`, `filaAInscrito(f): Inscrito`, `FilaComprobante`, `COLUMNAS_COMPROBANTE`, `filaAComprobante(f): ComprobanteAdmin`.
- Produces (`consulta.ts`): `FilaConsulta` (fila de `consultar_inscripcion`), `ConsultaPago = { nombre: string; email: string; telefono: string; pagado: number; enRevision: number; opciones: OpcionPago[]; monto: number | null; moneda: string | null }`, `respuestaConsulta(f: FilaConsulta, permitidos: readonly number[], preciosPublicados: boolean): ConsultaPago`.
- Produces (`repo.ts`): `Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoInscripcion }`, `NuevaInscripcion`, `InscripcionCreada = { inscripcionId: string; referencia: string; reactivada: boolean }`, `crearInscripcion(n: NuevaInscripcion): Promise<Resultado<InscripcionCreada>>`, `consultarInscripcion(tallerId: string, documento: string): Promise<Resultado<FilaConsulta | null>>`, `listarInscritos(tallerId: string): Promise<Inscrito[] | null>`, `buscarPersona(documento: string): Promise<Resultado<Persona | null>>`, `actualizarPersona(id: string, d: DatosPersona): Promise<Resultado<null>>`, `marcarAsistencia(ids: string[], asistio: boolean): Promise<Resultado<number>>`, `cambiarCancelada(id: string, cancelada: boolean): Promise<Resultado<null>>`, `ajustarPorcentaje(id: string, porcentaje: number | null): Promise<Resultado<number>>`, `eliminarInscripcion(id: string): Promise<Resultado<null>>`, `fusionarPersonas(origen: string, destino: string): Promise<Resultado<null>>`, `listarComprobantes(f: { estado: EstadoComprobante | "todos"; tallerId: string | null }): Promise<ComprobanteAdmin[] | null>`, `revisarComprobante(id: string, estado: EstadoComprobante, nota: string): Promise<Resultado<number>>`, `urlFirmadaComprobante(id: string): Promise<string | null>`, `ResumenInicio = { comprobantesPorRevisar: number; porIdentificar: number; pagoIncompleto: number | null }`, `resumenInicio(tallerId: string | null): Promise<ResumenInicio | null>`.
- Produces (`comprobantes.ts`): `NuevoComprobante = { tallerId: string; tallerSlug: string; documento: string; porcentaje: number; correcciones: Correcciones; notas: string; archivo: ProofFile }`, `guardarComprobante(c: NuevoComprobante): Promise<Resultado<{ referencia: string; enRevision: number }>>`.
- Produces (talleres): `TallerVista.id: string`; `contarInscripciones(tallerId: string): Promise<number | null>`; `tallerIdParaAdmin(param: string | undefined): Promise<string | null>`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

`src/lib/inscripciones/__tests__/mapeo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filaAComprobante, filaAInscrito, type FilaComprobante, type FilaInscrito } from "../mapeo";

const fila: FilaInscrito = {
  id: "i1",
  referencia: "STA-AAAA1111",
  taller_id: "t1",
  persona_id: "p1",
  documento: "1136882468",
  tipo_documento: "CC",
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "3001112233",
  ciudad: null,
  profesion: null,
  tarifa_nombre: "Cupo General",
  monto: 350000,
  moneda: "COP",
  porcentaje_pagado: 50,
  porcentaje_manual: false,
  porcentaje_en_revision: 50,
  comprobantes_verificados: 1,
  cancelada: false,
  asistio: true,
  origen: "web",
  notas: "",
  creado_en: "2026-10-01T10:00:00Z",
};

describe("filaAInscrito", () => {
  it("arma la persona; sin columnas de la etapa 3 no hay certificado", () => {
    const i = filaAInscrito(fila);
    expect(i.persona).toEqual({
      id: "p1",
      documento: "1136882468",
      tipoDocumento: "CC",
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "3001112233",
      ciudad: null,
      profesion: null,
    });
    expect(i.porcentajeEnRevision).toBe(50);
    expect(i.certificado).toBeNull();
  });

  it("con certificado", () => {
    const i = filaAInscrito({ ...fila, certificado_codigo: "C-ABCD-EFGH", certificado_revocado: true });
    expect(i.certificado).toEqual({ codigo: "C-ABCD-EFGH", revocado: true });
  });

  it("tipo de documento desconocido = OTRO", () => {
    expect(filaAInscrito({ ...fila, tipo_documento: "XX" }).persona.tipoDocumento).toBe("OTRO");
  });
});

describe("filaAComprobante", () => {
  it("pasa a camelCase", () => {
    const f: FilaComprobante = {
      id: "c1",
      inscripcion_id: "i1",
      referencia: "STA-AAAA1111",
      taller_id: "t1",
      taller_nombre: "Taller · Octubre",
      persona_nombre: "Ana Pérez",
      persona_documento: null,
      persona_tipo_documento: "CC",
      porcentaje: 50,
      estado: "pending",
      notas: "Banco X",
      nota_admin: null,
      file_type: "image/jpeg",
      file_size: 1000,
      creado_en: "2026-10-01T10:00:00Z",
      revisado_en: null,
      porcentaje_pagado: 0,
      porcentaje_manual: false,
    };
    expect(filaAComprobante(f)).toEqual({
      id: "c1",
      inscripcionId: "i1",
      referencia: "STA-AAAA1111",
      tallerId: "t1",
      tallerNombre: "Taller · Octubre",
      personaNombre: "Ana Pérez",
      personaDocumento: null,
      personaTipoDocumento: "CC",
      porcentaje: 50,
      estado: "pending",
      notas: "Banco X",
      notaAdmin: null,
      fileType: "image/jpeg",
      fileSize: 1000,
      creadoEn: "2026-10-01T10:00:00Z",
      revisadoEn: null,
      porcentajePagado: 0,
      porcentajeManual: false,
    });
  });
});
```

`src/lib/inscripciones/__tests__/consulta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { respuestaConsulta, type FilaConsulta } from "../consulta";

const fila: FilaConsulta = {
  inscripcion_id: "8f1c0000-0000-0000-0000-000000000001",
  referencia: "STA-ABCD1234",
  tipo_documento: "CC",
  nombre: "Luis Fernández",
  email: "luis.fer@gmail.com",
  telefono: "+57 300 123 4512",
  monto: 350000,
  moneda: "COP",
  porcentaje_pagado: 50,
  porcentaje_en_revision: 0,
};

describe("respuestaConsulta", () => {
  it("enmascara los datos y calcula las opciones", () => {
    expect(respuestaConsulta(fila, [50, 100], true)).toEqual({
      nombre: "Lu** Fer******",
      email: "lu***@gmail.com",
      telefono: "*** *** **12",
      pagado: 50,
      enRevision: 0,
      opciones: [{ porcentaje: 50, etiqueta: "Saldo restante (50%)" }],
      monto: 350000,
      moneda: "COP",
    });
  });

  it("no deja nada en claro", () => {
    const json = JSON.stringify(respuestaConsulta(fila, [50, 100], true));
    for (const secreto of ["Fernández", "Luis", "luis.fer", "3001234", "4512", "STA-ABCD1234", fila.inscripcion_id])
      expect(json).not.toContain(secreto);
  });

  it("sin precios publicados no manda el monto", () => {
    const r = respuestaConsulta(fila, [50, 100], false);
    expect(r.monto).toBeNull();
    expect(r.moneda).toBeNull();
  });
});
```

Run: `npx vitest run src/lib/inscripciones/__tests__/mapeo.test.ts src/lib/inscripciones/__tests__/consulta.test.ts`
Expected: FAIL — no se resuelven `../mapeo` y `../consulta`.

- [ ] **Step 2: Implementar `mapeo.ts`**

`src/lib/inscripciones/mapeo.ts`:

```ts
import {
  TIPOS_DOCUMENTO,
  type ComprobanteAdmin,
  type EstadoComprobante,
  type Inscrito,
  type Origen,
  type Persona,
  type TipoDocumento,
} from "./tipos";

/** Un valor desconocido no rompe la lista: se muestra como «Otro». */
export function aTipoDocumento(v: string | null | undefined): TipoDocumento {
  return (TIPOS_DOCUMENTO as readonly string[]).includes(v ?? "") ? (v as TipoDocumento) : "OTRO";
}

/** Fila de `public.personas`. */
export type FilaPersona = {
  id: string;
  documento: string | null;
  tipo_documento: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  profesion: string | null;
};

export const COLUMNAS_PERSONA = "id, documento, tipo_documento, nombre, email, telefono, ciudad, profesion";

export function filaAPersona(f: FilaPersona): Persona {
  return {
    id: f.id,
    documento: f.documento,
    tipoDocumento: aTipoDocumento(f.tipo_documento),
    nombre: f.nombre,
    email: f.email,
    telefono: f.telefono,
    ciudad: f.ciudad,
    profesion: f.profesion,
  };
}

/** Fila de la vista `public.inscritos_admin`. */
export type FilaInscrito = {
  id: string;
  referencia: string;
  taller_id: string;
  persona_id: string;
  documento: string | null;
  tipo_documento: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  profesion: string | null;
  tarifa_nombre: string;
  monto: number | null;
  moneda: string | null;
  porcentaje_pagado: number;
  porcentaje_manual: boolean;
  porcentaje_en_revision: number;
  comprobantes_verificados: number;
  cancelada: boolean;
  asistio: boolean;
  origen: Origen;
  notas: string;
  creado_en: string;
  /** Columnas que la etapa 3 añade a la vista. */
  certificado_codigo?: string | null;
  certificado_revocado?: boolean | null;
};

/** Columnas de `inscritos_admin`. La etapa 3 añade las del certificado. */
export const COLUMNAS_INSCRITO =
  "id, referencia, taller_id, persona_id, documento, tipo_documento, nombre, email, telefono, ciudad, profesion, tarifa_nombre, monto, moneda, porcentaje_pagado, porcentaje_manual, porcentaje_en_revision, comprobantes_verificados, cancelada, asistio, origen, notas, creado_en";

export function filaAInscrito(f: FilaInscrito): Inscrito {
  return {
    id: f.id,
    referencia: f.referencia,
    tallerId: f.taller_id,
    persona: filaAPersona({
      id: f.persona_id,
      documento: f.documento,
      tipo_documento: f.tipo_documento,
      nombre: f.nombre,
      email: f.email,
      telefono: f.telefono,
      ciudad: f.ciudad,
      profesion: f.profesion,
    }),
    tarifaNombre: f.tarifa_nombre,
    monto: f.monto,
    moneda: f.moneda,
    porcentajePagado: f.porcentaje_pagado,
    porcentajeManual: f.porcentaje_manual,
    porcentajeEnRevision: f.porcentaje_en_revision,
    comprobantesVerificados: f.comprobantes_verificados,
    cancelada: f.cancelada,
    asistio: f.asistio,
    origen: f.origen,
    notas: f.notas,
    creadoEn: f.creado_en,
    certificado: f.certificado_codigo
      ? { codigo: f.certificado_codigo, revocado: Boolean(f.certificado_revocado) }
      : null,
  };
}

/** Fila de la vista `public.comprobantes_admin` (sin `file_path`: no sale del servidor). */
export type FilaComprobante = {
  id: string;
  inscripcion_id: string;
  referencia: string;
  taller_id: string;
  taller_nombre: string;
  persona_nombre: string;
  persona_documento: string | null;
  persona_tipo_documento: string;
  porcentaje: number;
  estado: EstadoComprobante;
  notas: string;
  nota_admin: string | null;
  file_type: string;
  file_size: number;
  creado_en: string;
  revisado_en: string | null;
  porcentaje_pagado: number;
  porcentaje_manual: boolean;
};

export const COLUMNAS_COMPROBANTE =
  "id, inscripcion_id, referencia, taller_id, taller_nombre, persona_nombre, persona_documento, persona_tipo_documento, porcentaje, estado, notas, nota_admin, file_type, file_size, creado_en, revisado_en, porcentaje_pagado, porcentaje_manual";

export function filaAComprobante(f: FilaComprobante): ComprobanteAdmin {
  return {
    id: f.id,
    inscripcionId: f.inscripcion_id,
    referencia: f.referencia,
    tallerId: f.taller_id,
    tallerNombre: f.taller_nombre,
    personaNombre: f.persona_nombre,
    personaDocumento: f.persona_documento,
    personaTipoDocumento: aTipoDocumento(f.persona_tipo_documento),
    porcentaje: f.porcentaje,
    estado: f.estado,
    notas: f.notas,
    notaAdmin: f.nota_admin,
    fileType: f.file_type,
    fileSize: f.file_size,
    creadoEn: f.creado_en,
    revisadoEn: f.revisado_en,
    porcentajePagado: f.porcentaje_pagado,
    porcentajeManual: f.porcentaje_manual,
  };
}
```

- [ ] **Step 3: Implementar `consulta.ts`**

`src/lib/inscripciones/consulta.ts`:

```ts
import { enmascararEmail, enmascararNombre, enmascararTelefono } from "./documento";
import { porcentajesDisponibles, type OpcionPago } from "./pagos";

/** Fila que devuelve `public.consultar_inscripcion`. Nunca sale del servidor tal cual. */
export type FilaConsulta = {
  inscripcion_id: string;
  referencia: string;
  tipo_documento: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  monto: number | null;
  moneda: string | null;
  porcentaje_pagado: number;
  porcentaje_en_revision: number;
};

/**
 * Lo único que viaja al navegador en el paso 1 del pago. Quien escriba un
 * documento ajeno solo ve iniciales y dos dígitos: suficiente para que la
 * persona se reconozca, inútil para quien busca datos. Ni la referencia ni el
 * id de la inscripción salen de aquí: el paso 2 vuelve a buscar por documento.
 */
export type ConsultaPago = {
  nombre: string;
  email: string;
  telefono: string;
  pagado: number;
  enRevision: number;
  opciones: OpcionPago[];
  monto: number | null;
  moneda: string | null;
};

export function respuestaConsulta(
  f: FilaConsulta,
  permitidos: readonly number[],
  preciosPublicados: boolean,
): ConsultaPago {
  return {
    nombre: enmascararNombre(f.nombre),
    email: enmascararEmail(f.email),
    telefono: enmascararTelefono(f.telefono),
    pagado: f.porcentaje_pagado,
    enRevision: f.porcentaje_en_revision,
    opciones: porcentajesDisponibles(permitidos, f.porcentaje_pagado, f.porcentaje_en_revision),
    monto: preciosPublicados ? f.monto : null,
    moneda: preciosPublicados ? f.moneda : null,
  };
}
```

Run: `npx vitest run src/lib/inscripciones`
Expected: PASS.

- [ ] **Step 4: Implementar `repo.ts`**

`src/lib/inscripciones/repo.ts`:

```ts
import { PROOF_BUCKET } from "@/lib/reservations/payment-proofs";
import { getSupabase } from "@/lib/reservations/supabase";
import type { FilaConsulta } from "./consulta";
import { motivoDesdeErrorPg, motivoDesdeReason, type MotivoInscripcion } from "./errores";
import {
  COLUMNAS_COMPROBANTE,
  COLUMNAS_INSCRITO,
  COLUMNAS_PERSONA,
  filaAComprobante,
  filaAInscrito,
  filaAPersona,
  type FilaComprobante,
  type FilaInscrito,
  type FilaPersona,
} from "./mapeo";
import type { ComprobanteAdmin, DatosPersona, EstadoComprobante, Inscrito, Persona } from "./tipos";

/**
 * Único módulo que lee y escribe personas, inscripciones y comprobantes. Solo
 * servidor: usa la clave `service_role`. Las reglas viven en las funciones SQL
 * de `supabase/migrations/20261015_01_inscripciones.sql`; aquí solo se
 * traducen sus respuestas.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoInscripcion };

const fallo = (motivo: MotivoInscripcion) => ({ ok: false, motivo }) as const;

/** Las funciones SQL son `returns table`: la respuesta es una fila dentro de un array. */
function primera<T>(data: unknown): T | null {
  return (data as T[] | null)?.[0] ?? null;
}

export type NuevaInscripcion = {
  tallerId: string;
  referencia: string;
  persona: DatosPersona;
  tarifa: { id: string; nombre: string };
  monto: number | null;
  moneda: string | null;
  notas: string;
  origen: "web" | "admin";
  /** Solo el admin puede inscribir por encima del cupo. */
  forzarCupo: boolean;
};

export type InscripcionCreada = { inscripcionId: string; referencia: string; reactivada: boolean };

type FilaCrear = {
  ok: boolean;
  reason: string | null;
  inscripcion_id: string | null;
  inscripcion_referencia: string | null;
  reactivada: boolean;
};

export async function crearInscripcion(n: NuevaInscripcion): Promise<Resultado<InscripcionCreada>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");

  const { data, error } = await supabase.rpc("crear_inscripcion", {
    p_taller_id: n.tallerId,
    p_referencia: n.referencia,
    p_documento: n.persona.documento,
    p_tipo_documento: n.persona.tipoDocumento,
    p_nombre: n.persona.nombre,
    p_email: n.persona.email ?? "",
    p_telefono: n.persona.telefono ?? "",
    p_ciudad: n.persona.ciudad ?? "",
    p_profesion: n.persona.profesion ?? "",
    p_tarifa_id: n.tarifa.id,
    p_tarifa_nombre: n.tarifa.nombre,
    p_monto: n.monto,
    p_moneda: n.moneda,
    p_notas: n.notas,
    p_origen: n.origen,
    p_forzar_cupo: n.forzarCupo,
  });

  const fila = primera<FilaCrear>(data);
  if (error || !fila) {
    // Se deja la inscripción completa en los logs para poder recuperarla a
    // mano: la persona ya vio su referencia en pantalla.
    console.error("[inscripciones] no se pudo crear", { referencia: n.referencia, error, inscripcion: n });
    return fallo("error");
  }
  if (fila.ok && fila.inscripcion_id && fila.inscripcion_referencia) {
    return {
      ok: true,
      valor: {
        inscripcionId: fila.inscripcion_id,
        referencia: fila.inscripcion_referencia,
        reactivada: fila.reactivada,
      },
    };
  }
  return fallo(motivoDesdeReason(fila.reason));
}

export async function consultarInscripcion(
  tallerId: string,
  documento: string,
): Promise<Resultado<FilaConsulta | null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("consultar_inscripcion", {
    p_taller_id: tallerId,
    p_documento: documento,
  });
  if (error) {
    console.error("[inscripciones] no se pudo consultar", { tallerId, error });
    return fallo("error");
  }
  return { ok: true, valor: primera<FilaConsulta>(data) };
}

export async function listarInscritos(tallerId: string): Promise<Inscrito[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inscritos_admin")
    .select(COLUMNAS_INSCRITO)
    .eq("taller_id", tallerId)
    .order("creado_en");
  if (error) {
    console.error("[inscripciones] no se pudo listar", { tallerId, error });
    return null;
  }
  return (data as unknown as FilaInscrito[]).map(filaAInscrito);
}

export async function buscarPersona(documento: string): Promise<Resultado<Persona | null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("personas")
    .select(COLUMNAS_PERSONA)
    .eq("documento", documento)
    .maybeSingle<FilaPersona>();
  if (error) {
    console.error("[inscripciones] no se pudo buscar la persona", { error });
    return fallo("error");
  }
  return { ok: true, valor: data ? filaAPersona(data) : null };
}

export async function actualizarPersona(id: string, d: DatosPersona): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("personas")
    .update({
      documento: d.documento,
      tipo_documento: d.tipoDocumento,
      nombre: d.nombre,
      email: d.email,
      telefono: d.telefono,
      ciudad: d.ciudad,
      profesion: d.profesion,
    })
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code !== "23505") console.error("[inscripciones] no se pudo editar la persona", { id, error });
    return fallo(motivoDesdeErrorPg(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

export async function marcarAsistencia(ids: string[], asistio: boolean): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("inscripciones").update({ asistio }).in("id", ids).select("id");
  if (error) {
    console.error("[inscripciones] no se pudo marcar asistencia", { ids, error });
    return fallo(motivoDesdeErrorPg(error));
  }
  return { ok: true, valor: data.length };
}

export async function cambiarCancelada(id: string, cancelada: boolean): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("inscripciones").update({ cancelada }).eq("id", id).select("id");
  if (error) {
    console.error("[inscripciones] no se pudo cancelar/reactivar", { id, error });
    return fallo(motivoDesdeErrorPg(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

type FilaPorcentaje = { ok: boolean; reason: string | null; nuevo_porcentaje: number | null };

export async function ajustarPorcentaje(id: string, porcentaje: number | null): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("ajustar_porcentaje", {
    p_inscripcion_id: id,
    p_porcentaje: porcentaje,
  });
  const fila = primera<FilaPorcentaje>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo ajustar el porcentaje", { id, error });
    return fallo("error");
  }
  return fila.ok && fila.nuevo_porcentaje !== null
    ? { ok: true, valor: fila.nuevo_porcentaje }
    : fallo(motivoDesdeReason(fila.reason));
}

type FilaEliminar = { ok: boolean; reason: string | null; archivos: string[] | null };

export async function eliminarInscripcion(id: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("eliminar_inscripcion", { p_inscripcion_id: id });
  const fila = primera<FilaEliminar>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo eliminar", { id, error });
    return fallo("error");
  }
  if (!fila.ok) return fallo(motivoDesdeReason(fila.reason));

  // La fila ya no existe: si el bucket falla, el archivo queda huérfano pero
  // nada lo enlaza. Se registra para limpiarlo a mano.
  if (fila.archivos?.length) {
    const borrado = await supabase.storage.from(PROOF_BUCKET).remove(fila.archivos);
    if (borrado.error) console.error("[inscripciones] archivos sin borrar", { archivos: fila.archivos, error: borrado.error });
  }
  return { ok: true, valor: null };
}

type FilaOk = { ok: boolean; reason: string | null };

export async function fusionarPersonas(origen: string, destino: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("fusionar_personas", { p_origen: origen, p_destino: destino });
  const fila = primera<FilaOk>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo fusionar", { origen, destino, error });
    return fallo("error");
  }
  return fila.ok ? { ok: true, valor: null } : fallo(motivoDesdeReason(fila.reason));
}

export async function listarComprobantes(f: {
  estado: EstadoComprobante | "todos";
  tallerId: string | null;
}): Promise<ComprobanteAdmin[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  let consulta = supabase.from("comprobantes_admin").select(COLUMNAS_COMPROBANTE);
  if (f.estado !== "todos") consulta = consulta.eq("estado", f.estado);
  if (f.tallerId) consulta = consulta.eq("taller_id", f.tallerId);
  const { data, error } = await consulta.order("creado_en", { ascending: false }).limit(200);
  if (error) {
    console.error("[inscripciones] no se pudieron listar los comprobantes", { f, error });
    return null;
  }
  return (data as unknown as FilaComprobante[]).map(filaAComprobante);
}

export async function revisarComprobante(
  id: string,
  estado: EstadoComprobante,
  nota: string,
): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("revisar_comprobante", {
    p_comprobante_id: id,
    p_estado: estado,
    p_nota: nota,
  });
  const fila = primera<FilaPorcentaje>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo revisar el comprobante", { id, error });
    return fallo("error");
  }
  return fila.ok && fila.nuevo_porcentaje !== null
    ? { ok: true, valor: fila.nuevo_porcentaje }
    : fallo(motivoDesdeReason(fila.reason));
}

/**
 * URL firmada de dos minutos: el bucket es privado y el enlace no debe servir
 * si alguien lo copia de la pantalla del admin.
 */
export async function urlFirmadaComprobante(id: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("comprobantes")
    .select("file_path")
    .eq("id", id)
    .maybeSingle<{ file_path: string }>();
  if (error || !data) {
    if (error) console.error("[inscripciones] no se pudo leer el comprobante", { id, error });
    return null;
  }
  const firmada = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(data.file_path, 120);
  if (firmada.error) {
    console.error("[inscripciones] no se pudo firmar la URL", { id, error: firmada.error });
    return null;
  }
  return firmada.data.signedUrl;
}

export type ResumenInicio = {
  comprobantesPorRevisar: number;
  porIdentificar: number;
  /** De las inscripciones activas del taller de la página; `null` si no hay taller. */
  pagoIncompleto: number | null;
};

export async function resumenInicio(tallerId: string | null): Promise<ResumenInicio | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const [comprobantes, personas, incompletos] = await Promise.all([
    supabase.from("comprobantes").select("id", { count: "exact", head: true }).eq("estado", "pending"),
    supabase.from("personas").select("id", { count: "exact", head: true }).is("documento", null),
    tallerId
      ? supabase
          .from("inscripciones")
          .select("id", { count: "exact", head: true })
          .eq("taller_id", tallerId)
          .eq("cancelada", false)
          .lt("porcentaje_pagado", 100)
      : Promise.resolve(null),
  ]);
  if (comprobantes.error || personas.error || incompletos?.error) {
    console.error("[inscripciones] no se pudo armar el resumen", {
      comprobantes: comprobantes.error,
      personas: personas.error,
      incompletos: incompletos?.error,
    });
    return null;
  }
  return {
    comprobantesPorRevisar: comprobantes.count ?? 0,
    porIdentificar: personas.count ?? 0,
    pagoIncompleto: incompletos ? (incompletos.count ?? 0) : null,
  };
}
```

- [ ] **Step 5: Implementar `comprobantes.ts`**

`src/lib/inscripciones/comprobantes.ts`:

```ts
import { PROOF_BUCKET, type ProofFile } from "@/lib/reservations/payment-proofs";
import { getSupabase } from "@/lib/reservations/supabase";
import { motivoDesdeReason } from "./errores";
import type { Correcciones } from "./formulario";
import type { Resultado } from "./repo";

export type NuevoComprobante = {
  tallerId: string;
  /** Carpeta del bucket: `<slug>/<id>.<ext>`, como los comprobantes migrados. */
  tallerSlug: string;
  documento: string;
  porcentaje: number;
  correcciones: Correcciones;
  notas: string;
  archivo: ProofFile;
};

type FilaRegistrar = {
  ok: boolean;
  reason: string | null;
  inscripcion_referencia: string | null;
  nuevo_en_revision: number;
};

/**
 * Sube el archivo y registra el comprobante.
 *
 * Primero el archivo y después la base: un comprobante que apunta a un
 * archivo inexistente sería un pago que nadie puede verificar. Si la función
 * SQL lo rechaza (cerrado, sin reserva, porcentaje), se borra el archivo para
 * no dejar huérfanos.
 */
export async function guardarComprobante(
  c: NuevoComprobante,
): Promise<Resultado<{ referencia: string; enRevision: number }>> {
  const supabase = getSupabase();
  if (!supabase) {
    console.info("[taller] comprobante (sin Supabase)", {
      tallerId: c.tallerId,
      porcentaje: c.porcentaje,
      bytes: c.archivo.bytes.length,
    });
    return { ok: false, motivo: "sin_conexion" };
  }

  const id = crypto.randomUUID();
  const ruta = `${c.tallerSlug}/${id}.${c.archivo.ext}`;
  const bucket = supabase.storage.from(PROOF_BUCKET);

  const subida = await bucket.upload(ruta, c.archivo.bytes, {
    contentType: c.archivo.type,
    upsert: false,
  });
  if (subida.error) {
    console.error("[taller] no se pudo subir el comprobante", { ruta, error: subida.error });
    return { ok: false, motivo: "error" };
  }

  const { data, error } = await supabase.rpc("registrar_comprobante", {
    p_taller_id: c.tallerId,
    p_documento: c.documento,
    p_comprobante_id: id,
    p_porcentaje: c.porcentaje,
    p_nombre: c.correcciones.nombre,
    p_email: c.correcciones.email,
    p_telefono: c.correcciones.telefono,
    p_notas: c.notas,
    p_file_path: ruta,
    p_file_type: c.archivo.type,
    p_file_size: c.archivo.bytes.length,
  });

  const fila = (data as FilaRegistrar[] | null)?.[0] ?? null;
  if (fila?.ok && fila.inscripcion_referencia) {
    return { ok: true, valor: { referencia: fila.inscripcion_referencia, enRevision: fila.nuevo_en_revision } };
  }

  await bucket.remove([ruta]);
  if (error || !fila) {
    console.error("[taller] no se pudo registrar el comprobante", { ruta, error });
    return { ok: false, motivo: "error" };
  }
  return { ok: false, motivo: motivoDesdeReason(fila.reason) };
}
```

- [ ] **Step 6: `id` en la vista del taller**

En `src/lib/talleres/vista.ts`, dentro de `export type TallerVista = {`, sustituye:

```ts
export type TallerVista = {
  slug: string;
```

por:

```ts
export type TallerVista = {
  /** Las funciones de inscripción reciben el id, no el slug. */
  id: string;
  slug: string;
```

y en el `return` de `construirTallerVista`, sustituye:

```ts
  return {
    slug: taller.slug,
```

por:

```ts
  return {
    id: taller.id,
    slug: taller.slug,
```

En `src/lib/talleres/__tests__/vista.test.ts`, dentro de `it("toma lo operativo de la base", …)`, sustituye `    expect(v.slug).toBe("taller-2026-10");` por:

```ts
    expect(v.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(v.slug).toBe("taller-2026-10");
```

- [ ] **Step 7: Contar inscripciones por id del taller**

En `src/lib/talleres/repo.ts`, sustituye la función `contarInscripciones` entera:

```ts
/** Reservas del taller, incluidas las canceladas: cualquiera impide borrarlo. */
export async function contarInscripciones(slug: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("edition", slug);
  if (error) {
    console.error("[talleres] no se pudieron contar las reservas", { slug, error });
    return null;
  }
  return count ?? 0;
}
```

por:

```ts
/** Inscripciones del taller, incluidas las canceladas: cualquiera impide borrarlo. */
export async function contarInscripciones(tallerId: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("inscripciones")
    .select("id", { count: "exact", head: true })
    .eq("taller_id", tallerId);
  if (error) {
    console.error("[talleres] no se pudieron contar las inscripciones", { tallerId, error });
    return null;
  }
  return count ?? 0;
}
```

En `actualizarTaller`, sustituye:

```ts
  // El slug es la clave con la que las reservas apuntan al taller: solo se
  // puede cambiar mientras no tenga ninguna.
  const actual = await obtenerTaller(id);
  if (!actual.ok) return actual;
  const reservas = await contarInscripciones(actual.valor.slug);
```

por:

```ts
  // El slug nombra la carpeta de los comprobantes y las tablas `_legacy_*`
  // apuntan a él: solo se cambia mientras el taller no tenga inscripciones.
  const actual = await obtenerTaller(id);
  if (!actual.ok) return actual;
  const reservas = await contarInscripciones(id);
```

En `eliminarTaller`, sustituye `  const reservas = await contarInscripciones(taller.valor.slug);` por `  const reservas = await contarInscripciones(id);`.

En `src/app/admin/talleres/[id]/page.tsx`, sustituye `    contarInscripciones(taller.slug),` por `    contarInscripciones(taller.id),`.

- [ ] **Step 8: Taller por defecto del admin por id**

En `src/lib/talleres/publico.ts`, añade al final:

```ts
/** Id del taller con el que abre una pantalla del admin: el de la URL o el de la página. */
export async function tallerIdParaAdmin(param: string | undefined): Promise<string | null> {
  if (param) return param;
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista.id : null;
}
```

(`slugParaAdmin` se queda hasta la Task 13: las páginas de certificados aún lo usan.)

- [ ] **Step 9: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; todas las pruebas pasan.

- [ ] **Step 10: Commit**

```bash
git add src/lib/inscripciones src/lib/talleres src/app/admin/talleres
git commit -m "feat(inscripciones): capa de datos sobre las funciones SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Reserva con documento y pago en dos pasos

**Files:**
- Modify: `src/app/taller/actions.ts` (completo), `src/components/taller/reserva-form.tsx` (completo), `src/components/taller/pago-form.tsx` (completo), `src/lib/payments/types.ts`, `src/lib/payments/manual.ts`, `src/lib/reservations/types.ts` (completo), `src/lib/reservations/payment-proofs.ts` (completo), `src/lib/taller.ts` (FAQ)
- Delete: `src/lib/reservations/index.ts`

**Interfaces:**
- Consumes (Tasks 1–4): `leerPersonaForm`, `leerCorrecciones`, `MAX`, `normalizarDocumento`, `documentoValido`, `porcentajeValido`, `montoDePorcentaje`, `MENSAJES_INSCRIPCION`, `crearInscripcion`, `consultarInscripcion`, `respuestaConsulta`, `ConsultaPago`, `guardarComprobante`, `crearLimitador`, `ipDeCabeceras`, `TallerVista.id`, `TIPOS_DOCUMENTO`, `TIPO_DOCUMENTO_ETIQUETA`.
- Produces (`src/app/taller/actions.ts`):
  - `ReserveState = { status: "idle" } | { status: "error"; errors: Record<string, string>; message?: string } | { status: "sold_out"; message: string; handoffUrl: string } | { status: "ya_inscrito"; message: string } | { status: "ok"; result: CheckoutResult }`; `createReservation(prev: ReserveState, fd: FormData): Promise<ReserveState>` (campos: `tipo_documento`, `documento`, `nombre`, `email`, `telefono`, `ciudad`, `profesion`, `notas`, `consent`).
  - `ConsultaState = { status: "idle" } | { status: "error"; message: string; sinReserva?: boolean } | { status: "ok"; documento: string; consulta: ConsultaPago }`; `buscarInscripcion(prev: ConsultaState, fd: FormData): Promise<ConsultaState>` (campo `documento`).
  - `PaymentState = { status: "idle" } | { status: "error"; errors: Record<string, string>; message?: string; handoffUrl?: string } | { status: "ok"; porcentaje: number; referencia: string; completo: boolean; handoffUrl: string }`; `registrarPago(prev: PaymentState, fd: FormData): Promise<PaymentState>` (campos: `documento`, `porcentaje`, `nombre?`, `email?`, `telefono?`, `notas`, `proof`, `policy?`, `consent`).
  - Internos (sin exportar): `dentroDelLimite(): Promise<boolean>` — la Task 12 lo reutiliza.
- Produces (`src/lib/payments/types.ts`): `OrderDraft.customer.document: string`.
- Produces (`src/lib/reservations/types.ts`): solo `PROOF_MAX_BYTES`, `PROOF_ACCEPT`. (`src/lib/reservations/payment-proofs.ts`): solo `PROOF_BUCKET`, `ProofFile`, `sniffProof`.
- Produces (`src/components/taller/pago-form.tsx`): `PagoForm({ onReiniciar }: { onReiniciar: () => void })`, `PagoSection()`.

- [ ] **Step 1: El documento en el pedido y en el mensaje de WhatsApp**

En `src/lib/payments/types.ts`, dentro de `OrderDraft`, sustituye:

```ts
  customer: {
    name: string;
    email: string;
```

por:

```ts
  customer: {
    name: string;
    /** "CC 1136882468": identifica a la persona en toda la plataforma. */
    document: string;
    email: string;
```

En `src/lib/payments/manual.ts`, sustituye `      \`Nombre: ${order.customer.name}\`,` por:

```ts
      `Nombre: ${order.customer.name}`,
      `Documento: ${order.customer.document}`,
```

- [ ] **Step 2: Quitar el código de reservas antiguo**

Reemplaza `src/lib/reservations/types.ts` entero por:

```ts
/**
 * Límite del comprobante de pago. Vive aquí y no en el módulo de servidor
 * porque el formulario lo usa para avisar antes de enviar: un archivo que
 * supera el `bodySizeLimit` de `next.config.ts` ni siquiera llega al server
 * action.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Formatos aceptados: capturas de pantalla, fotos del iPhone y PDF del banco. */
export const PROOF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";
```

Reemplaza `src/lib/reservations/payment-proofs.ts` entero por:

```ts
/** Bucket privado de Supabase Storage (ver `supabase/schema.sql`). */
export const PROOF_BUCKET = "comprobantes";

export type ProofFile = { bytes: Uint8Array; type: string; ext: string };

const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * Identifica el formato por sus primeros bytes.
 *
 * El `type` que manda el navegador lo decide quien envía la petición, así que
 * no se usa: un `.html` renombrado a `.jpg` se rechaza aquí y nunca llega al
 * bucket. Además los HEIC del iPhone suelen llegar con `type` vacío.
 */
export function sniffProof(bytes: Uint8Array): Omit<ProofFile, "bytes"> | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return { type: "image/png", ext: "png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  if (ascii(bytes, 0, 5) === "%PDF-") return { type: "application/pdf", ext: "pdf" };

  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (HEIC_BRANDS.has(brand)) return { type: "image/heic", ext: "heic" };
    if (HEIF_BRANDS.has(brand)) return { type: "image/heif", ext: "heif" };
  }

  return null;
}
```

Run: `git rm src/lib/reservations/index.ts`

- [ ] **Step 3: Server actions de `/taller`**

Reemplaza `src/app/taller/actions.ts` entero por:

```ts
"use server";

import { headers } from "next/headers";
import { getPaymentProvider, type CheckoutResult, type Money, type OrderDraft } from "@/lib/payments";
import { guardarComprobante } from "@/lib/inscripciones/comprobantes";
import { respuestaConsulta, type ConsultaPago } from "@/lib/inscripciones/consulta";
import { documentoValido, normalizarDocumento } from "@/lib/inscripciones/documento";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { leerCorrecciones, leerPersonaForm, MAX } from "@/lib/inscripciones/formulario";
import { porcentajeValido } from "@/lib/inscripciones/pagos";
import { consultarInscripcion, crearInscripcion } from "@/lib/inscripciones/repo";
import type { DatosPersona } from "@/lib/inscripciones/tipos";
import { crearLimitador, ipDeCabeceras } from "@/lib/limite";
import { sniffProof, type ProofFile } from "@/lib/reservations/payment-proofs";
import { PROOF_MAX_BYTES } from "@/lib/reservations/types";
import { tallerWaLink } from "@/lib/taller";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, tarifaPorDefecto, type TallerVista } from "@/lib/talleres/vista";

export type ReserveState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string }
  /** No quedan plazas (o las reservas están cerradas): se ofrece lista de espera. */
  | { status: "sold_out"; message: string; handoffUrl: string }
  /** Ese documento ya tiene reserva en este taller. */
  | { status: "ya_inscrito"; message: string }
  | { status: "ok"; result: CheckoutResult };

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function newReference() {
  return `STA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Importe de la tarifa por defecto del taller; `null` mientras no haya precios publicados. */
function currentPrice(t: TallerVista): Money | null {
  return t.pricing.published
    ? { amount: tarifaPorDefecto(t).amount, currency: t.pricing.currency }
    : null;
}

/**
 * Taller activo leído de la base en el momento del envío. Nunca se confía en lo
 * que la página tenía cacheado: el estado pudo cambiar desde el admin.
 */
async function tallerActivo(): Promise<
  { taller: TallerVista } | { taller: null; mensaje: string }
> {
  const publico = await cargarTallerPublico();
  if (publico.kind === "ok") return { taller: publico.vista };
  return {
    taller: null,
    mensaje:
      publico.kind === "sin_conexion"
        ? "No pudimos conectar con el sistema de reservas. Inténtalo en unos minutos o escríbenos por WhatsApp."
        : "Ahora mismo no hay un taller con inscripciones abiertas. Escríbenos por WhatsApp.",
  };
}

function waitlistMessage(
  t: TallerVista,
  p: Pick<DatosPersona, "nombre" | "email" | "ciudad" | "profesion">,
) {
  return tallerWaLink(
    [
      `Hola, quiero entrar en la lista de espera del ${nombreCurso(t)}.`,
      "",
      `Nombre: ${p.nombre}`,
      `Email: ${p.email ?? ""}`,
      `Ciudad: ${p.ciudad ?? ""}`,
      `Profesión: ${p.profesion ?? ""}`,
    ].join("\n"),
  );
}

/**
 * Consultas por documento (buscar la reserva, registrar el pago, buscar
 * certificados): como mucho 12 cada 10 minutos por IP. Frena a quien prueba
 * documentos para ver quién está inscrito; a una persona real le sobra.
 */
const limitador = crearLimitador({ max: 12, ventanaMs: 10 * 60 * 1000 });

async function dentroDelLimite() {
  return limitador.permitir(ipDeCabeceras(await headers()));
}

/**
 * Crea la inscripción y arranca el cobro.
 *
 * Un server action es un endpoint POST público: cualquiera puede llamarlo sin
 * pasar por el formulario, así que todo se valida aquí y el importe se lee del
 * taller en la base, nunca del `formData`.
 */
export async function createReservation(
  _prev: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const lectura = leerPersonaForm(formData, "publico");
  const errors: Record<string, string> = lectura.ok ? {} : { ...lectura.errores };
  if (formData.get("consent") !== "on")
    errors.consent = "Necesitamos tu autorización para contactarte.";
  if (!lectura.ok || Object.keys(errors).length > 0) return { status: "error", errors };
  const { datos, notas } = lectura;

  const activo = await tallerActivo();
  if (!activo.taller) return { status: "error", errors: {}, message: activo.mensaje };
  const t = activo.taller;

  // La página puede estar cacheada: se vuelve a comprobar aquí.
  if (t.estado === "finalizado") {
    return { status: "error", errors: {}, message: "Esta edición ya finalizó." };
  }

  if (!t.mostrar.reserva) {
    return {
      status: "sold_out",
      message:
        t.estado === "publicado"
          ? "Los cupos de esta edición se agotaron."
          : "Se vendieron todos los cupos de esta edición.",
      handoffUrl: waitlistMessage(t, datos),
    };
  }

  const tier = tarifaPorDefecto(t);
  const price = currentPrice(t);
  const referencia = newReference();

  // Guardar es también reclamar el cupo: la base rechaza si se llenó o se cerró.
  const creada = await crearInscripcion({
    tallerId: t.id,
    referencia,
    persona: datos,
    tarifa: { id: tier.id, nombre: tier.name },
    monto: price?.amount ?? null,
    moneda: price?.currency ?? null,
    notas,
    origen: "web",
    forzarCupo: false,
  });

  if (!creada.ok) {
    switch (creada.motivo) {
      case "ya_inscrito":
        return {
          status: "ya_inscrito",
          message:
            "Ya tienes una reserva en este taller con ese documento: no hace falta reservar otra vez. Si ya pagaste, registra tu comprobante.",
        };
      case "sin_cupos":
      case "cerrado":
        return {
          status: "sold_out",
          message:
            creada.motivo === "cerrado"
              ? "Las reservas de esta edición están cerradas."
              : "Los cupos de esta edición se agotaron mientras completabas el formulario.",
          handoffUrl: waitlistMessage(t, datos),
        };
      case "documento_invalido":
        return { status: "error", errors: { documento: MENSAJES_INSCRIPCION.documento_invalido } };
      default:
        // Sin conexión o fallo de la base: la reserva no quedó guardada (repo.ts
        // la deja en los logs), pero la persona sigue por WhatsApp con su
        // referencia, como siempre.
        console.error("[taller] la reserva no quedó en la base; sigue por WhatsApp", {
          motivo: creada.motivo,
          referencia,
          persona: datos,
          notas,
        });
    }
  }

  const order: OrderDraft = {
    reference: creada.ok ? creada.valor.referencia : referencia,
    courseName: nombreCurso(t),
    tierId: tier.id,
    tierName: tier.name,
    price,
    customer: {
      name: datos.nombre,
      document: `${datos.tipoDocumento} ${datos.documento}`,
      email: datos.email ?? "",
      phone: datos.telefono ?? "",
      city: datos.ciudad ?? "",
      profession: datos.profesion ?? "",
    },
    notes: notas,
  };

  try {
    const result = await getPaymentProvider().createCheckout(order);
    return { status: "ok", result };
  } catch (err) {
    console.error("[taller] createCheckout falló", { reference: order.reference, err });
    return {
      status: "error",
      errors: {},
      message:
        "No pudimos iniciar el pago. Escríbenos por WhatsApp y confirmamos tu cupo a mano.",
    };
  }
}

/* ------------------------------------------------------- Registro de pago */

export type ConsultaState =
  | { status: "idle" }
  | { status: "error"; message: string; sinReserva?: boolean }
  | { status: "ok"; documento: string; consulta: ConsultaPago };

/**
 * Paso 1 del pago: ¿hay una reserva activa con este documento?
 *
 * Devuelve los datos enmascarados y los porcentajes que se pueden pagar. No
 * entrega ningún token: el paso 2 vuelve a comprobarlo todo.
 */
export async function buscarInscripcion(
  _prev: ConsultaState,
  formData: FormData,
): Promise<ConsultaState> {
  const documento = normalizarDocumento(str(formData, "documento"));
  if (!documentoValido(documento))
    return { status: "error", message: "Escribe tu número de documento (cédula o pasaporte)." };
  if (!(await dentroDelLimite())) return { status: "error", message: MENSAJES_INSCRIPCION.limite };

  const activo = await tallerActivo();
  if (!activo.taller) return { status: "error", message: activo.mensaje };
  const t = activo.taller;
  if (!t.mostrar.pago) {
    return {
      status: "error",
      message: "El registro de pagos de esta edición está cerrado. Escríbenos por WhatsApp.",
    };
  }

  const r = await consultarInscripcion(t.id, documento);
  if (!r.ok) return { status: "error", message: MENSAJES_INSCRIPCION[r.motivo] };
  if (!r.valor) {
    return {
      status: "error",
      message:
        "No encontramos una reserva con ese documento en esta edición. Revisa el número o reserva tu cupo primero.",
      sinReserva: true,
    };
  }

  return {
    status: "ok",
    documento,
    consulta: respuestaConsulta(r.valor, t.porcentajesPago, t.pricing.published),
  };
}

export type PaymentState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string; handoffUrl?: string }
  | { status: "ok"; porcentaje: number; referencia: string; completo: boolean; handoffUrl: string };

/**
 * Paso 2: registra el comprobante.
 *
 * Todo se valida otra vez (taller abierto, reserva activa, porcentaje
 * permitido y dentro del saldo) y la base lo repite dentro de su transacción.
 * Los datos que la persona reescribió se corrigen en su ficha.
 */
export async function registrarPago(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const errors: Record<string, string> = {};

  const documento = normalizarDocumento(str(formData, "documento"));
  if (!documentoValido(documento)) errors.documento = "Vuelve al paso anterior y escribe tu documento.";

  const correcciones = leerCorrecciones(formData, errors);

  const porcentaje = Number(str(formData, "porcentaje"));
  if (!Number.isInteger(porcentaje) || porcentaje <= 0 || porcentaje > 100)
    errors.porcentaje = "Elige cuánto pagaste.";

  const notas = str(formData, "notas");
  if (notas.length > MAX.notas) errors.notas = "El comentario supera los 800 caracteres.";

  if (formData.get("consent") !== "on")
    errors.consent = "Necesitamos tu autorización para verificar el pago.";

  const upload = formData.get("proof");
  let file: ProofFile | null = null;
  if (!(upload instanceof File) || upload.size === 0) {
    errors.proof = "Sube la captura o el comprobante de pago.";
  } else if (upload.size > PROOF_MAX_BYTES) {
    errors.proof = "El archivo supera 5 MB. Sube una captura de pantalla o un PDF más liviano.";
  } else {
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const sniffed = sniffProof(bytes);
    if (sniffed) file = { bytes, ...sniffed };
    else errors.proof = "Formato no válido. Sube una imagen (JPG, PNG, HEIC) o un PDF.";
  }

  if (Object.keys(errors).length > 0 || !file) return { status: "error", errors };
  if (!(await dentroDelLimite()))
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION.limite };

  const activo = await tallerActivo();
  if (!activo.taller) {
    return {
      status: "error",
      errors: {},
      message: activo.mensaje,
      handoffUrl: tallerWaLink(`Hola, quiero registrar un pago. Documento: ${documento}.`),
    };
  }
  const t = activo.taller;

  const handoff = (referencia: string | null) =>
    tallerWaLink(
      [
        `Hola, registré un pago del ${porcentaje}% del ${nombreCurso(t)}.`,
        "",
        ...(referencia ? [`Número de reserva: ${referencia}`] : []),
        `Documento: ${documento}`,
      ].join("\n"),
    );

  if (!t.mostrar.pago) {
    return {
      status: "error",
      errors: {},
      message:
        "El registro de pagos de esta edición está cerrado. Envíanos tu comprobante por WhatsApp y lo resolvemos.",
      handoffUrl: handoff(null),
    };
  }

  // Se consulta de nuevo: entre un paso y otro pudo subirse otro comprobante
  // (otra pestaña) y el paso 1 no deja ningún token de confianza.
  const consulta = await consultarInscripcion(t.id, documento);
  if (!consulta.ok) {
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION[consulta.motivo], handoffUrl: handoff(null) };
  }
  if (!consulta.valor) {
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION.sin_inscripcion };
  }

  const pagado = consulta.valor.porcentaje_pagado;
  const enRevision = consulta.valor.porcentaje_en_revision;
  if (!porcentajeValido(porcentaje, t.porcentajesPago, pagado, enRevision)) {
    return { status: "error", errors: { porcentaje: MENSAJES_INSCRIPCION.porcentaje_no_permitido } };
  }
  if (pagado + enRevision + porcentaje < 100 && formData.get("policy") !== "on") {
    return { status: "error", errors: { policy: "Debes aceptar la condición del abono para registrarlo." } };
  }

  const guardado = await guardarComprobante({
    tallerId: t.id,
    tallerSlug: t.slug,
    documento,
    porcentaje,
    correcciones,
    notas,
    archivo: file,
  });

  if (guardado.ok) {
    return {
      status: "ok",
      porcentaje,
      referencia: guardado.valor.referencia,
      completo: pagado + guardado.valor.enRevision >= 100,
      handoffUrl: handoff(guardado.valor.referencia),
    };
  }

  const motivo = guardado.motivo;
  if (motivo === "porcentaje_no_permitido" || motivo === "sin_saldo") {
    return { status: "error", errors: { porcentaje: MENSAJES_INSCRIPCION[motivo] } };
  }
  return {
    status: "error",
    errors: {},
    message:
      motivo === "error" || motivo === "sin_conexion"
        ? "No pudimos recibir tu comprobante. Envíanoslo por WhatsApp y lo registramos a mano."
        : MENSAJES_INSCRIPCION[motivo],
    handoffUrl: handoff(null),
  };
}
```

- [ ] **Step 4: Formulario de reserva con documento**

Reemplaza `src/components/taller/reserva-form.tsx` entero por:

```tsx
"use client";

import { startTransition, useActionState } from "react";
import { createReservation, type ReserveState } from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";
import { WhatsAppIcon } from "@/components/ui/icons";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_ETIQUETA } from "@/lib/inscripciones/tipos";
import { tallerWaLink } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";
import { nombreCurso, type TallerVista } from "@/lib/talleres/vista";

const initialState: ReserveState = { status: "idle" };

/**
 * A partir de aquí se muestra el número exacto de plazas en vez de "cupos
 * limitados". Anunciar "quedan 31" no aprieta a nadie; "quedan 4", sí.
 */
const LOW_SEATS = 8;

function waitlistLink(taller: TallerVista) {
  return tallerWaLink(`Hola, quiero entrar en la lista de espera del ${nombreCurso(taller)}.`);
}

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Panel de cierre: mismo marco que la confirmación, sin formulario debajo. */
function SoldOutPanel({ message, handoffUrl }: { message: string; handoffUrl: string }) {
  return (
    <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-navy/10 text-2xl">
        ⏳
      </span>
      <h3 className="mt-5 text-[26px] text-navy">Cupos agotados</h3>
      <p className="mt-3 text-[15px] leading-[1.8] text-ink">{message}</p>
      <p className="mt-2 text-[15px] leading-[1.8] text-ink">
        Escríbenos y te anotamos en la lista de espera: si se libera una plaza, eres
        el primero en saberlo.
      </p>
      <a
        href={handoffUrl}
        target="_blank"
        rel="noopener"
        className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
      >
        <WhatsAppIcon className="size-[18px]" />
        Entrar en la lista de espera
      </a>
    </div>
  );
}

export function ReservaForm() {
  const taller = useTaller();
  const seats = taller.seats;
  const [state, formAction, pending] = useActionState(createReservation, initialState);

  const errors = state.status === "error" ? state.errors : {};

  /**
   * Se despacha a mano y no con `<form action>`: React 19 vacía el formulario
   * tras cada acción, y un error de validación borraría todo lo escrito.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.status === "sold_out") {
    return <SoldOutPanel message={state.message} handoffUrl={state.handoffUrl} />;
  }

  if (state.status === "ya_inscrito") {
    return (
      <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Ya tienes una reserva</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">{state.message}</p>
        {taller.mostrar.pago && (
          <a
            href="#registro-pago"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
          >
            Registrar mi pago
          </a>
        )}
      </div>
    );
  }

  // Edición llena declarada en el catálogo: manda sobre el conteo de la base,
  // porque los últimos cupos se cerraron por WhatsApp y no dejaron fila.
  if (taller.soldOut) {
    return (
      <SoldOutPanel
        message="Se vendieron todos los cupos de esta edición."
        handoffUrl={waitlistLink(taller)}
      />
    );
  }

  // `seats` puede venir de una página cacheada, así que este cierre es solo
  // cosmético: quien llegue con la página vieja igual recibe el panel de
  // agotados al enviar, porque el conteo real se hace en la base de datos.
  if (seats && seats.libres <= 0) {
    return (
      <SoldOutPanel
        message="Se agotaron las plazas de esta edición."
        handoffUrl={waitlistLink(taller)}
      />
    );
  }

  if (state.status === "ok") {
    const { result } = state;
    return (
      <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Reserva registrada</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          {result.kind === "pending"
            ? result.message
            : "Te llevamos a la pasarela para completar el pago."}
        </p>
        <p className="mt-5 inline-block rounded-full bg-white px-5 py-2 font-mono text-[13px] tracking-wider text-navy">
          Referencia: <strong>{result.reference}</strong>
        </p>
        <a
          href={result.kind === "pending" ? result.handoffUrl : result.url}
          target="_blank"
          rel="noopener"
          className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
        >
          {result.kind === "pending" ? (
            <>
              <WhatsAppIcon className="size-[18px]" />
              Continuar en WhatsApp
            </>
          ) : (
            "Ir a pagar"
          )}
        </a>
        <p className="mt-4 text-[11.5px] text-ink-soft">
          Para registrar tu pago y descargar tu certificado solo necesitas tu número de documento.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-3xl bg-cream p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
        <Field id="tipo_documento" label="Tipo de documento">
          <select id="tipo_documento" name="tipo_documento" defaultValue="CC" className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="documento" label="Número de documento" error={errors.documento}>
          <input
            id="documento"
            name="documento"
            required
            type="text"
            autoComplete="off"
            maxLength={30}
            placeholder="Cédula o pasaporte"
            aria-invalid={Boolean(errors.documento)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <Field id="nombre" label="Nombre completo" error={errors.nombre}>
          <input
            id="nombre"
            name="nombre"
            required
            type="text"
            autoComplete="name"
            maxLength={120}
            placeholder="Tu nombre y apellido"
            aria-invalid={Boolean(errors.nombre)}
            className={inputClass}
          />
        </Field>
        {!errors.nombre && (
          <p className="mt-1.5 text-[12px] text-ink-soft">
            Así aparecerá en tu certificado: escríbelo completo y con tildes.
          </p>
        )}
      </div>

      <Field id="email" label="Email" error={errors.email}>
        <input
          id="email"
          name="email"
          required
          type="email"
          autoComplete="email"
          maxLength={160}
          placeholder="nombre@correo.com"
          aria-invalid={Boolean(errors.email)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="telefono" label="WhatsApp" error={errors.telefono}>
          <input
            id="telefono"
            name="telefono"
            required
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="+57 300 000 0000"
            aria-invalid={Boolean(errors.telefono)}
            className={inputClass}
          />
        </Field>

        <Field id="ciudad" label="Ciudad" error={errors.ciudad}>
          <input
            id="ciudad"
            name="ciudad"
            required
            type="text"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Maracaibo"
            aria-invalid={Boolean(errors.ciudad)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="profesion" label="Profesión o especialidad" error={errors.profesion}>
        <input
          id="profesion"
          name="profesion"
          required
          type="text"
          maxLength={120}
          placeholder="Anestesiólogo · Residente de anestesiología · Médico general"
          aria-invalid={Boolean(errors.profesion)}
          className={inputClass}
        />
      </Field>

      <Field id="notas" label="¿Algo que debamos saber? (opcional)" error={errors.notas}>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          maxLength={800}
          placeholder="Facturación, alimentación, nivel de experiencia con ultrasonido…"
          className={`${inputClass} resize-y`}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-ink">
        <input type="checkbox" name="consent" className="mt-0.5 accent-azure" />
        <span>
          Autorizo el tratamiento de mis datos para gestionar la reserva y recibir
          información del taller.
        </span>
      </label>
      {errors.consent && <p className="-mt-2 text-[12px] text-red-600">{errors.consent}</p>}

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Reservar mi cupo"}
      </button>

      <p className="text-center text-[11.5px] text-ink-soft">
        {seats && seats.libres <= LOW_SEATS
          ? `Quedan ${seats.libres} ${seats.libres === 1 ? "cupo" : "cupos"}. `
          : "Cupos limitados. "}
        {taller.pricing.published
          ? "Recibirás tu referencia de pago al enviar."
          : "Te confirmamos el valor y el medio de pago al contactarte."}
      </p>
    </form>
  );
}

export function ReservaSection() {
  const taller = useTaller();
  const seats = taller.seats;
  // Con Supabase conectado el dato es real; sin él se cae al texto de escasez.
  const scarcity =
    !taller.soldOut && seats && seats.libres > 0 && seats.libres <= LOW_SEATS
      ? `Quedan ${seats.libres} de ${seats.total} cupos`
      : `${taller.scarcity.value} ${taller.scarcity.label}`;

  return (
    <section id="reservar" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            Reserva
          </Reveal>

          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy">
              {taller.soldOut ? "Esta edición" : "Asegura tu cupo"}
              <span className="block text-azure">
                {taller.soldOut ? "ya está completa." : "antes de que se agote."}
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ink">
              {taller.soldOut ? (
                <>
                  {scarcity}. El taller trabaja con grupos reducidos por estación, así que
                  el número de plazas es fijo y no se amplía. Déjanos tus datos por
                  WhatsApp: si se libera una plaza o abrimos una edición nueva, te
                  avisamos primero.
                </>
              ) : (
                <>
                  {scarcity}. El taller trabaja con grupos reducidos por estación, así que
                  el número de plazas es fijo. Completa el formulario y te confirmamos por
                  WhatsApp.
                </>
              )}
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <ul className="mt-8 flex flex-col gap-3">
              {taller.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[14px] text-ink">
                  <span className="mt-[7px] block size-1.5 flex-none rounded-full bg-azure" />
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <ReservaForm />
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Registro de pago en dos pasos**

Reemplaza `src/components/taller/pago-form.tsx` entero por:

```tsx
"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import {
  buscarInscripcion,
  registrarPago,
  type ConsultaState,
  type PaymentState,
} from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";
import { WhatsAppIcon } from "@/components/ui/icons";
import type { ConsultaPago } from "@/lib/inscripciones/consulta";
import { montoDePorcentaje } from "@/lib/inscripciones/pagos";
import { PROOF_ACCEPT, PROOF_MAX_BYTES } from "@/lib/reservations/types";
import { formatPrice } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";

const consultaInicial: ConsultaState = { status: "idle" };
const pagoInicial: PaymentState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";
const errorClass = "mt-1.5 text-[12px] text-red-600";
const botonClass =
  "mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60";

type Campo = "nombre" | "email" | "telefono";
const CAMPOS: { campo: Campo; etiqueta: string; tipo: string; max: number; ayuda: string }[] = [
  { campo: "nombre", etiqueta: "Nombre", tipo: "text", max: 120, ayuda: "Nombre completo, tal como debe salir en el certificado" },
  { campo: "email", etiqueta: "Email", tipo: "email", max: 160, ayuda: "Email completo" },
  { campo: "telefono", etiqueta: "WhatsApp", tipo: "tel", max: 40, ayuda: "WhatsApp completo, con indicativo" },
];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Paso 1: solo el documento. Hasta saber que hay una reserva activa no se pide
 * nada más, y lo que vuelve del servidor llega enmascarado.
 */
export function PagoForm({ onReiniciar }: { onReiniciar: () => void }) {
  const [consulta, buscar, buscando] = useActionState(buscarInscripcion, consultaInicial);

  if (consulta.status === "ok") {
    return <PasoPago documento={consulta.documento} consulta={consulta.consulta} onReiniciar={onReiniciar} />;
  }

  return (
    <form
      onSubmit={(e) => {
        // A mano y no con `action`: así un «no encontramos tu reserva» no
        // borra el documento que la persona acaba de escribir.
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => buscar(formData));
      }}
      className="flex flex-col gap-4 rounded-3xl bg-white p-6 sm:p-8"
    >
      <div>
        <label htmlFor="pago-documento" className={labelClass}>
          Número de documento con el que reservaste
        </label>
        <input
          id="pago-documento"
          name="documento"
          required
          type="text"
          autoComplete="off"
          maxLength={30}
          placeholder="Cédula o pasaporte"
          className={inputClass}
        />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Buscamos tu reserva en esta edición y te mostramos tus datos ocultos en parte para que
        confirmes que eres tú.
      </p>

      {consulta.status === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {consulta.message}
          {consulta.sinReserva && (
            <a href="#reservar" className="mt-1.5 block font-semibold underline underline-offset-4">
              Reservar mi cupo
            </a>
          )}
        </div>
      )}

      <button type="submit" disabled={buscando} className={botonClass}>
        {buscando ? "Buscando…" : "Continuar"}
      </button>
    </form>
  );
}

/** Paso 2: datos enmascarados, cuánto pagó y el comprobante. */
function PasoPago({
  documento,
  consulta,
  onReiniciar,
}: {
  documento: string;
  consulta: ConsultaPago;
  onReiniciar: () => void;
}) {
  const [state, formAction, pending] = useActionState(registrarPago, pagoInicial);
  const [porcentaje, setPorcentaje] = useState<number | null>(
    consulta.opciones.length === 1 ? consulta.opciones[0].porcentaje : null,
  );
  const [corregir, setCorregir] = useState<Record<Campo, boolean>>({
    nombre: false,
    email: false,
    telefono: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Vista previa solo para formatos que el navegador sabe pintar; HEIC y PDF
  // se muestran por nombre.
  const preview = useMemo(
    () => (file && /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const errors = { ...(state.status === "error" ? state.errors : {}), ...clientErrors };
  const parcial = porcentaje !== null && consulta.pagado + consulta.enRevision + porcentaje < 100;

  /**
   * Se despacha a mano y no con `<form action>`: React resetea el formulario
   * tras cada acción, y perder el archivo elegido por un error de validación
   * obliga a buscar la captura otra vez.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (porcentaje === null) next.porcentaje = "Elige cuánto pagaste.";
    if (!file) next.proof = "Sube la captura o el comprobante de pago.";
    // Por encima del límite el server action rechaza la petición antes de
    // ejecutarse, así que el aviso tiene que salir de aquí.
    else if (file.size > PROOF_MAX_BYTES)
      next.proof = "El archivo supera 5 MB. Sube una captura de pantalla o un PDF más liviano.";
    setClientErrors(next);
    if (Object.keys(next).length > 0) return;

    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.status === "ok") {
    return (
      <div className="rounded-3xl bg-white p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl text-navy">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Pago registrado</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          Recibimos el comprobante de tu pago del {state.porcentaje}%. Lo verificamos y te
          avisamos por WhatsApp.
        </p>
        <div className="mt-6 rounded-2xl border border-navy/10 bg-ice/40 px-5 py-4">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
            Tu número de reserva
          </p>
          <p className="mt-1 font-mono text-[26px] font-semibold tracking-wider text-navy select-all">
            {state.referencia}
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">
            Para el próximo pago y para tu certificado basta con tu documento.
          </p>
        </div>
        {!state.completo && (
          <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[13.5px] leading-[1.7] text-navy">
            Recuerda: si no completas el pago a tiempo, no hay reembolso de lo abonado.
          </p>
        )}
        <a
          href={state.handoffUrl}
          target="_blank"
          rel="noopener"
          className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
        >
          <WhatsAppIcon className="size-[18px]" />
          Avisar por WhatsApp
        </a>
        <button
          type="button"
          onClick={onReiniciar}
          className="mt-4 text-[13px] font-semibold text-azure underline-offset-4 hover:underline"
        >
          Registrar otro pago
        </button>
      </div>
    );
  }

  if (consulta.opciones.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center sm:p-10">
        <h3 className="text-[24px] text-navy">Ya registraste el 100%</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          Llevas {consulta.pagado}% verificado
          {consulta.enRevision > 0 ? ` y ${consulta.enRevision}% en revisión` : ""}. Si necesitas
          corregir un comprobante, escríbenos por WhatsApp.
        </p>
        <button
          type="button"
          onClick={onReiniciar}
          className="mt-6 text-[13px] font-semibold text-azure underline-offset-4 hover:underline"
        >
          Usar otro documento
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      encType="multipart/form-data"
      className="flex flex-col gap-5 rounded-3xl bg-white p-6 sm:p-8"
    >
      <input type="hidden" name="documento" value={documento} />

      <div className="rounded-2xl border border-navy/10 bg-ice/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
            Tu reserva
          </p>
          <button
            type="button"
            onClick={onReiniciar}
            className="text-[12.5px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            No soy yo · otro documento
          </button>
        </div>
        {errors.documento && <p className={errorClass}>{errors.documento}</p>}

        <dl className="mt-3 flex flex-col gap-3">
          {CAMPOS.map(({ campo, etiqueta, tipo, max, ayuda }) => (
            <div key={campo}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-[12.5px] text-ink-soft">{etiqueta}</dt>
                <button
                  type="button"
                  onClick={() => setCorregir((c) => ({ ...c, [campo]: !c[campo] }))}
                  className="text-[12px] font-semibold text-azure"
                >
                  {corregir[campo] ? "Dejarlo así" : "Corregir"}
                </button>
              </div>
              <dd className="font-mono text-[14px] text-navy">{consulta[campo] || "—"}</dd>
              {corregir[campo] && (
                <>
                  <input
                    name={campo}
                    type={tipo}
                    required
                    maxLength={max}
                    placeholder={ayuda}
                    aria-label={ayuda}
                    aria-invalid={Boolean(errors[campo])}
                    className={`${inputClass} mt-2`}
                  />
                  {errors[campo] && <p className={errorClass}>{errors[campo]}</p>}
                </>
              )}
            </div>
          ))}
        </dl>

        <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[12.5px] leading-relaxed text-navy">
          El nombre es el que se imprime en tu certificado. Si ves un error, toca «Corregir» y
          escríbelo completo, tal como debe salir.
        </p>
        <p className="mt-3 text-[13px] text-ink">
          Llevas pagado <strong>{consulta.pagado}%</strong>
          {consulta.enRevision > 0 && (
            <>
              {" "}
              · <strong>{consulta.enRevision}%</strong> en revisión
            </>
          )}
          .
        </p>
      </div>

      <fieldset>
        <legend className={labelClass}>¿Cuánto pagaste ahora?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {consulta.opciones.map((o) => (
            <label
              key={o.porcentaje}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-200 ${
                porcentaje === o.porcentaje ? "border-azure bg-ice/40" : "border-navy/15 hover:border-navy/30"
              }`}
            >
              <input
                type="radio"
                name="porcentaje"
                value={o.porcentaje}
                checked={porcentaje === o.porcentaje}
                onChange={() => setPorcentaje(o.porcentaje)}
                className="mt-1 accent-azure"
              />
              <span>
                <span className="block text-[14px] font-semibold text-navy">{o.etiqueta}</span>
                {consulta.monto !== null && consulta.moneda && (
                  <span className="block text-[12.5px] text-ink-soft">
                    {formatPrice(montoDePorcentaje(consulta.monto, o.porcentaje), consulta.moneda)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        {errors.porcentaje && <p className={errorClass}>{errors.porcentaje}</p>}
      </fieldset>

      <div>
        <span className={labelClass}>Captura o comprobante de pago</span>
        <label
          htmlFor="pago-proof"
          className={`flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 py-4 transition-colors duration-200 focus-within:border-azure ${
            errors.proof ? "border-red-400" : "border-navy/25 hover:border-azure"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob local, next/image no aplica
            <img src={preview} alt="" className="size-14 flex-none rounded-lg object-cover" />
          ) : (
            <span className="flex size-14 flex-none items-center justify-center rounded-lg bg-cream text-[11px] font-semibold tracking-wider text-navy">
              {file ? (file.type === "application/pdf" ? "PDF" : "IMG") : "+"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-navy">
              {file ? file.name : "Elegir archivo"}
            </span>
            <span className="block text-[12.5px] text-ink-soft">
              {file
                ? `${formatSize(file.size)} · toca para cambiarlo`
                : "JPG, PNG, HEIC o PDF · máximo 5 MB"}
            </span>
          </span>
          <input
            id="pago-proof"
            name="proof"
            type="file"
            accept={PROOF_ACCEPT}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
        {errors.proof && <p className={errorClass}>{errors.proof}</p>}
      </div>

      <div>
        <label htmlFor="pago-notas" className={labelClass}>
          Comentario (opcional)
        </label>
        <textarea
          id="pago-notas"
          name="notas"
          rows={2}
          maxLength={800}
          placeholder="Banco, fecha de la transferencia, a nombre de quién salió el pago…"
          className={`${inputClass} resize-y`}
        />
        {errors.notas && <p className={errorClass}>{errors.notas}</p>}
      </div>

      {parcial && (
        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream px-4 py-3.5 text-[12.5px] leading-relaxed text-navy">
            <input type="checkbox" name="policy" className="mt-0.5 accent-azure" />
            <span>
              Entiendo que si no completo el pago a tiempo{" "}
              <strong>no hay reembolso de lo abonado</strong>, porque cubre los gastos operativos
              del taller.
            </span>
          </label>
          {errors.policy && <p className={errorClass}>{errors.policy}</p>}
        </div>
      )}

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-ink">
          <input type="checkbox" name="consent" className="mt-0.5 accent-azure" />
          <span>
            Autorizo el tratamiento de mis datos y del comprobante para verificar mi pago.
          </span>
        </label>
        {errors.consent && <p className={errorClass}>{errors.consent}</p>}
      </div>

      {state.status === "error" && state.message && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.message}
          {state.handoffUrl && (
            <a
              href={state.handoffUrl}
              target="_blank"
              rel="noopener"
              className="mt-1.5 flex items-center gap-2 font-semibold underline underline-offset-4"
            >
              <WhatsAppIcon className="size-4" />
              Enviar por WhatsApp
            </a>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className={botonClass}>
        {pending ? "Subiendo comprobante…" : "Registrar mi pago"}
      </button>
    </form>
  );
}

export function PagoSection() {
  const taller = useTaller();
  const aceptaParcial = taller.porcentajesPago.some((p) => p < 100);
  // Cambiar la `key` remonta el formulario: es la forma de volver al paso 1
  // (useActionState no tiene un «reset»).
  const [vuelta, setVuelta] = useState(0);

  return (
    <section
      id="registro-pago"
      className="grain relative overflow-hidden bg-navy px-5 py-24 sm:px-8 lg:px-16 lg:py-32"
    >
      <div className="pointer-events-none absolute top-1/3 -right-[10%] size-[38vw] max-h-[520px] max-w-[520px] rounded-full bg-[radial-gradient(circle,rgba(88,134,232,.2),transparent_65%)] blur-2xl" />

      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-sky">
            <span className="block h-px w-6 bg-azure" />
            Registro de pago
          </Reveal>

          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-white">
              ¿Ya pagaste?
              <span className="block text-sky">Registra tu comprobante.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ice/80">
              Escribe el documento con el que reservaste, confirma tus datos y sube la captura o
              el comprobante de la transferencia. Te avisamos por WhatsApp cuando verifiquemos
              el pago.
            </p>
          </Reveal>

          {aceptaParcial && (
            <Reveal delay={0.18}>
              <div className="mt-8 max-w-[440px] rounded-2xl border border-white/20 bg-white/[0.06] p-5">
                <p className="flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.06em] text-sky uppercase">
                  <span className="block size-1.5 rounded-full bg-sky" />
                  Importante sobre el abono
                </p>
                <p className="mt-3 text-[15px] leading-[1.75] text-white">{taller.payment.policy}</p>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.15}>
          <PagoForm key={vuelta} onReiniciar={() => setVuelta((v) => v + 1)} />
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: FAQ con el flujo nuevo**

En `src/lib/taller.ts`, sustituye la respuesta de «¿Cómo se confirma mi cupo?»:

```ts
      a: "Al enviar el formulario generamos tu reserva con un número de referencia y te contactamos por WhatsApp para cerrar el pago. Cuando pagues —abono del 50% o pago completo— sube tu comprobante en «Registrar pago»: ahí te asignamos tu número de reserva si aún no lo tenías. El cupo queda confirmado cuando verificamos el pago.",
```

por:

```ts
      a: "Al enviar el formulario con tu número de documento generamos tu reserva y te contactamos por WhatsApp para cerrar el pago. Cuando pagues, entra en «Registrar pago», escribe el mismo documento y sube el comprobante. El cupo queda confirmado cuando verificamos el pago.",
```

- [ ] **Step 7: Comprobar que no queda código antiguo**

Run: `grep -rnE "saveReservation|savePaymentProof|PaymentKind|SaveResult|registerPayment|from \"@/lib/reservations\"" src`
Expected: sin resultados.

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde (el build no necesita variables de entorno). No se puede probar contra la base hasta la Task 8: el código nuevo llama a funciones que producción aún no tiene. **No hagas push.**

- [ ] **Step 9: Commit**

```bash
git add -A src/app/taller src/components/taller src/lib/payments src/lib/reservations src/lib/taller.ts
git commit -m "feat(taller): reserva con documento y registro de pago en dos pasos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin — inscritos por taller

**Files:**
- Create: `src/app/admin/inscritos/actions.ts`, `src/app/admin/inscritos/page.tsx`, `src/components/admin/mensaje.tsx`, `src/components/admin/selector-taller.tsx`, `src/components/admin/inscribir-form.tsx`, `src/components/admin/inscrito-fila.tsx`, `src/components/admin/asistencia-lote.tsx`
- Modify: `src/components/admin/taller-acciones.tsx` (usa `Mensaje` compartido)

**Interfaces:**
- Consumes: `isAdmin`, `puertaAdmin`; Task 2 `leerPersonaForm`, `esUuid`, `MENSAJES_INSCRIPCION`, `filtrarInscritos`, `leerFiltro`, `FILTROS_ESTADO`, `FILTRO_ETIQUETA`; Task 1 `estadoPago`, etiquetas; Task 4 `crearInscripcion`, `buscarPersona`, `actualizarPersona`, `marcarAsistencia`, `cambiarCancelada`, `ajustarPorcentaje`, `eliminarInscripcion`, `fusionarPersonas`, `listarInscritos`, `tallerIdParaAdmin`; talleres `listarTalleres`, `obtenerTaller`, `obtenerDisponibilidad`.
- Produces (`src/app/admin/inscritos/actions.ts`, todas empiezan por `isAdmin()`):
  - `EstadoAccion = { status: "idle" } | { status: "error"; errores: Record<string, string>; message?: string } | { status: "ok"; message: string }`
  - `BusquedaPersona = { status: "idle" } | { status: "error"; message: string } | { status: "listo"; documento: string; tipoDocumento: TipoDocumento; persona: Persona | null }`
  - `buscarPersonaAdmin(prev: BusquedaPersona, fd)` (campos `documento`, `tipo_documento`)
  - `inscribirManual(prev: EstadoAccion, fd)` (`taller_id`, ficha, `tarifa_id`, `notas`, `forzar`)
  - `guardarPersona(prev, fd)` (`persona_id`, ficha)
  - `asistencia(prev, fd)` (`ids[]`, `accion` = `marcar` | `quitar`)
  - `ajustarPorcentajeAccion(prev, fd)` (`id`, `porcentaje` = `auto` | `0..100`)
  - `cancelarAccion(prev, fd)` (`id`, `cancelada` = `si` | `no`)
  - `eliminarAccion(prev, fd)` (`id`)
  - `fusionarAccion(prev, fd)` (`origen_id`, `destino_id` o `destino_documento`)
- Produces (componentes): `Mensaje({ state }: { state: { status: string; message?: string } })`, `SelectorTaller({ talleres, actual, ruta }: { talleres: Taller[]; actual: string; ruta: string })`, `InscribirForm({ tallerId, tarifas, lleno }: { tallerId: string; tarifas: Tarifa[]; lleno: boolean })`, `OpcionPersona = { personaId: string; etiqueta: string }`, `InscritoFila({ inscrito, otros }: { inscrito: Inscrito; otros: OpcionPersona[] })`, `AsistenciaLote()` (formulario `id="asistencia-lote"`).
- Produces (ruta): `/admin/inscritos?taller=<id>&q=&estado=`.

- [ ] **Step 1: Mensaje compartido**

`src/components/admin/mensaje.tsx`:

```tsx
/**
 * Resultado de una acción del admin, junto al botón que la lanzó. Vale para
 * cualquier estado con `status` y `message` (talleres, inscritos, pagos…).
 */
export function Mensaje({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "error" && state.message)
    return (
      <p role="alert" className="text-[13px] text-red-600">
        {state.message}
      </p>
    );
  if (state.status === "ok" && state.message)
    return (
      <p role="status" className="text-[13px] text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}
```

En `src/components/admin/taller-acciones.tsx`, borra la función local `Mensaje` entera (desde `function Mensaje({ state }: { state: AccionState }) {` hasta su `}` de cierre, antes de `export function TallerAcciones`) y, tras `import { botonPrimario, botonSecundario, inputClass, tarjeta } from "./ui";`, añade:

```tsx
import { Mensaje } from "./mensaje";
```

- [ ] **Step 2: Selector de taller**

`src/components/admin/selector-taller.tsx`:

```tsx
import { ESTADO_ETIQUETA, type Taller } from "@/lib/talleres/tipos";
import { botonSecundario, inputClass } from "./ui";

/**
 * Elige el taller de la pantalla. Es un formulario GET sin JavaScript: la URL
 * queda con `?taller=<id>` y se puede guardar o compartir.
 */
export function SelectorTaller({
  talleres,
  actual,
  ruta,
}: {
  talleres: Taller[];
  actual: string;
  ruta: string;
}) {
  return (
    <form action={ruta} method="get" className="flex flex-wrap items-center gap-2">
      <label htmlFor="selector-taller" className="sr-only">
        Taller
      </label>
      <div className="w-[320px] max-w-full">
        <select id="selector-taller" name="taller" defaultValue={actual} className={inputClass}>
          {talleres.map((t) => (
            <option key={t.id} value={t.id}>
              {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")} · {t.fechasTexto} (
              {ESTADO_ETIQUETA[t.estado]})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={botonSecundario}>
        Ver
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Server actions de inscritos**

`src/app/admin/inscritos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { documentoValido, normalizarDocumento } from "@/lib/inscripciones/documento";
import { MENSAJES_INSCRIPCION, type MotivoInscripcion } from "@/lib/inscripciones/errores";
import { esUuid, leerPersonaForm } from "@/lib/inscripciones/formulario";
import {
  actualizarPersona,
  ajustarPorcentaje,
  buscarPersona,
  cambiarCancelada,
  crearInscripcion,
  eliminarInscripcion,
  fusionarPersonas,
  marcarAsistencia,
} from "@/lib/inscripciones/repo";
import { TIPOS_DOCUMENTO, type Persona, type TipoDocumento } from "@/lib/inscripciones/tipos";
import { obtenerTaller } from "@/lib/talleres/repo";

export type EstadoAccion =
  | { status: "idle" }
  | { status: "error"; errores: Record<string, string>; message?: string }
  | { status: "ok"; message: string };

const TEXTO_SESION = "Tu sesión venció. Recarga la página y vuelve a entrar.";
const SESION_VENCIDA: EstadoAccion = { status: "error", errores: {}, message: TEXTO_SESION };

function fallo(motivo: MotivoInscripcion, errores: Record<string, string> = {}): EstadoAccion {
  return { status: "error", errores, message: MENSAJES_INSCRIPCION[motivo] };
}

/** Inscritos, pagos, inicio y los cupos de la página pública dependen de esto. */
function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/taller");
}

function idDe(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "");
  return esUuid(v) ? v : null;
}

function referenciaNueva() {
  return `STA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export type BusquedaPersona =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "listo"; documento: string; tipoDocumento: TipoDocumento; persona: Persona | null };

/** Inscribir a mano, paso 1: el documento. Si la persona existe se autocompleta su ficha. */
export async function buscarPersonaAdmin(
  _prev: BusquedaPersona,
  fd: FormData,
): Promise<BusquedaPersona> {
  if (!(await isAdmin())) return { status: "error", message: TEXTO_SESION };

  const documento = normalizarDocumento(String(fd.get("documento") ?? ""));
  if (!documentoValido(documento)) return { status: "error", message: MENSAJES_INSCRIPCION.documento_invalido };

  const tipo = String(fd.get("tipo_documento") ?? "");
  const tipoElegido: TipoDocumento = (TIPOS_DOCUMENTO as readonly string[]).includes(tipo)
    ? (tipo as TipoDocumento)
    : "CC";

  const r = await buscarPersona(documento);
  if (!r.ok) return { status: "error", message: MENSAJES_INSCRIPCION[r.motivo] };
  return {
    status: "listo",
    documento,
    tipoDocumento: r.valor?.tipoDocumento ?? tipoElegido,
    persona: r.valor,
  };
}

/** Inscribir a mano, paso 2. Puede pasar del cupo si se marca «forzar». */
export async function inscribirManual(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const tallerId = idDe(fd, "taller_id");
  if (!tallerId) return fallo("taller_desconocido");

  const lectura = leerPersonaForm(fd, "admin");
  if (!lectura.ok) return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };

  const taller = await obtenerTaller(tallerId);
  if (!taller.ok) return fallo(taller.motivo === "sin_conexion" ? "sin_conexion" : "taller_desconocido");

  const tarifas = taller.valor.tarifas;
  const tarifa =
    tarifas.find((t) => t.id === String(fd.get("tarifa_id") ?? "")) ??
    tarifas.find((t) => t.destacada) ??
    tarifas[0];

  const r = await crearInscripcion({
    tallerId,
    referencia: referenciaNueva(),
    persona: lectura.datos,
    tarifa: tarifa ? { id: tarifa.id, nombre: tarifa.nombre } : { id: "general", nombre: "Cupo General" },
    // Se guarda el precio de la tarifa si lo tiene, aunque la página no lo muestre.
    monto: tarifa && tarifa.precio > 0 ? tarifa.precio : null,
    moneda: tarifa && tarifa.precio > 0 ? taller.valor.moneda : null,
    notas: lectura.notas,
    origen: "admin",
    forzarCupo: fd.get("forzar") === "on",
  });

  if (!r.ok) {
    if (r.motivo === "sin_cupos") {
      return fallo("sin_cupos", {
        forzar: "El taller está lleno. Marca «Inscribir aunque supere el cupo» para continuar.",
      });
    }
    if (r.motivo === "ya_inscrito") {
      return { status: "error", errores: {}, message: "Esa persona ya está inscrita en este taller." };
    }
    return fallo(r.motivo, r.motivo === "documento_invalido" ? { documento: MENSAJES_INSCRIPCION.documento_invalido } : {});
  }

  refrescar();
  return {
    status: "ok",
    message: r.valor.reactivada
      ? `Se reactivó su inscripción ${r.valor.referencia}.`
      : `Inscrita con la referencia ${r.valor.referencia}.`,
  };
}

export async function guardarPersona(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const personaId = idDe(fd, "persona_id");
  if (!personaId) return fallo("no_encontrado");

  const lectura = leerPersonaForm(fd, "admin");
  if (!lectura.ok) return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };

  const r = await actualizarPersona(personaId, lectura.datos);
  if (!r.ok) {
    return fallo(r.motivo, r.motivo === "documento_duplicado" ? { documento: MENSAJES_INSCRIPCION.documento_duplicado } : {});
  }
  refrescar();
  return { status: "ok", message: "Ficha guardada." };
}

/** Individual (un `ids`) o en lote (varios, desde el formulario `asistencia-lote`). */
export async function asistencia(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const ids = fd.getAll("ids").map(String).filter(esUuid);
  if (ids.length === 0) return { status: "error", errores: {}, message: "Marca al menos una persona." };
  const asistio = fd.get("accion") !== "quitar";

  const r = await marcarAsistencia(ids, asistio);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return {
    status: "ok",
    message: asistio ? `Asistencia marcada (${r.valor}).` : `Asistencia quitada (${r.valor}).`,
  };
}

export async function ajustarPorcentajeAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");
  const valor = String(fd.get("porcentaje") ?? "auto");
  const porcentaje = valor === "auto" ? null : Number(valor);
  if (porcentaje !== null && (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    return { status: "error", errores: {}, message: "Porcentaje no válido." };
  }

  const r = await ajustarPorcentaje(id, porcentaje);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return {
    status: "ok",
    message: `Pagado: ${r.valor}% ${porcentaje === null ? "(según comprobantes verificados)" : "(fijado a mano)"}.`,
  };
}

export async function cancelarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");
  const cancelada = fd.get("cancelada") === "si";

  const r = await cambiarCancelada(id, cancelada);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: cancelada ? "Inscripción cancelada: libera su cupo." : "Inscripción reactivada." };
}

export async function eliminarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");

  const r = await eliminarInscripcion(id);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: "Inscripción eliminada." };
}

/**
 * Fusiona la ficha `origen_id` en otra. El destino se elige de la lista del
 * taller (`destino_id`) o escribiendo su documento (`destino_documento`), para
 * duplicados que están en talleres distintos.
 */
export async function fusionarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const origen = idDe(fd, "origen_id");
  let destino = idDe(fd, "destino_id");
  const textoDocumento = String(fd.get("destino_documento") ?? "").trim();

  if (!destino && textoDocumento) {
    const documento = normalizarDocumento(textoDocumento);
    if (!documentoValido(documento)) {
      return { status: "error", errores: { destino_documento: "Documento no válido." } };
    }
    const p = await buscarPersona(documento);
    if (!p.ok) return fallo(p.motivo);
    if (!p.valor) {
      return { status: "error", errores: { destino_documento: "No hay ninguna persona con ese documento." } };
    }
    destino = p.valor.id;
  }

  if (!origen || !destino) return { status: "error", errores: {}, message: "Elige con quién fusionar." };

  const r = await fusionarPersonas(origen, destino);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: "Fichas fusionadas." };
}
```

- [ ] **Step 4: Formulario «Inscribir a mano»**

`src/components/admin/inscribir-form.tsx`:

```tsx
"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import {
  buscarPersonaAdmin,
  inscribirManual,
  type BusquedaPersona,
  type EstadoAccion,
} from "@/app/admin/inscritos/actions";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_ETIQUETA } from "@/lib/inscripciones/tipos";
import type { Tarifa } from "@/lib/talleres/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass } from "./ui";

const busquedaInicial: BusquedaPersona = { status: "idle" };
const inicial: EstadoAccion = { status: "idle" };

/** Envía sin que React vacíe el formulario, que es lo que hace tras cada `action`. */
function enviarCon(accion: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => accion(fd));
  };
}

/**
 * Inscribir a mano: cupos apartados por WhatsApp. Primero el documento; si la
 * persona ya existe, su ficha se rellena sola y aquí se puede corregir.
 */
export function InscribirForm({
  tallerId,
  tarifas,
  lleno,
}: {
  tallerId: string;
  tarifas: Tarifa[];
  lleno: boolean;
}) {
  const [busqueda, buscar, buscando] = useActionState(buscarPersonaAdmin, busquedaInicial);
  const [state, inscribir, inscribiendo] = useActionState(inscribirManual, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const persona = busqueda.status === "listo" ? busqueda.persona : null;
  const tarifaPorDefecto = tarifas.find((t) => t.destacada)?.id ?? tarifas[0]?.id ?? "";

  const campo = (name: string, label: string, valor: string | null | undefined, tipo = "text", requerido = false) => (
    <div>
      <label htmlFor={`inscribir-${name}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`inscribir-${name}`}
        name={name}
        type={tipo}
        required={requerido}
        defaultValue={valor ?? ""}
        aria-invalid={Boolean(errores[name])}
        className={inputClass}
      />
      {errores[name] && <p className={errorClass}>{errores[name]}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={enviarCon(buscar)} className="flex flex-wrap items-end gap-3">
        <div className="w-[13rem]">
          <label htmlFor="buscar-tipo" className={labelClass}>
            Tipo
          </label>
          <select id="buscar-tipo" name="tipo_documento" defaultValue="CC" className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[14rem]">
          <label htmlFor="buscar-documento" className={labelClass}>
            Documento
          </label>
          <input id="buscar-documento" name="documento" required maxLength={30} className={inputClass} />
        </div>
        <button type="submit" disabled={buscando} className={botonSecundario}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {busqueda.status === "error" && (
          <p role="alert" className="text-[13px] text-red-600">
            {busqueda.message}
          </p>
        )}
      </form>

      {busqueda.status === "listo" && (
        <form
          key={`${busqueda.documento}-${persona?.id ?? "nueva"}`}
          onSubmit={enviarCon(inscribir)}
          className="flex flex-col gap-4 border-t border-navy/10 pt-5"
        >
          <input type="hidden" name="taller_id" value={tallerId} />
          <input type="hidden" name="documento" value={busqueda.documento} />
          <input type="hidden" name="tipo_documento" value={busqueda.tipoDocumento} />
          <p className="text-[13.5px] text-ink">
            <strong>
              {busqueda.tipoDocumento} {busqueda.documento}
            </strong>{" "}
            · {persona ? "ya existe: se usa su ficha (puedes corregirla aquí)." : "persona nueva."}
          </p>
          {errores.documento && <p className={errorClass}>{errores.documento}</p>}

          {campo("nombre", "Nombre (sale en el certificado)", persona?.nombre, "text", true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("telefono", "WhatsApp (opcional)", persona?.telefono, "tel")}
            {campo("email", "Email (opcional)", persona?.email, "email")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("ciudad", "Ciudad (opcional)", persona?.ciudad)}
            {campo("profesion", "Profesión (opcional)", persona?.profesion)}
          </div>

          {tarifas.length > 1 ? (
            <div>
              <label htmlFor="inscribir-tarifa" className={labelClass}>
                Tarifa
              </label>
              <select id="inscribir-tarifa" name="tarifa_id" defaultValue={tarifaPorDefecto} className={inputClass}>
                {tarifas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="tarifa_id" value={tarifaPorDefecto} />
          )}

          <div>
            <label htmlFor="inscribir-notas" className={labelClass}>
              Notas (opcional)
            </label>
            <textarea
              id="inscribir-notas"
              name="notas"
              rows={2}
              maxLength={800}
              placeholder="Apartó cupo por WhatsApp el…"
              className={inputClass}
            />
          </div>

          {(lleno || errores.forzar) && (
            <div>
              <label className="flex items-center gap-2 text-[13.5px] text-navy">
                <input type="checkbox" name="forzar" />
                Inscribir aunque supere el cupo
              </label>
              {errores.forzar && <p className={errorClass}>{errores.forzar}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={inscribiendo} className={botonPrimario}>
              {inscribiendo ? "Inscribiendo…" : "Inscribir"}
            </button>
            <Mensaje state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Fila de inscrito y asistencia en lote**

`src/components/admin/asistencia-lote.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { asistencia, type EstadoAccion } from "@/app/admin/inscritos/actions";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario } from "./ui";

const inicial: EstadoAccion = { status: "idle" };
const SELECTOR = 'input[name="ids"][form="asistencia-lote"]';

/**
 * Asistencia en lote. Las casillas viven en cada fila (que tiene sus propios
 * formularios y no puede anidar este) y se asocian con el atributo
 * `form="asistencia-lote"`.
 */
export function AsistenciaLote() {
  const [state, action, pending] = useActionState(asistencia, inicial);

  function seleccionar(valor: boolean) {
    document.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((c) => {
      c.checked = valor;
    });
  }

  return (
    <form id="asistencia-lote" action={action} className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => seleccionar(true)} className={botonSecundario}>
        Seleccionar todos
      </button>
      <button type="button" onClick={() => seleccionar(false)} className={botonSecundario}>
        Ninguno
      </button>
      <button type="submit" name="accion" value="marcar" disabled={pending} className={botonPrimario}>
        Marcar asistencia
      </button>
      <button type="submit" name="accion" value="quitar" disabled={pending} className={botonSecundario}>
        Quitar asistencia
      </button>
      <Mensaje state={state} />
    </form>
  );
}
```

`src/components/admin/inscrito-fila.tsx`:

```tsx
"use client";

import { startTransition, useActionState, type InputHTMLAttributes } from "react";
import {
  ajustarPorcentajeAccion,
  asistencia,
  cancelarAccion,
  eliminarAccion,
  fusionarAccion,
  guardarPersona,
  type EstadoAccion,
} from "@/app/admin/inscritos/actions";
import { estadoPago } from "@/lib/inscripciones/pagos";
import {
  ESTADO_PAGO_ETIQUETA,
  ORIGEN_ETIQUETA,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_ETIQUETA,
  type EstadoPago,
  type Inscrito,
} from "@/lib/inscripciones/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

export type OpcionPersona = { personaId: string; etiqueta: string };

const COLOR_ESTADO: Record<EstadoPago, string> = {
  pendiente: "bg-sand text-navy",
  abonado: "bg-ice text-navy",
  pagado: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-red-50 text-red-700",
};

export function InscritoFila({ inscrito: i, otros }: { inscrito: Inscrito; otros: OpcionPersona[] }) {
  const estado = estadoPago(i);
  const [asisState, asisAction, asisPending] = useActionState(asistencia, inicial);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <input
          type="checkbox"
          name="ids"
          value={i.id}
          form="asistencia-lote"
          aria-label={`Seleccionar a ${i.persona.nombre}`}
          className="mt-1.5 accent-azure"
        />
        <div className="min-w-[220px] flex-1">
          <p className="text-[15px] font-semibold text-navy">{i.persona.nombre}</p>
          <p className="text-[12.5px] text-ink-soft">
            {i.persona.documento ? (
              `${i.persona.tipoDocumento} ${i.persona.documento}`
            ) : (
              <span className="font-semibold text-red-700">Por identificar</span>
            )}
            {[i.persona.telefono, i.persona.email]
              .filter(Boolean)
              .map((c) => ` · ${c}`)
              .join("")}
          </p>
          <p className="text-[12px] text-ink-soft">
            <span className="font-mono">{i.referencia}</span> · {i.tarifaNombre} · {ORIGEN_ETIQUETA[i.origen]}
          </p>
          {i.certificado && (
            <p className="text-[12px]">
              Certificado{" "}
              <a
                href={`/certificado/${i.certificado.codigo}`}
                target="_blank"
                rel="noopener"
                className="font-mono text-azure hover:underline"
              >
                {i.certificado.codigo}
              </a>
              {i.certificado.revocado && <span className="ml-1 text-red-700">(revocado)</span>}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${COLOR_ESTADO[estado]}`}>
            {ESTADO_PAGO_ETIQUETA[estado]} · {i.porcentajePagado}%
          </span>
          {i.porcentajeEnRevision > 0 && (
            <p className="mt-1 text-[11.5px] text-ink-soft">{i.porcentajeEnRevision}% por revisar</p>
          )}
          {i.porcentajeManual && <p className="mt-1 text-[11.5px] text-ink-soft">fijado a mano</p>}
        </div>
        <form action={asisAction}>
          <input type="hidden" name="ids" value={i.id} />
          <input type="hidden" name="accion" value={i.asistio ? "quitar" : "marcar"} />
          <button
            type="submit"
            disabled={asisPending}
            className={i.asistio ? `${botonSecundario} border-emerald-400 text-emerald-800` : botonSecundario}
          >
            {i.asistio ? "✓ Asistió" : "Marcar asistencia"}
          </button>
        </form>
      </div>
      <Mensaje state={asisState} />
      {i.notas && <p className="mt-2 text-[12.5px] whitespace-pre-line text-ink">{i.notas}</p>}

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-azure">Gestionar</summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <FichaForm inscrito={i} />
          <div className="flex flex-col gap-5">
            <PorcentajeForm inscrito={i} />
            <CancelarForm inscrito={i} />
            <FusionarForm inscrito={i} otros={otros} />
            <EliminarForm inscrito={i} />
          </div>
        </div>
      </details>
    </li>
  );
}

function FichaForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(guardarPersona, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const p = i.persona;

  const campo = (
    name: string,
    label: string,
    valor: string | null,
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`${name}-${i.id}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`${name}-${i.id}`}
        name={name}
        defaultValue={valor ?? ""}
        aria-invalid={Boolean(errores[name])}
        className={inputClass}
        {...extra}
      />
      {errores[name] && <p className={errorClass}>{errores[name]}</p>}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        // A mano: React vaciaría el formulario tras la acción y un error
        // borraría lo corregido.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-[15px] text-navy">Ficha de la persona</h3>
      <input type="hidden" name="persona_id" value={p.id} />
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <div>
          <label htmlFor={`tipo-${i.id}`} className={labelClass}>
            Tipo
          </label>
          <select id={`tipo-${i.id}`} name="tipo_documento" defaultValue={p.tipoDocumento} className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </div>
        {campo("documento", "Documento", p.documento, { required: true, maxLength: 30 })}
      </div>
      {campo("nombre", "Nombre (sale en el certificado)", p.nombre, { required: true, maxLength: 120 })}
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("telefono", "WhatsApp", p.telefono, { type: "tel", maxLength: 40 })}
        {campo("email", "Email", p.email, { type: "email", maxLength: 160 })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("ciudad", "Ciudad", p.ciudad, { maxLength: 80 })}
        {campo("profesion", "Profesión", p.profesion, { maxLength: 120 })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={botonPrimario}>
          {pending ? "Guardando…" : "Guardar ficha"}
        </button>
        <Mensaje state={state} />
      </div>
    </form>
  );
}

function PorcentajeForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(ajustarPorcentajeAccion, inicial);
  return (
    // La `key` remonta el select cuando el valor cambia en el servidor:
    // `defaultValue` solo se lee al montar.
    <form key={`${i.porcentajePagado}-${i.porcentajeManual}`} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={i.id} />
      <div className="w-[17rem]">
        <label htmlFor={`pct-${i.id}`} className={labelClass}>
          % pagado
        </label>
        <select
          id={`pct-${i.id}`}
          name="porcentaje"
          defaultValue={i.porcentajeManual ? String(i.porcentajePagado) : "auto"}
          className={inputClass}
        >
          <option value="auto">Según comprobantes verificados</option>
          {[0, 25, 50, 75, 100].map((p) => (
            <option key={p} value={p}>
              {p}% (fijado a mano)
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={botonSecundario}>
        Aplicar
      </button>
      <Mensaje state={state} />
    </form>
  );
}

function CancelarForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(cancelarAccion, inicial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!i.cancelada && !confirm("¿Cancelar esta inscripción? Libera su cupo.")) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={i.id} />
      <input type="hidden" name="cancelada" value={i.cancelada ? "no" : "si"} />
      <button type="submit" disabled={pending} className={botonSecundario}>
        {i.cancelada ? "Reactivar inscripción" : "Cancelar inscripción"}
      </button>
      <Mensaje state={state} />
    </form>
  );
}

function FusionarForm({ inscrito: i, otros }: { inscrito: Inscrito; otros: OpcionPersona[] }) {
  const [state, action, pending] = useActionState(fusionarAccion, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const candidatos = otros.filter((o) => o.personaId !== i.persona.id);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `¿Fusionar la ficha de ${i.persona.nombre} en la persona elegida? Sus inscripciones y comprobantes pasan a ella y esta ficha desaparece.`,
          )
        )
          e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <p className={labelClass}>Fusionar esta ficha en otra (duplicados)</p>
      <input type="hidden" name="origen_id" value={i.persona.id} />
      <select name="destino_id" defaultValue="" aria-label="Persona destino" className={inputClass}>
        <option value="">Elige una persona de este taller…</option>
        {candidatos.map((o) => (
          <option key={o.personaId} value={o.personaId}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <input
        name="destino_documento"
        placeholder="…o escribe el documento de la persona destino"
        aria-label="Documento de la persona destino"
        aria-invalid={Boolean(errores.destino_documento)}
        className={inputClass}
      />
      {errores.destino_documento && <p className={errorClass}>{errores.destino_documento}</p>}
      <p className="text-[12px] text-ink-soft">
        Se conservan los datos de la persona elegida; de esta solo se toma lo que a aquella le falte
        (documento, email…). Si las dos están en el mismo taller, sus inscripciones se unen en una.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={botonSecundario}>
          Fusionar
        </button>
        <Mensaje state={state} />
      </div>
    </form>
  );
}

function EliminarForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(eliminarAccion, inicial);

  if (i.comprobantesVerificados > 0) {
    return (
      <p className="text-[12.5px] text-ink-soft">
        Tiene pagos verificados: no se puede eliminar (cancélala si ya no viene).
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta inscripción y sus comprobantes sin verificar? No se puede deshacer."))
          e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={i.id} />
      <button
        type="submit"
        disabled={pending}
        className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
      >
        Eliminar inscripción
      </button>
      <Mensaje state={state} />
    </form>
  );
}
```

- [ ] **Step 6: Página de inscritos**

`src/app/admin/inscritos/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AsistenciaLote } from "@/components/admin/asistencia-lote";
import { InscribirForm } from "@/components/admin/inscribir-form";
import { InscritoFila, type OpcionPersona } from "@/components/admin/inscrito-fila";
import { LoginScreen } from "@/components/admin/login-screen";
import { SelectorTaller } from "@/components/admin/selector-taller";
import { AdminShell } from "@/components/admin/shell";
import { botonSecundario, inputClass, labelClass, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { FILTRO_ETIQUETA, FILTROS_ESTADO, filtrarInscritos, leerFiltro } from "@/lib/inscripciones/filtros";
import { estadoPago } from "@/lib/inscripciones/pagos";
import { listarInscritos } from "@/lib/inscripciones/repo";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";
import { listarTalleres, obtenerDisponibilidad } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

// Sin esto el build (que no tiene CERTIFICADOS_PASSWORD) la congela como 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inscritos · STA",
  robots: { index: false, follow: false },
};

type Busqueda = { taller?: string; q?: string; estado?: string };

export default async function InscritosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  const [talleres, preferido] = await Promise.all([listarTalleres(), tallerIdParaAdmin(sp.taller)]);

  if (talleres === null) {
    return (
      <AdminShell titulo="Inscritos">
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      </AdminShell>
    );
  }

  const taller = talleres.find((t) => t.id === preferido) ?? talleres[0];
  if (!taller) {
    return (
      <AdminShell titulo="Inscritos">
        <p className={tarjeta}>Todavía no hay talleres.</p>
      </AdminShell>
    );
  }

  const [inscritos, disp] = await Promise.all([listarInscritos(taller.id), obtenerDisponibilidad(taller.slug)]);
  const filtro = leerFiltro(sp);
  const lista = inscritos ?? [];
  const visibles = filtrarInscritos(lista, filtro);
  const otros: OpcionPersona[] = lista.map((i) => ({
    personaId: i.persona.id,
    etiqueta: `${i.persona.nombre} · ${i.persona.documento ?? "por identificar"} · ${i.referencia}`,
  }));
  const activos = lista.filter((i) => !i.cancelada);
  const pagados = activos.filter((i) => estadoPago(i) === "pagado").length;
  const asistieron = activos.filter((i) => i.asistio).length;

  return (
    <AdminShell
      titulo="Inscritos"
      subtitulo={
        <>
          {[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")} · {taller.fechasTexto} ·{" "}
          {ESTADO_ETIQUETA[taller.estado]}
          {disp && ` · ${disp.ocupados}/${disp.total} cupos`}
        </>
      }
      acciones={<SelectorTaller talleres={talleres} actual={taller.id} ruta="/admin/inscritos" />}
    >
      <details className={`${tarjeta} mb-5`}>
        <summary className="cursor-pointer text-[15px] font-semibold text-navy">Inscribir a mano</summary>
        <div className="mt-4">
          <InscribirForm tallerId={taller.id} tarifas={taller.tarifas} lleno={disp ? disp.libres <= 0 : false} />
        </div>
      </details>

      <form action="/admin/inscritos" method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="taller" value={taller.id} />
        <div className="w-[18rem] max-w-full">
          <label htmlFor="q" className={labelClass}>
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filtro.q}
            placeholder="Nombre, documento, email o referencia"
            className={inputClass}
          />
        </div>
        <div className="w-[12rem]">
          <label htmlFor="estado" className={labelClass}>
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={filtro.estado} className={inputClass}>
            {FILTROS_ESTADO.map((e) => (
              <option key={e} value={e}>
                {FILTRO_ETIQUETA[e]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={botonSecundario}>
          Filtrar
        </button>
        {(filtro.q || filtro.estado !== "todos") && (
          <Link
            href={`/admin/inscritos?taller=${taller.id}`}
            className="text-[13px] font-semibold text-azure hover:underline"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {inscritos === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-soft">
            {activos.length} activos · {pagados} con el 100% · {asistieron} con asistencia
            {lista.length > activos.length && ` · ${lista.length - activos.length} canceladas`}
          </p>
          <div className="mb-3">
            <AsistenciaLote />
          </div>
          {visibles.length === 0 ? (
            <p className={tarjeta}>
              {lista.length === 0 ? "Nadie inscrito todavía." : "Nadie coincide con el filtro."}
            </p>
          ) : (
            <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
              {visibles.map((i) => (
                <InscritoFila key={i.id} inscrito={i} otros={otros} />
              ))}
            </ul>
          )}
        </>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; `admin-dinamico.test.ts` incluye ahora `src/app/admin/inscritos/page.tsx` y pasa.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/inscritos src/components/admin
git commit -m "feat(admin): inscritos por taller con pagos, asistencia, fichas y fusión

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin — pagos, inicio y navegación

**Files:**
- Create: `src/app/admin/pagos/actions.ts`, `src/app/admin/pagos/page.tsx`, `src/app/admin/pagos/archivo/[id]/route.ts`, `src/components/admin/comprobante-revision.tsx`
- Modify: `src/app/admin/page.tsx` (completo), `src/components/admin/shell.tsx` (enlaces), `src/app/admin/talleres/[id]/page.tsx` (enlaces), `src/app/admin/certificados/page.tsx` (texto)

**Interfaces:**
- Consumes: Task 4 `listarComprobantes`, `revisarComprobante`, `urlFirmadaComprobante`, `resumenInicio`; Task 6 `EstadoAccion`, `Mensaje`; Task 2 `esUuid`; `ESTADOS_COMPROBANTE`, `ESTADO_COMPROBANTE_ETIQUETA`, `TIPO_DOCUMENTO_ETIQUETA`; `ZONA_HORARIA` (`src/lib/talleres/reglas.ts`).
- Produces: `revisarAccion(prev: EstadoAccion, fd: FormData): Promise<EstadoAccion>` (campos `id`, `estado` = `verified` | `rejected` | `pending`, `nota`); `GET /admin/pagos/archivo/<id>` → 302 a una URL firmada de 120 s (404 sin sesión o sin archivo); `ComprobanteRevision({ c, fecha }: { c: ComprobanteAdmin; fecha: string })`; ruta `/admin/pagos?estado=&taller=`.

- [ ] **Step 1: Acción de revisión**

`src/app/admin/pagos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { isAdmin } from "@/lib/admin-auth";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { esUuid } from "@/lib/inscripciones/formulario";
import { revisarComprobante } from "@/lib/inscripciones/repo";
import {
  ESTADO_COMPROBANTE_ETIQUETA,
  ESTADOS_COMPROBANTE,
  type EstadoComprobante,
} from "@/lib/inscripciones/tipos";

const SESION_VENCIDA: EstadoAccion = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

/** Verificar, rechazar o devolver a «por revisar». La base recalcula lo pagado. */
export async function revisarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  const estado = String(fd.get("estado") ?? "") as EstadoComprobante;
  if (!esUuid(id) || !ESTADOS_COMPROBANTE.includes(estado)) {
    return { status: "error", errores: {}, message: "Datos no válidos. Recarga la página." };
  }
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 500);

  const r = await revisarComprobante(id, estado, nota);
  if (!r.ok) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION[r.motivo] };

  revalidatePath("/admin", "layout");
  return {
    status: "ok",
    message: `${ESTADO_COMPROBANTE_ETIQUETA[estado]}. La inscripción lleva ${r.valor}% pagado.`,
  };
}
```

- [ ] **Step 2: Archivo del comprobante por URL firmada**

`src/app/admin/pagos/archivo/[id]/route.ts`:

```ts
import { isAdmin } from "@/lib/admin-auth";
import { esUuid } from "@/lib/inscripciones/formulario";
import { urlFirmadaComprobante } from "@/lib/inscripciones/repo";

// Lee la cookie de sesión en cada petición: nada que cachear.
export const dynamic = "force-dynamic";

/**
 * Abre el comprobante. El bucket es privado: se firma una URL de dos minutos
 * en el momento del clic, así un enlace copiado de la pantalla caduca solo.
 * La cookie del admin tiene `path=/admin`, por eso la ruta vive aquí.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("No encontrado", { status: 404 });

  const { id } = await ctx.params;
  if (!esUuid(id)) return new Response("No encontrado", { status: 404 });

  const url = await urlFirmadaComprobante(id);
  if (!url) return new Response("No encontrado", { status: 404 });

  return Response.redirect(url, 302);
}
```

- [ ] **Step 3: Tarjeta de revisión**

`src/components/admin/comprobante-revision.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { revisarAccion } from "@/app/admin/pagos/actions";
import { ESTADO_COMPROBANTE_ETIQUETA, type ComprobanteAdmin } from "@/lib/inscripciones/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, inputClass } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

const COLOR: Record<ComprobanteAdmin["estado"], string> = {
  pending: "bg-sand text-navy",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-50 text-red-700",
};

/** `fecha` llega formateada del servidor: así no hay diferencias de hidratación. */
export function ComprobanteRevision({ c, fecha }: { c: ComprobanteAdmin; fecha: string }) {
  const [state, action, pending] = useActionState(revisarAccion, inicial);
  const archivo = `/admin/pagos/archivo/${c.id}`;
  const esImagen = /^image\/(jpeg|png|webp)$/.test(c.fileType);

  return (
    <li className="grid gap-4 px-5 py-5 sm:grid-cols-[8rem_1fr]">
      <a href={archivo} target="_blank" rel="noopener" className="block" title="Abrir el comprobante">
        {esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada y privada; next/image la cachearía
          <img src={archivo} alt={`Comprobante de ${c.personaNombre}`} className="size-32 rounded-lg object-cover" />
        ) : (
          <span className="flex size-32 items-center justify-center rounded-lg bg-cream text-[12px] font-semibold text-navy">
            {c.fileType === "application/pdf" ? "PDF" : "HEIC"} · abrir
          </span>
        )}
      </a>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[15px] font-semibold text-navy">{c.personaNombre}</p>
          <span className={`rounded-full px-3 py-0.5 text-[12px] font-semibold ${COLOR[c.estado]}`}>
            {ESTADO_COMPROBANTE_ETIQUETA[c.estado]}
          </span>
        </div>
        <p className="text-[12.5px] text-ink-soft">
          {c.personaDocumento ? `${c.personaTipoDocumento} ${c.personaDocumento}` : "Por identificar"} ·{" "}
          <span className="font-mono">{c.referencia}</span> · {c.tallerNombre}
        </p>
        <p className="mt-1 text-[13.5px] text-ink">
          Cubre <strong>{c.porcentaje}%</strong> · subido el {fecha} · la inscripción lleva{" "}
          {c.porcentajePagado}%
          {c.porcentajeManual && " (fijado a mano: verificar no lo cambia)"}
        </p>
        {c.notas && <p className="mt-1 text-[13px] text-ink">«{c.notas}»</p>}

        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="id" value={c.id} />
          <textarea
            name="nota"
            defaultValue={c.notaAdmin ?? ""}
            rows={2}
            maxLength={500}
            placeholder="Nota (opcional): motivo del rechazo, banco, fecha…"
            aria-label="Nota del admin"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-3">
            {c.estado !== "verified" && (
              <button type="submit" name="estado" value="verified" disabled={pending} className={botonPrimario}>
                Verificar
              </button>
            )}
            {c.estado !== "rejected" && (
              <button
                type="submit"
                name="estado"
                value="rejected"
                disabled={pending}
                className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
              >
                Rechazar
              </button>
            )}
            {c.estado !== "pending" && (
              <button type="submit" name="estado" value="pending" disabled={pending} className={botonSecundario}>
                Volver a por revisar
              </button>
            )}
            <Mensaje state={state} />
          </div>
        </form>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Página de pagos**

`src/app/admin/pagos/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComprobanteRevision } from "@/components/admin/comprobante-revision";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/shell";
import { botonSecundario, inputClass, labelClass, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { esUuid } from "@/lib/inscripciones/formulario";
import { listarComprobantes } from "@/lib/inscripciones/repo";
import { ZONA_HORARIA } from "@/lib/talleres/reglas";
import { listarTalleres } from "@/lib/talleres/repo";

// Sin esto el build (que no tiene CERTIFICADOS_PASSWORD) la congela como 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagos · STA",
  robots: { index: false, follow: false },
};

const FILTRO_ESTADO = [
  { valor: "pending", etiqueta: "Por revisar" },
  { valor: "verified", etiqueta: "Verificados" },
  { valor: "rejected", etiqueta: "Rechazados" },
  { valor: "todos", etiqueta: "Todos" },
] as const;

type Busqueda = { estado?: string; taller?: string };

export default async function PagosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  const estado = FILTRO_ESTADO.find((e) => e.valor === sp.estado)?.valor ?? "pending";
  const tallerId = sp.taller && esUuid(sp.taller) ? sp.taller : null;
  const [talleres, comprobantes] = await Promise.all([
    listarTalleres(),
    listarComprobantes({ estado, tallerId }),
  ]);
  const formato = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONA_HORARIA,
  });

  return (
    <AdminShell
      titulo="Pagos"
      subtitulo="Comprobantes subidos desde la página. Verificar suma su porcentaje a la inscripción."
    >
      <form action="/admin/pagos" method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-[12rem]">
          <label htmlFor="estado" className={labelClass}>
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={estado} className={inputClass}>
            {FILTRO_ESTADO.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[22rem] max-w-full">
          <label htmlFor="taller" className={labelClass}>
            Taller
          </label>
          <select id="taller" name="taller" defaultValue={tallerId ?? ""} className={inputClass}>
            <option value="">Todos los talleres</option>
            {(talleres ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")} · {t.fechasTexto}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={botonSecundario}>
          Filtrar
        </button>
      </form>

      {comprobantes === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : comprobantes.length === 0 ? (
        <p className={tarjeta}>No hay comprobantes con ese filtro.</p>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
          {comprobantes.map((c) => (
            <ComprobanteRevision key={c.id} c={c} fecha={formato.format(new Date(c.creadoEn))} />
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 5: Inicio con lo pendiente**

Reemplaza `src/app/admin/page.tsx` entero por:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/shell";
import { botonPrimario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { resumenInicio } from "@/lib/inscripciones/repo";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA, ESTADOS_TALLER } from "@/lib/talleres/tipos";
import { nombreCurso } from "@/lib/talleres/vista";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración · STA",
  robots: { index: false, follow: false },
};

function Cifra({ href, valor, texto }: { href: string; valor: number; texto: string }) {
  return (
    <Link href={href} className={`${tarjeta} block transition-colors duration-200 hover:bg-ice/40`}>
      <p className="text-[32px] leading-none text-navy">{valor}</p>
      <p className="mt-2 text-[13px] text-ink">{texto}</p>
    </Link>
  );
}

export default async function AdminPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const [publico, talleres] = await Promise.all([cargarTallerPublico(), listarTalleres()]);

  if (talleres === null || publico.kind === "sin_conexion") {
    return (
      <AdminShell titulo="Inicio">
        <p className={tarjeta}>
          No se pudo consultar la base de datos. Revisa que SUPABASE_URL y
          SUPABASE_SERVICE_ROLE_KEY estén configuradas.
        </p>
      </AdminShell>
    );
  }

  const tallerId = publico.kind === "ok" ? publico.vista.id : null;
  const resumen = await resumenInicio(tallerId);
  const seats = publico.kind === "ok" ? publico.vista.seats : null;
  const pct = seats && seats.total > 0 ? Math.min(100, Math.round((seats.ocupados / seats.total) * 100)) : 0;

  const conteo = ESTADOS_TALLER.map((e) => ({
    estado: e,
    n: talleres.filter((t) => t.estado === e).length,
  })).filter((c) => c.n > 0);

  return (
    <AdminShell
      titulo="Inicio"
      acciones={
        <Link href="/admin/talleres/nuevo" className={botonPrimario}>
          Nuevo taller
        </Link>
      }
    >
      <section className={tarjeta}>
        <p className="text-[12.5px] font-semibold tracking-[0.08em] text-azure uppercase">
          Taller en la página
        </p>
        {publico.kind === "ok" ? (
          <>
            <h2 className="mt-2 text-[22px] text-navy">{nombreCurso(publico.vista)}</h2>
            <p className="mt-1 text-[14px] text-ink">
              {publico.vista.dates.label} · {publico.vista.venue.name}, {publico.vista.venue.city} ·{" "}
              <strong>{ESTADO_ETIQUETA[publico.vista.estado]}</strong>
            </p>
            {seats && (
              <p className="mt-3 text-[14px] text-ink">
                Cupos: {seats.ocupados}/{seats.total} ocupados ({pct}%) · {seats.libres} libres
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-4 text-[14px] font-semibold">
              <Link href={`/admin/inscritos?taller=${publico.vista.id}`} className="text-azure hover:underline">
                Inscritos
              </Link>
              <Link href={`/admin/pagos?taller=${publico.vista.id}`} className="text-azure hover:underline">
                Pagos
              </Link>
            </p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-ink">
            Ningún taller visible: la página muestra «Próxima edición pronto».
          </p>
        )}
      </section>

      {resumen && (
        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <Cifra href="/admin/pagos" valor={resumen.comprobantesPorRevisar} texto="comprobantes por revisar" />
          {resumen.pagoIncompleto !== null && tallerId && (
            <Cifra
              href={`/admin/inscritos?taller=${tallerId}`}
              valor={resumen.pagoIncompleto}
              texto="inscritos con pago incompleto en este taller"
            />
          )}
          <Cifra
            href={tallerId ? `/admin/inscritos?taller=${tallerId}&estado=sin_documento` : "/admin/inscritos?estado=sin_documento"}
            valor={resumen.porIdentificar}
            texto="personas por identificar (sin documento)"
          />
        </section>
      )}

      <section className={`${tarjeta} mt-5`}>
        <p className="text-[12.5px] font-semibold tracking-[0.08em] text-azure uppercase">Talleres</p>
        <p className="mt-2 text-[14px] text-ink">
          {conteo.length === 0
            ? "Todavía no hay talleres."
            : conteo.map((c) => `${c.n} ${ESTADO_ETIQUETA[c.estado].toLowerCase()}`).join(" · ")}
        </p>
        <Link href="/admin/talleres" className="mt-3 inline-block text-[14px] font-semibold text-azure hover:underline">
          Ver todos
        </Link>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 6: Navegación y enlaces**

En `src/components/admin/shell.tsx`, sustituye:

```tsx
const enlaces = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/talleres", label: "Talleres" },
  { href: "/admin/certificados", label: "Certificados" },
];
```

por:

```tsx
const enlaces = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/talleres", label: "Talleres" },
  { href: "/admin/inscritos", label: "Inscritos" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/certificados", label: "Certificados" },
];
```

En `src/app/admin/talleres/[id]/page.tsx`, sustituye:

```tsx
          {disp && ` · ${disp.ocupados}/${disp.total} cupos ocupados`} ·{" "}
          <Link href={`/admin/certificados?taller=${taller.slug}`} className="text-azure hover:underline">
            Certificados
          </Link>
```

por:

```tsx
          {disp && ` · ${disp.ocupados}/${disp.total} cupos ocupados`} ·{" "}
          <Link href={`/admin/inscritos?taller=${taller.id}`} className="text-azure hover:underline">
            Inscritos
          </Link>{" "}
          ·{" "}
          <Link href={`/admin/pagos?taller=${taller.id}`} className="text-azure hover:underline">
            Pagos
          </Link>{" "}
          ·{" "}
          <Link href={`/admin/certificados?taller=${taller.slug}`} className="text-azure hover:underline">
            Certificados
          </Link>
```

En `src/app/admin/certificados/page.tsx`, sustituye:

```tsx
            Todavía no hay nadie con certificado. Aparecen aquí las reservas que tengan{" "}
            <strong>status «confirmed»</strong> y la casilla <strong>attended</strong>{" "}
            marcada en Supabase.
```

por:

```tsx
            Todavía no hay nadie con certificado. Aparecen aquí las inscripciones con{" "}
            <strong>100% pagado</strong> y <strong>asistencia</strong> marcada (en Inscritos).
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde; `next build` lista `/admin/inscritos`, `/admin/pagos` y `/admin/pagos/archivo/[id]` como dinámicas (`ƒ`).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin src/components/admin
git commit -m "feat(admin): bandeja de pagos con vista previa firmada e inicio con pendientes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: PUERTA MANUAL — migración a producción y despliegue de la etapa 2

**Files:** ninguno (solo verificación y despliegue).

**Interfaces:**
- Consumes: Tasks 1–7 comiteadas y sin push.
- Produces: producción migrada (`personas`, `inscripciones`, `comprobantes`, `_legacy_*`) y la etapa 2 desplegada.

- [ ] **Step 1: Verificación completa en local**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build && ./scripts/probar-migraciones.sh 2>&1 | tail -n 3`
Expected: todo en verde; el script termina con `Todo en verde.`.

- [ ] **Step 2: PUERTA MANUAL — el controlador aplica la migración y despliega**

Detente y pide al usuario, textualmente:

> 1. Haz un backup en Supabase → Database → Backups.
> 2. Ejecuta `SUPABASE_DB_URL='postgresql://…(session pooler)…' ./scripts/migrar.sh supabase/migrations/20261015_01_inscripciones.sql`.
>    - En «Punto de partida» comprueba que **ningún taller está `publicado`** y que `sin_reserva = 0`. Si no se cumple, escribe cualquier cosa distinta de «si» para cancelar y avísame.
>    - Escribe `si`. En «Verificación» debe salir `inscripciones` = `_legacy_reservations` (8) y `comprobantes` = `_legacy_payment_proofs` (8).
> 3. **Justo después**, `git push origin main` (dispara GitHub Actions → Dokploy). Hasta que termine el despliegue (≈5–10 min) no edites ni elimines talleres en el admin.
> 4. Cuando el despliegue termine, dime «desplegado» y el resultado de la verificación.

- [ ] **Step 3: Comprobación en producción (navegador)**

Con la etapa 2 servida, en `https://<sitio>/admin`:

1. Inicio: «Taller en la página» = `taller-2026-10` **Finalizado**; «8 comprobantes por revisar»; «personas por identificar» con el número que dio la verificación.
2. Inscritos: salen las 8 inscripciones con su referencia `STA-…`; las del documento repetido llevan la nota «Migración: el documento … ya tenía otra reserva…». Filtro «Por identificar» muestra solo las sin documento. La de prueba aparece **Pagado · 100% · fijado a mano** y «✓ Asistió».
3. Pagos: 8 comprobantes «Por revisar» con miniatura (o «PDF/HEIC · abrir»); al pulsar uno se abre el archivo; copiar esa URL y abrirla pasados 2 minutos da error (firmada y caducada).
4. `/certificado/<referencia de la prueba>` sigue mostrando la hoja (vista de compatibilidad).
5. Flujo completo con un taller de prueba (hazlo rápido: mientras esté publicado es visible):
   - Talleres → Nuevo: «Prueba etapa 2», 2030-02-10 a 2030-02-11, cupos 2, porcentajes 50 y 100 → Publicar.
   - `/taller`: reservar con documento `99.999.999`, nombre «Prueba Etapa Dos» → «Reserva registrada». Repetir con el mismo documento → «Ya tienes una reserva».
   - Registrar pago: documento `99999999` → datos enmascarados («Pr**** Et*** D**», `pr***@…`, `*** *** **NN`), opciones «Abono del 50%» y «Pago completo (100%)». Corregir nombre a «Prueba Etapa Dos Corregida», elegir 50%, subir una imagen pequeña, aceptar condición y autorización → «Pago registrado» con la referencia.
   - Volver a «Registrar pago» con el mismo documento → «Llevas pagado 0% · 50% en revisión» y solo «Saldo restante (50%)».
   - Admin → Pagos: verificar el comprobante → «La inscripción lleva 50% pagado». Inscritos (taller de prueba): «Abonado · 50%», nombre corregido.
   - Inscribir a mano el documento `88888888` (nombre «Manual Prueba»), solo con nombre → «Inscrita con la referencia …». Marcar asistencia en lote a los dos.
   - Limpieza: Pagos → rechazar el comprobante; Inscritos → eliminar las dos inscripciones; Talleres → eliminar «Prueba etapa 2». `/taller` vuelve a `taller-2026-10` finalizado.
6. Lo que queda para el dueño (no automático): fusionar los duplicados reales desde Inscritos → Gestionar → Fusionar, y completar los documentos «por identificar».

Si este paso lo ejecuta un agente sin navegador, lista estos puntos en su informe como pendientes para el usuario.

No hay commit en esta tarea.

---

# ETAPA 3 — Certificados


### Task 9: Dominio puro de certificados

**Files:**
- Create: `src/lib/certificados/tipos.ts`, `src/lib/certificados/codigo.ts`, `src/lib/certificados/hoja.ts`, `src/lib/certificados/mapeo.ts`
- Test: `src/lib/certificados/__tests__/codigo.test.ts`, `hoja.test.ts`, `mapeo.test.ts`

**Interfaces:**
- Consumes: `TipoDocumento` (Task 1), `aTipoDocumento` (Task 4), `ZONA_HORARIA`.
- Produces (`tipos.ts`): `Certificado = { id; codigo; inscripcionId; tallerId; referencia; nombre; tipoDocumento: TipoDocumento; documento: string | null; curso; fechasTexto; sede; ciudad; region: string | null; horas: number | null; aval: string | null; firmaNombre: string | null; firmaCargo: string | null; firmaDocumento: string | null; emitidoEn: string; revocadoEn: string | null; revocadoManual: boolean }` (todos los demás `string`), `CertificadoPublico = { codigo: string; curso: string; fechasTexto: string }`.
- Produces (`codigo.ts`): `ALFABETO_CODIGO`, `normalizarCodigo(texto: string): string | null`, `esReferencia(texto: string): boolean`.
- Produces (`hoja.ts`): `documentoImpreso(tipo: TipoDocumento, documento: string | null): string`, `tallaNombre(nombre: string): number` (mm), `fechaLarga(iso: string): string`.
- Produces (`mapeo.ts`): `FilaCertificado`, `COLUMNAS_CERTIFICADO`, `filaACertificado(f: FilaCertificado): Certificado`.

- [ ] **Step 1: Tipos**

`src/lib/certificados/tipos.ts`:

```ts
import type { TipoDocumento } from "@/lib/inscripciones/tipos";

/**
 * Un certificado tal como lo guarda la base. Nombre y documento son copia de
 * la persona (se actualizan si los corrige); curso, fechas, sede, horas, aval
 * y firma son copia del taller al emitirse y no cambian aunque se edite el
 * taller: un certificado de octubre sigue diciendo octubre.
 */
export type Certificado = {
  id: string;
  codigo: string;
  inscripcionId: string;
  tallerId: string;
  referencia: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  documento: string | null;
  curso: string;
  fechasTexto: string;
  sede: string;
  ciudad: string;
  region: string | null;
  horas: number | null;
  aval: string | null;
  firmaNombre: string | null;
  firmaCargo: string | null;
  firmaDocumento: string | null;
  emitidoEn: string;
  /** `null` = vigente. Nunca se borra un certificado: se revoca. */
  revocadoEn: string | null;
  /** Revocado por el admin: la emisión automática no lo reactiva. */
  revocadoManual: boolean;
};

/** Lo que ve la persona al buscar sus certificados por documento. */
export type CertificadoPublico = { codigo: string; curso: string; fechasTexto: string };
```

- [ ] **Step 2: Escribir las pruebas (fallan)**

`src/lib/certificados/__tests__/codigo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ALFABETO_CODIGO, esReferencia, normalizarCodigo } from "../codigo";

describe("ALFABETO_CODIGO", () => {
  it("31 símbolos, sin los que se confunden en papel", () => {
    expect(ALFABETO_CODIGO).toHaveLength(31);
    for (const c of "0O1IL") expect(ALFABETO_CODIGO).not.toContain(c);
  });
});

describe("normalizarCodigo", () => {
  it("acepta lo que alguien teclea", () => {
    expect(normalizarCodigo("C-ABCD-EFGH")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo(" c abcd efgh ")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo("abcdefgh")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo("CABCDEFGH")).toBe("C-ABCD-EFGH");
  });

  it("rechaza símbolos fuera del alfabeto y longitudes raras", () => {
    expect(normalizarCodigo("C-ABC0-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCI-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCL-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCD-EFG")).toBeNull();
    expect(normalizarCodigo("")).toBeNull();
  });
});

describe("esReferencia", () => {
  it("STA-XXXXXXXX con o sin mayúsculas", () => {
    expect(esReferencia("sta-abcd1234")).toBe(true);
    expect(esReferencia(" STA-ABCD1234 ")).toBe(true);
    expect(esReferencia("C-ABCD-EFGH")).toBe(false);
  });
});
```

`src/lib/certificados/__tests__/hoja.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { documentoImpreso, fechaLarga, tallaNombre } from "../hoja";

describe("documentoImpreso", () => {
  it("cédulas numéricas con puntos de miles, como la firma", () => {
    expect(documentoImpreso("CC", "1136882468")).toBe("C.C. 1.136.882.468");
    expect(documentoImpreso("CI", "20111222")).toBe("C.I. 20.111.222");
  });

  it("con letras, pasaportes y otros, tal cual", () => {
    expect(documentoImpreso("CI", "V20111222")).toBe("C.I. V20111222");
    expect(documentoImpreso("PAS", "123456789")).toBe("Pasaporte 123456789");
    expect(documentoImpreso("OTRO", "AB123")).toBe("AB123");
  });

  it("sin documento, vacío (queda la línea para escribirlo)", () => {
    expect(documentoImpreso("CC", null)).toBe("");
  });
});

describe("tallaNombre", () => {
  it("baja con los nombres largos para no salirse de la línea", () => {
    expect(tallaNombre("A".repeat(22))).toBe(9);
    expect(tallaNombre("A".repeat(23))).toBe(7.5);
    expect(tallaNombre("A".repeat(30))).toBe(7.5);
    expect(tallaNombre("A".repeat(31))).toBe(6);
    expect(tallaNombre("A".repeat(41))).toBe(5);
  });
});

describe("fechaLarga", () => {
  it("en español y en hora de Caracas", () => {
    expect(fechaLarga("2026-10-26T15:00:00Z")).toBe("26 de octubre de 2026");
    // 02:00 UTC del 26 son las 22:00 del 25 en Caracas.
    expect(fechaLarga("2026-10-26T02:00:00Z")).toBe("25 de octubre de 2026");
  });
});
```

`src/lib/certificados/__tests__/mapeo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filaACertificado, type FilaCertificado } from "../mapeo";

const fila: FilaCertificado = {
  id: "c1",
  codigo: "C-ABCD-EFGH",
  inscripcion_id: "i1",
  taller_id: "t1",
  referencia: "STA-AAAA1111",
  nombre: "Ana Pérez",
  tipo_documento: "CC",
  documento: "1136882468",
  curso: "Anestesia Regional Ecoguiada + Sedación TCI",
  fechas_texto: "Octubre 24 y 25, 2026",
  sede: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  horas: null,
  aval: "Avalado por SCARE – SARG",
  firma_nombre: "MD. Stevan J. Camelo C.",
  firma_cargo: "Anestesiólogo",
  firma_documento: "C.C. 1.136.882.468",
  emitido_en: "2026-10-26T15:00:00Z",
  revocado_en: null,
  revocado_manual: false,
};

describe("filaACertificado", () => {
  it("pasa a camelCase", () => {
    expect(filaACertificado(fila)).toEqual({
      id: "c1",
      codigo: "C-ABCD-EFGH",
      inscripcionId: "i1",
      tallerId: "t1",
      referencia: "STA-AAAA1111",
      nombre: "Ana Pérez",
      tipoDocumento: "CC",
      documento: "1136882468",
      curso: "Anestesia Regional Ecoguiada + Sedación TCI",
      fechasTexto: "Octubre 24 y 25, 2026",
      sede: "Policlínico San Francisco",
      ciudad: "Maracaibo",
      region: "Zulia",
      horas: null,
      aval: "Avalado por SCARE – SARG",
      firmaNombre: "MD. Stevan J. Camelo C.",
      firmaCargo: "Anestesiólogo",
      firmaDocumento: "C.C. 1.136.882.468",
      emitidoEn: "2026-10-26T15:00:00Z",
      revocadoEn: null,
      revocadoManual: false,
    });
  });
});
```

Run: `npx vitest run src/lib/certificados`
Expected: FAIL — no se resuelven `../codigo`, `../hoja`, `../mapeo`.

- [ ] **Step 3: Implementar**

`src/lib/certificados/codigo.ts`:

```ts
/**
 * Alfabeto de los códigos de certificado: sin 0/O ni 1/I/L, que se confunden
 * al leerlos en papel. Es el mismo que usa `public.generar_codigo_certificado`,
 * que es quien los genera (la emisión ocurre en un trigger de la base).
 */
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const PATRON = new RegExp(`^C-[${ALFABETO_CODIGO}]{4}-[${ALFABETO_CODIGO}]{4}$`);

/**
 * Forma canónica `C-XXXX-XXXX` de lo que alguien teclea o escanea: acepta
 * minúsculas, espacios, sin guiones o sin la C. `null` si no puede ser un código.
 */
export function normalizarCodigo(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cuerpo = limpio.length === 9 && limpio.startsWith("C") ? limpio.slice(1) : limpio;
  if (cuerpo.length !== 8) return null;
  const codigo = `C-${cuerpo.slice(0, 4)}-${cuerpo.slice(4)}`;
  return PATRON.test(codigo) ? codigo : null;
}

/** Las URLs antiguas usaban la referencia de la reserva (`STA-XXXXXXXX`). */
export function esReferencia(texto: string): boolean {
  return /^STA-[A-Z0-9]{8}$/.test(texto.trim().toUpperCase());
}
```

`src/lib/certificados/hoja.ts`:

```ts
import type { TipoDocumento } from "@/lib/inscripciones/tipos";
import { ZONA_HORARIA } from "@/lib/talleres/reglas";

const PREFIJO: Record<TipoDocumento, string> = {
  CC: "C.C.",
  CE: "C.E.",
  PAS: "Pasaporte",
  CI: "C.I.",
  OTRO: "",
};

/**
 * El documento como se imprime: "C.C. 1.136.882.468", con el mismo formato
 * que la firma del instructor. Los pasaportes y los que llevan letras van tal
 * cual: ponerles puntos los volvería irreconocibles.
 */
export function documentoImpreso(tipo: TipoDocumento, documento: string | null): string {
  if (!documento) return "";
  const cuerpo =
    tipo !== "PAS" && /^\d+$/.test(documento)
      ? documento.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      : documento;
  return [PREFIJO[tipo], cuerpo].filter(Boolean).join(" ");
}

/**
 * Tamaño del nombre en mm. Va en mayúsculas sobre una línea de 175 mm: a 9 mm
 * caben ~22 letras; los nombres largos bajan de tamaño en vez de partirse.
 */
export function tallaNombre(nombre: string): number {
  const n = nombre.trim().length;
  if (n <= 22) return 9;
  if (n <= 30) return 7.5;
  if (n <= 40) return 6;
  return 5;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

/** "26 de octubre de 2026", en la zona del negocio. */
export function fechaLarga(iso: string): string {
  return FECHA_LARGA.format(new Date(iso));
}
```

`src/lib/certificados/mapeo.ts`:

```ts
import { aTipoDocumento } from "@/lib/inscripciones/mapeo";
import type { Certificado } from "./tipos";

/** Fila de la vista `public.certificados_detalle`. */
export type FilaCertificado = {
  id: string;
  codigo: string;
  inscripcion_id: string;
  taller_id: string;
  referencia: string;
  nombre: string;
  tipo_documento: string;
  documento: string | null;
  curso: string;
  fechas_texto: string;
  sede: string;
  ciudad: string;
  region: string | null;
  horas: number | null;
  aval: string | null;
  firma_nombre: string | null;
  firma_cargo: string | null;
  firma_documento: string | null;
  emitido_en: string;
  revocado_en: string | null;
  revocado_manual: boolean;
};

export const COLUMNAS_CERTIFICADO =
  "id, codigo, inscripcion_id, taller_id, referencia, nombre, tipo_documento, documento, curso, fechas_texto, sede, ciudad, region, horas, aval, firma_nombre, firma_cargo, firma_documento, emitido_en, revocado_en, revocado_manual";

export function filaACertificado(f: FilaCertificado): Certificado {
  return {
    id: f.id,
    codigo: f.codigo,
    inscripcionId: f.inscripcion_id,
    tallerId: f.taller_id,
    referencia: f.referencia,
    nombre: f.nombre,
    tipoDocumento: aTipoDocumento(f.tipo_documento),
    documento: f.documento,
    curso: f.curso,
    fechasTexto: f.fechas_texto,
    sede: f.sede,
    ciudad: f.ciudad,
    region: f.region,
    horas: f.horas,
    aval: f.aval,
    firmaNombre: f.firma_nombre,
    firmaCargo: f.firma_cargo,
    firmaDocumento: f.firma_documento,
    emitidoEn: f.emitido_en,
    revocadoEn: f.revocado_en,
    revocadoManual: f.revocado_manual,
  };
}
```

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `npx vitest run src/lib/certificados && npx tsc --noEmit`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificados
git commit -m "feat(certificados): código, documento impreso y mapeo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Migración SQL de certificados (y la de limpieza)

**Files:**
- Create: `supabase/migrations/20261015_02_certificados.sql`, `supabase/migrations/20261015_03_limpieza.sql`, `supabase/tests/certificados.sql`, `supabase/verificaciones/20261015_02_certificados.sql`, `supabase/verificaciones/20261015_03_limpieza.sql`

**Interfaces:**
- Consumes: Task 3 (tablas, `ajustar_porcentaje`, `crear_inscripcion`, `eliminar_inscripcion` y `fusionar_personas` que ya consultan `certificados` si existe).
- Produces (base de datos):
  - Tabla `public.certificados (id uuid pk, codigo text unique, inscripcion_id uuid unique fk, nombre, tipo_documento, documento, curso, fechas_texto, sede, ciudad, region, horas, aval, firma_nombre, firma_cargo, firma_documento, emitido_en, revocado_en, revocado_manual)`.
  - `generar_codigo_certificado() returns text` (`C-XXXX-XXXX`, alfabeto de `ALFABETO_CODIGO`).
  - `sincronizar_certificado(p_inscripcion_id uuid) returns void` — emite, reactiva o revoca.
  - Triggers: `inscripciones_certificado` (insert/update de `porcentaje_pagado, asistio, cancelada, persona_id`), `talleres_certificados` (update de `estado`), `personas_certificados` (update de `nombre, tipo_documento, documento`).
  - `revocar_certificado(p_certificado_id uuid, p_revocar boolean) returns table (ok boolean, reason text, vigente boolean)`.
  - Vistas: `certificados_detalle` (columnas de `COLUMNAS_CERTIFICADO`), `certificados_vigentes` (las mismas, sin revocados), `inscritos_admin` + `certificado_codigo text, certificado_revocado boolean`.
  - `20261015_03_limpieza.sql`: elimina `taller_certificates`, `create_reservation`, `register_payment_proof`.

- [ ] **Step 1: Escribir la migración de certificados**

`supabase/migrations/20261015_02_certificados.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Etapa 3 · Certificados
--
-- Un certificado por inscripción, con código propio para verificarlo. Se
-- emite solo (triggers) cuando la inscripción tiene el 100% pagado, la
-- asistencia marcada, no está cancelada y el taller terminó (finalizado o
-- archivado). Si deja de cumplirse se revoca; nunca se borra. Lleva copia de
-- la persona (se actualiza si corrige nombre o documento) y del taller al
-- emitirse (no cambia aunque se edite el taller).
--
-- Cómo aplicarlo: ./scripts/migrar.sh supabase/migrations/20261015_02_certificados.sql
-- Va después de 20261015_01. Es aditiva: el código de la etapa 2 sigue
-- funcionando igual. Idempotente.
-- ---------------------------------------------------------------------------

begin;

create table if not exists public.certificados (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique
                  check (codigo ~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  inscripcion_id  uuid not null unique references public.inscripciones (id),
  -- De la persona.
  nombre          text not null,
  tipo_documento  text not null,
  documento       text,
  -- Del taller, al emitirse.
  curso           text not null,
  fechas_texto    text not null,
  sede            text not null,
  ciudad          text not null,
  region          text,
  horas           integer,
  aval            text,
  firma_nombre    text,
  firma_cargo     text,
  firma_documento text,
  emitido_en      timestamptz not null default now(),
  -- Nulo = vigente.
  revocado_en     timestamptz,
  -- Revocado por el admin: la emisión automática no lo reactiva.
  revocado_manual boolean not null default false
);

alter table public.certificados enable row level security;

-- `C-XXXX-XXXX` sin 0/O ni 1/I/L (mismo alfabeto que ALFABETO_CODIGO en
-- src/lib/certificados/codigo.ts). gen_random_uuid() es una fuente
-- criptográfica que no necesita pgcrypto; se saltan los bytes 6 y 8, que en
-- un UUID v4 llevan la versión y la variante y no son aleatorios.
create or replace function public.generar_codigo_certificado()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes  bytea;
  v_cuerpo text;
  v_codigo text;
  v_pos    integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_cuerpo := '';
    foreach v_pos in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
      v_cuerpo := v_cuerpo || substr(v_alfabeto, (get_byte(v_bytes, v_pos) % 31) + 1, 1);
    end loop;
    v_codigo := 'C-' || substr(v_cuerpo, 1, 4) || '-' || substr(v_cuerpo, 5, 4);
    exit when not exists (select 1 from public.certificados c where c.codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- Deja el certificado de una inscripción como debe estar: lo emite, lo
-- reactiva (mismo código) o lo revoca.
create or replace function public.sincronizar_certificado(p_inscripcion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v        record;
  v_cumple boolean;
begin
  select i.id, i.porcentaje_pagado, i.asistio, i.cancelada,
         t.estado, t.titulo, t.titulo_acento, t.fechas_texto, t.sede_nombre, t.ciudad, t.region,
         t.horas, t.aval, t.firma_nombre, t.firma_cargo, t.firma_documento,
         p.nombre, p.tipo_documento, p.documento
    into v
    from public.inscripciones i
    join public.talleres t on t.id = i.taller_id
    join public.personas p on p.id = i.persona_id
   where i.id = p_inscripcion_id;

  if not found then
    return;
  end if;

  -- Archivado cuenta como terminado: archivar un taller viejo no debe
  -- invalidar sus certificados.
  v_cumple := v.porcentaje_pagado = 100
              and v.asistio
              and not v.cancelada
              and v.estado in ('finalizado', 'archivado');

  if v_cumple then
    insert into public.certificados as c (
      codigo, inscripcion_id, nombre, tipo_documento, documento,
      curso, fechas_texto, sede, ciudad, region, horas, aval,
      firma_nombre, firma_cargo, firma_documento
    )
    values (
      public.generar_codigo_certificado(), v.id, v.nombre, v.tipo_documento, v.documento,
      trim(concat_ws(' ', v.titulo, v.titulo_acento)), v.fechas_texto, v.sede_nombre, v.ciudad,
      v.region, v.horas, v.aval, v.firma_nombre, v.firma_cargo, v.firma_documento
    )
    -- Ya existía: se reactiva con su mismo código, salvo revocación manual.
    -- La copia del taller no se toca.
    on conflict (inscripcion_id) do update
       set revocado_en = case when c.revocado_manual then c.revocado_en else null end;
  else
    update public.certificados c
       set revocado_en = coalesce(c.revocado_en, now())
     where c.inscripcion_id = p_inscripcion_id;
  end if;
end;
$$;

create or replace function public.trg_inscripcion_certificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fusión de personas: el certificado pasa a llevar el nombre del destino.
  if tg_op = 'UPDATE' and new.persona_id is distinct from old.persona_id then
    update public.certificados c
       set nombre = p.nombre, tipo_documento = p.tipo_documento, documento = p.documento
      from public.personas p
     where p.id = new.persona_id and c.inscripcion_id = new.id;
  end if;
  perform public.sincronizar_certificado(new.id);
  return null;
end;
$$;

drop trigger if exists inscripciones_certificado on public.inscripciones;
create trigger inscripciones_certificado
  after insert or update of porcentaje_pagado, asistio, cancelada, persona_id
  on public.inscripciones
  for each row execute function public.trg_inscripcion_certificado();

create or replace function public.trg_taller_certificados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select i.id from public.inscripciones i where i.taller_id = new.id loop
    perform public.sincronizar_certificado(r.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists talleres_certificados on public.talleres;
create trigger talleres_certificados
  after update of estado on public.talleres
  for each row
  when (old.estado is distinct from new.estado)
  execute function public.trg_taller_certificados();

create or replace function public.trg_persona_certificados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.certificados c
     set nombre = new.nombre, tipo_documento = new.tipo_documento, documento = new.documento
    from public.inscripciones i
   where i.persona_id = new.id and c.inscripcion_id = i.id;
  return null;
end;
$$;

drop trigger if exists personas_certificados on public.personas;
create trigger personas_certificados
  after update of nombre, tipo_documento, documento on public.personas
  for each row
  when (old.nombre is distinct from new.nombre
        or old.tipo_documento is distinct from new.tipo_documento
        or old.documento is distinct from new.documento)
  execute function public.trg_persona_certificados();

-- Revocar o quitar la revocación manual. Al quitarla se vuelve a evaluar: si
-- la inscripción ya no cumple, sigue revocado (vigente = false).
create or replace function public.revocar_certificado(p_certificado_id uuid, p_revocar boolean)
returns table (ok boolean, reason text, vigente boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ins      uuid;
  v_revocado timestamptz;
begin
  update public.certificados c
     set revocado_manual = p_revocar,
         revocado_en = case when p_revocar then coalesce(c.revocado_en, now()) else c.revocado_en end
   where c.id = p_certificado_id
  returning c.inscripcion_id into v_ins;

  if v_ins is null then
    return query select false, 'no_encontrado'::text, false;
    return;
  end if;

  if not p_revocar then
    perform public.sincronizar_certificado(v_ins);
  end if;

  select c.revocado_en into v_revocado from public.certificados c where c.id = p_certificado_id;
  return query select true, null::text, v_revocado is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create or replace view public.certificados_detalle
with (security_invoker = on) as
  select
    c.id, c.codigo, c.inscripcion_id, i.taller_id, i.referencia,
    c.nombre, c.tipo_documento, c.documento,
    c.curso, c.fechas_texto, c.sede, c.ciudad, c.region, c.horas, c.aval,
    c.firma_nombre, c.firma_cargo, c.firma_documento,
    c.emitido_en, c.revocado_en, c.revocado_manual
  from public.certificados c
  join public.inscripciones i on i.id = c.inscripcion_id;

create or replace view public.certificados_vigentes
with (security_invoker = on) as
  select * from public.certificados_detalle where revocado_en is null;

-- Las columnas de la etapa 2, en el mismo orden, y al final las del certificado.
create or replace view public.inscritos_admin
with (security_invoker = on) as
  select
    i.id,
    i.referencia,
    i.taller_id,
    i.persona_id,
    p.documento,
    p.tipo_documento,
    p.nombre,
    p.email,
    p.telefono,
    p.ciudad,
    p.profesion,
    i.tarifa_nombre,
    i.monto,
    i.moneda,
    i.porcentaje_pagado,
    i.porcentaje_manual,
    coalesce(sum(c.porcentaje) filter (where c.estado = 'pending'), 0)::integer as porcentaje_en_revision,
    (count(c.id) filter (where c.estado = 'verified'))::integer as comprobantes_verificados,
    i.cancelada,
    i.asistio,
    i.origen,
    i.notas,
    i.creado_en,
    ce.codigo as certificado_codigo,
    (ce.revocado_en is not null) as certificado_revocado
  from public.inscripciones i
  join public.personas p on p.id = i.persona_id
  left join public.comprobantes c on c.inscripcion_id = i.id
  left join public.certificados ce on ce.inscripcion_id = i.id
  group by i.id, p.id, ce.id;

revoke all on public.certificados_detalle, public.certificados_vigentes, public.inscritos_admin
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emisión de lo que ya cumple (p. ej. el certificado de prueba de
-- taller-2026-10). Idempotente: si ya existe, lo deja como está.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select i.id
      from public.inscripciones i
      join public.talleres t on t.id = i.taller_id
     where t.estado in ('finalizado', 'archivado')
  loop
    perform public.sincronizar_certificado(r.id);
  end loop;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.generar_codigo_certificado()',
    'public.sincronizar_certificado(uuid)',
    'public.trg_inscripcion_certificado()',
    'public.trg_taller_certificados()',
    'public.trg_persona_certificados()',
    'public.revocar_certificado(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.revocar_certificado(uuid, boolean) to service_role;
end
$$;

-- Que la API de Supabase (PostgREST) vea ya las funciones y vistas nuevas;
-- el aviso se entrega al hacer commit.
notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 2: Escribir la migración de limpieza (se aplica DESPUÉS del despliegue de la etapa 3)**

`supabase/migrations/20261015_03_limpieza.sql`:

```sql
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

drop view if exists public.taller_certificates;

drop function if exists public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
);

drop function if exists public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
);

-- Que la API de Supabase (PostgREST) vea ya las funciones y vistas nuevas;
-- el aviso se entrega al hacer commit.
notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 3: Pruebas de certificados**

`supabase/tests/certificados.sql`:

```sql
-- Pruebas de la emisión automática de certificados (etapa 3). SOLO en una base
-- de prueba con todas las migraciones (scripts/probar-migraciones.sh). Se
-- deshace al final. Cada comprobación imprime "OK ..." o aborta con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, titulo_acento, estado, fecha_inicio, fecha_fin, fechas_texto,
   sede_nombre, ciudad, region, pais, cupos_total, horas, aval, firma_nombre)
values
  ('prueba-c', 'C', 'Anestesia Regional', '+ Sedación TCI', 'publicado', '2032-03-10', '2032-03-11',
   'Marzo 10 y 11, 2032', 'Clínica X', 'Maracaibo', 'Zulia', 'Venezuela', 5, 16, 'Avalado', 'Dr. Firma');

do $$
declare
  v_taller uuid := (select id from public.talleres where slug = 'prueba-c');
  r        record;
  v_ins    uuid;
  v_otra   uuid;
  v_cert   public.certificados%rowtype;
  v_codigo text;
begin
  select * into r from public.crear_inscripcion(v_taller, 'STA-CERT0001', '55.666.777', 'CI',
    'Eva Prueba', 'eva@example.com', '3005556677', 'Maracaibo', 'Médica',
    'general', 'Cupo General', null, null, '', 'web', false);
  v_ins := r.inscripcion_id;
  perform public.ajustar_porcentaje(v_ins, 100);
  update public.inscripciones set asistio = true where id = v_ins;

  -- 1. Pagado y con asistencia, pero el taller no terminó: sin certificado.
  if exists (select 1 from public.certificados where inscripcion_id = v_ins) then
    raise exception 'FALLO 1: certificado antes de terminar el taller';
  end if;
  raise notice 'OK sin certificado antes de finalizar';

  -- 2. Al finalizar el taller se emite, con la copia de los datos.
  update public.talleres set estado = 'finalizado' where id = v_taller;
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.id is null or v_cert.revocado_en is not null then raise exception 'FALLO 2a: no se emitió'; end if;
  if v_cert.codigo !~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$' then
    raise exception 'FALLO 2b: código %', v_cert.codigo;
  end if;
  if v_cert.nombre <> 'Eva Prueba' or v_cert.documento <> '55666777' or v_cert.tipo_documento <> 'CI'
     or v_cert.curso <> 'Anestesia Regional + Sedación TCI' or v_cert.horas <> 16
     or v_cert.sede <> 'Clínica X' or v_cert.firma_nombre <> 'Dr. Firma' then
    raise exception 'FALLO 2c: copia mal hecha';
  end if;
  v_codigo := v_cert.codigo;
  raise notice 'OK emisión al finalizar';

  -- 3. Editar el taller no cambia el certificado; corregir el nombre sí.
  update public.talleres set horas = 20 where id = v_taller;
  update public.personas set nombre = 'Eva María Prueba' where documento = '55666777';
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.horas <> 16 or v_cert.nombre <> 'Eva María Prueba' then
    raise exception 'FALLO 3: horas % nombre %', v_cert.horas, v_cert.nombre;
  end if;
  raise notice 'OK copia del taller fija y nombre al día';

  -- 4. Quitar la asistencia revoca; devolverla reactiva con el mismo código.
  update public.inscripciones set asistio = false where id = v_ins;
  if (select revocado_en from public.certificados where inscripcion_id = v_ins) is null then
    raise exception 'FALLO 4a: no se revocó';
  end if;
  update public.inscripciones set asistio = true where id = v_ins;
  select * into v_cert from public.certificados where inscripcion_id = v_ins;
  if v_cert.revocado_en is not null or v_cert.codigo <> v_codigo then raise exception 'FALLO 4b'; end if;
  raise notice 'OK revoca y reactiva sin cambiar el código';

  -- 5. Revocado a mano: la emisión automática no lo reactiva; el admin sí.
  select * into r from public.revocar_certificado(v_cert.id, true);
  update public.inscripciones set asistio = false where id = v_ins;
  update public.inscripciones set asistio = true where id = v_ins;
  if (select revocado_en from public.certificados where id = v_cert.id) is null then
    raise exception 'FALLO 5a: se reactivó solo';
  end if;
  select * into r from public.revocar_certificado(v_cert.id, false);
  if not r.ok or not r.vigente then raise exception 'FALLO 5b'; end if;
  raise notice 'OK revocación manual';

  -- 6. Archivar no revoca; volver a publicar sí; finalizar de nuevo reactiva.
  update public.talleres set estado = 'archivado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is not null then
    raise exception 'FALLO 6a: archivar revocó';
  end if;
  update public.talleres set estado = 'publicado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is null then
    raise exception 'FALLO 6b';
  end if;
  update public.talleres set estado = 'finalizado' where id = v_taller;
  if (select revocado_en from public.certificados where id = v_cert.id) is not null then
    raise exception 'FALLO 6c';
  end if;
  raise notice 'OK estados del taller';

  -- 7. Una inscripción con certificado no se elimina.
  select * into r from public.eliminar_inscripcion(v_ins);
  if r.reason is distinct from 'tiene_certificado' then raise exception 'FALLO 7: %', r.reason; end if;
  raise notice 'OK no se elimina una inscripción certificada';

  -- 8. Fusionar una ficha cuya inscripción certificada desaparecería: no.
  insert into public.personas (nombre) values ('Eva Duplicada') returning id into v_otra;
  insert into public.inscripciones (referencia, persona_id, taller_id, tarifa_id, tarifa_nombre)
  values ('STA-CERT0002', v_otra, v_taller, 'general', 'Cupo General');
  select * into r from public.fusionar_personas((select persona_id from public.inscripciones where id = v_ins), v_otra);
  if r.reason is distinct from 'tiene_certificado' then raise exception 'FALLO 8: %', r.reason; end if;
  raise notice 'OK fusionar respeta los certificados';

  -- 9. Búsqueda pública por documento.
  if not exists (select 1 from public.certificados_vigentes where documento = '55666777' and codigo = v_codigo) then
    raise exception 'FALLO 9';
  end if;
  raise notice 'OK certificados vigentes por documento';

  -- 10. Códigos: formato y sin repetirse en una muestra.
  if exists (
       select 1 from (select public.generar_codigo_certificado() as c from generate_series(1, 2000)) s
        where s.c !~ '^C-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$')
     or (select count(distinct s.c) from (select public.generar_codigo_certificado() as c from generate_series(1, 2000)) s) <> 2000 then
    raise exception 'FALLO 10: códigos';
  end if;
  raise notice 'OK formato de los códigos';

  -- 11. Permisos.
  if has_function_privilege('anon', 'public.revocar_certificado(uuid,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.sincronizar_certificado(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.revocar_certificado(uuid,boolean)', 'execute') then
    raise exception 'FALLO 11: permisos';
  end if;
  raise notice 'OK permisos';
end
$$;

rollback;
```

- [ ] **Step 4: Verificaciones para `migrar.sh`**

`supabase/verificaciones/20261015_02_certificados.sql`:

```sql
-- Solo lectura. Tras 20261015_02: el certificado de prueba de taller-2026-10
-- (la reserva que estaba confirmed + attended) debe aparecer vigente.
select codigo, nombre, documento, curso, fechas_texto, emitido_en, revocado_en
  from public.certificados_detalle
 order by emitido_en;
select count(*) as vigentes from public.certificados_vigentes;
```

`supabase/verificaciones/20261015_03_limpieza.sql`:

```sql
-- Solo lectura. Tras 20261015_03: las tres columnas deben salir vacías (null).
select to_regclass('public.taller_certificates') as vista_antigua,
       to_regprocedure('public.create_reservation(text,text,text,text,integer,text,text,text,text,text,text,text)') as reserva_antigua,
       to_regprocedure('public.register_payment_proof(text,uuid,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer)') as pago_antiguo;
```

- [ ] **Step 5: Probar en Docker**

Run: `LOG=$(mktemp); ./scripts/probar-migraciones.sh 2>&1 | tee "$LOG"; grep -c 'NOTICE:  OK' "$LOG"; grep -E 'FALLO|ERROR' "$LOG" || true`
Expected: `Todo en verde.`; **47** líneas `NOTICE:  OK` (36 de antes + 11 de `certificados.sql`); el último `grep` no imprime nada. El script aplica también la limpieza: así se comprueba que, tras ella, las pruebas siguen pasando.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015_02_certificados.sql supabase/migrations/20261015_03_limpieza.sql supabase/tests/certificados.sql supabase/verificaciones
git commit -m "feat(db): certificados con emisión automática, código y revocación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Hoja personalizada, verificación y páginas públicas del certificado

**Files:**
- Create: `src/lib/certificados/repo.ts`, `src/components/certificado/aviso.tsx`, `src/app/certificado/verificar/[codigo]/page.tsx`
- Modify: `src/components/certificado/sheet.tsx` (3 cambios), `src/app/certificado/[code]/page.tsx` (completo), `src/app/admin/certificados/imprimir/page.tsx` (completo)

**Interfaces:**
- Consumes: Task 9 (`Certificado`, `CertificadoPublico`, `normalizarCodigo`, `esReferencia`, `documentoImpreso`, `tallaNombre`, `fechaLarga`, `COLUMNAS_CERTIFICADO`, `filaACertificado`); Task 10 (vistas `certificados_detalle`, `certificados_vigentes`, función `revocar_certificado`); `enmascararDocumento` (Task 1); `tallerIdParaAdmin`, `esUuid`; `NEXT_PUBLIC_SITE_URL` (se incrusta en el build).
- Produces (`repo.ts`): `BusquedaCertificado = { kind: "found"; certificado: Certificado } | { kind: "not_found" } | { kind: "unavailable" }`, `obtenerCertificado(codigo: string): Promise<BusquedaCertificado>`, `codigoPorReferencia(referencia: string): Promise<string | null | "unavailable">`, `listarCertificadosTaller(tallerId: string): Promise<Certificado[] | null>`, `certificadosPorDocumento(documento: string): Promise<CertificadoPublico[] | null>`, `revocarCertificado(id: string, revocar: boolean): Promise<{ ok: true; vigente: boolean } | { ok: false; motivo: MotivoInscripcion }>`.
- Produces (componentes): `CertificateSheet({ certificado }: { certificado: Certificado })`, `Aviso({ titulo, children }: { titulo: string; children: ReactNode })`.
- Produces (rutas): `/certificado/<codigo>` (hoja; `STA-…` redirige al código; revocado → aviso), `/certificado/verificar/<codigo>`, `/admin/certificados/imprimir?taller=<id>`.

- [ ] **Step 1: Repositorio de certificados**

`src/lib/certificados/repo.ts`:

```ts
import { motivoDesdeReason, type MotivoInscripcion } from "@/lib/inscripciones/errores";
import { getSupabase } from "@/lib/reservations/supabase";
import { COLUMNAS_CERTIFICADO, filaACertificado, type FilaCertificado } from "./mapeo";
import type { Certificado, CertificadoPublico } from "./tipos";

/**
 * Único módulo que lee los certificados. Solo servidor. La emisión y la
 * revocación automáticas las hace la base (triggers de 20261015_02); aquí solo
 * se consulta y se revoca a mano.
 */

/** Distingue «no hay certificado» de «no se pudo consultar». */
export type BusquedaCertificado =
  | { kind: "found"; certificado: Certificado }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function obtenerCertificado(codigo: string): Promise<BusquedaCertificado> {
  const supabase = getSupabase();
  if (!supabase) return { kind: "unavailable" };
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select(COLUMNAS_CERTIFICADO)
    .eq("codigo", codigo)
    .maybeSingle<FilaCertificado>();
  if (error) {
    console.error("[certificados] no se pudo leer", { codigo, error });
    return { kind: "unavailable" };
  }
  return data ? { kind: "found", certificado: filaACertificado(data) } : { kind: "not_found" };
}

/** Para las URLs antiguas `/certificado/STA-XXXXXXXX`. */
export async function codigoPorReferencia(referencia: string): Promise<string | null | "unavailable"> {
  const supabase = getSupabase();
  if (!supabase) return "unavailable";
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select("codigo")
    .eq("referencia", referencia)
    .maybeSingle<{ codigo: string }>();
  if (error) {
    console.error("[certificados] no se pudo buscar por referencia", { referencia, error });
    return "unavailable";
  }
  return data?.codigo ?? null;
}

/** Todos los del taller, vigentes y revocados (el admin decide qué imprimir). */
export async function listarCertificadosTaller(tallerId: string): Promise<Certificado[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select(COLUMNAS_CERTIFICADO)
    .eq("taller_id", tallerId)
    .order("nombre");
  if (error) {
    console.error("[certificados] no se pudieron listar", { tallerId, error });
    return null;
  }
  return (data as unknown as FilaCertificado[]).map(filaACertificado);
}

/** Los vigentes de una persona en todos los talleres, para la búsqueda pública. */
export async function certificadosPorDocumento(documento: string): Promise<CertificadoPublico[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("certificados_vigentes")
    .select("codigo, curso, fechas_texto")
    .eq("documento", documento)
    .order("emitido_en", { ascending: false });
  if (error) {
    console.error("[certificados] no se pudo buscar por documento", { error });
    return null;
  }
  return (data as { codigo: string; curso: string; fechas_texto: string }[]).map((f) => ({
    codigo: f.codigo,
    curso: f.curso,
    fechasTexto: f.fechas_texto,
  }));
}

type FilaRevocar = { ok: boolean; reason: string | null; vigente: boolean };

export async function revocarCertificado(
  id: string,
  revocar: boolean,
): Promise<{ ok: true; vigente: boolean } | { ok: false; motivo: MotivoInscripcion }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, motivo: "sin_conexion" };
  const { data, error } = await supabase.rpc("revocar_certificado", {
    p_certificado_id: id,
    p_revocar: revocar,
  });
  const fila = (data as FilaRevocar[] | null)?.[0] ?? null;
  if (error || !fila) {
    console.error("[certificados] no se pudo revocar/reactivar", { id, error });
    return { ok: false, motivo: "error" };
  }
  return fila.ok ? { ok: true, vigente: fila.vigente } : { ok: false, motivo: motivoDesdeReason(fila.reason) };
}
```

- [ ] **Step 2: Nombre, documento, código y QR en la hoja**

En `src/components/certificado/sheet.tsx`, **cambio A** — sustituye desde `import type { Certificate } from "@/lib/reservations/certificates";` hasta `  const lugar = [certificate.venueCity, certificate.venueRegion].filter(Boolean).join(", ");` (ambas incluidas) por:

```tsx
import { documentoImpreso, tallaNombre } from "@/lib/certificados/hoja";
import type { Certificado } from "@/lib/certificados/tipos";
import { site } from "@/lib/site";
import { contenidoTaller } from "@/lib/taller";

/**
 * Una hoja de certificado, A4 apaisado.
 *
 * Las medidas van en milímetros y no en píxeles porque esto existe para
 * imprimirse: en mm la hoja mide lo mismo en pantalla que en el PDF, y el
 * navegador no reescala el contenido al pasar por «Guardar como PDF».
 *
 * Lleva impresos el nombre y el documento de la persona, y su código con un
 * QR que abre la página de verificación: quien reciba el papel puede comprobar
 * que es auténtico y que no fue revocado. Todo sale de la copia guardada en el
 * certificado, no del taller tal como esté hoy.
 */
export async function CertificateSheet({ certificado }: { certificado: Certificado }) {
  // Alias con los nombres de antes: así el resto de la hoja no cambia.
  const { curso, fechasTexto: datesLabel, horas: hours, aval: endorsement } = certificado;
  const course = splitCourse(curso);
  const url = siteUrl();
  const verificacion = url ? `${url}/certificado/verificar/${certificado.codigo}` : null;
  const qr = verificacion ? await qrSvg(verificacion) : null;
  // La firma sale del taller; el contenido por defecto solo cubre talleres que
  // no la tenían.
  const fallback = contenidoTaller.instructor.signature;
  const signature = {
    name: certificado.firmaNombre ?? fallback.name,
    title: certificado.firmaCargo ?? fallback.title,
    document: certificado.firmaDocumento ?? fallback.document,
  };
  const lugar = [certificado.ciudad, certificado.region].filter(Boolean).join(", ");
  const documento = documentoImpreso(certificado.tipoDocumento, certificado.documento);
```

**Cambio B** — sustituye:

```tsx
            <p className="mt-[1.5mm] text-[2.4mm] font-semibold tracking-[0.12em] text-navy uppercase">
              {url ? url.replace(/^https?:\/\//, "") : `@${site.instagram}`}
            </p>
```

por:

```tsx
            <p className="mt-[1.5mm] font-mono text-[2.6mm] font-semibold tracking-[0.08em] text-navy">
              {certificado.codigo}
            </p>
            <p className="mt-[0.4mm] text-[2.1mm] tracking-[0.1em] text-ink uppercase">
              {url ? `Verifica en ${url.replace(/^https?:\/\//, "")}` : `@${site.instagram}`}
            </p>
```

**Cambio C** — sustituye:

```tsx
        {/* Espacio para escribir el nombre a mano */}
        <div className="mt-[13mm] h-[0.3mm] w-[175mm] bg-navy/50" />

        {/* Y el documento de identidad, también a mano */}
        <div className="mt-[5mm] flex items-end gap-x-[3mm]">
          <p className="text-[3.1mm] font-medium tracking-[0.16em] text-ink uppercase">
            Documento de identidad:
          </p>
          <div className="mb-[0.6mm] h-[0.3mm] w-[60mm] bg-navy/50" />
        </div>
```

por:

```tsx
        {/* Nombre impreso sobre su línea. La caja tiene alto fijo para que un
            nombre largo (que baja de tamaño) no empuje el resto de la hoja. */}
        <div className="mt-[2mm] flex h-[10mm] w-[175mm] items-end justify-center">
          <p
            className="leading-none font-bold tracking-[0.04em] text-navy uppercase"
            style={{ fontSize: `${tallaNombre(certificado.nombre)}mm` }}
          >
            {certificado.nombre}
          </p>
        </div>
        <div className="mt-[1.5mm] h-[0.3mm] w-[175mm] bg-navy/50" />

        {/* Documento sobre su línea; si la persona no lo tiene registrado, la
            línea queda en blanco para escribirlo a mano. */}
        <div className="mt-[4mm] flex items-end gap-x-[3mm]">
          <p className="text-[3.1mm] font-medium tracking-[0.16em] text-ink uppercase">
            Documento de identidad:
          </p>
          <div className="flex w-[60mm] flex-col items-center">
            <p className="min-h-[4mm] text-[3.6mm] font-semibold tracking-[0.06em] text-navy">{documento}</p>
            <div className="mt-[0.6mm] h-[0.3mm] w-full bg-navy/50" />
          </div>
        </div>
```

- [ ] **Step 3: Aviso compartido**

`src/components/certificado/aviso.tsx`:

```tsx
import type { ReactNode } from "react";
import { tallerWaLink } from "@/lib/taller";

/** Aviso a pantalla completa cuando no hay certificado que mostrar. */
export function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="max-w-[520px] text-center">
        <h1 className="text-[clamp(26px,4vw,38px)] leading-[1.15] text-navy">{titulo}</h1>
        <div className="mt-5 text-[15px] leading-[1.8] text-ink">{children}</div>
        <a
          href={tallerWaLink("Hola, tengo una duda con mi certificado del taller.")}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-flex cursor-pointer items-center rounded-full bg-navy px-6 py-3.5 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-azure"
        >
          Escribir por WhatsApp
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Página del certificado por código**

Reemplaza `src/app/certificado/[code]/page.tsx` entero por:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/certificado/aviso";
import { PrintButton } from "@/components/certificado/print-button";
import { CertificateSheet } from "@/components/certificado/sheet";
import { esReferencia, normalizarCodigo } from "@/lib/certificados/codigo";
import { codigoPorReferencia, obtenerCertificado } from "@/lib/certificados/repo";

// Se comprueba contra la base en cada visita: si se revoca, el enlace deja de
// acreditar nada de inmediato.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificado de asistencia · STA",
  // Lleva el nombre y el documento de una persona: no debe acabar en un buscador.
  robots: { index: false, follow: false },
};

function SinConexion() {
  return (
    <Aviso titulo="No podemos mostrarlo ahora mismo">
      <p>
        Hubo un problema al consultar los certificados. Vuelve a intentarlo en unos minutos y, si
        sigue igual, escríbenos y lo resolvemos.
      </p>
    </Aviso>
  );
}

function NoEncontrado() {
  return (
    <Aviso titulo="Certificado no disponible">
      <p>
        No encontramos un certificado con ese código. Puede que esté mal escrito o que todavía no se
        haya emitido: se emite cuando el taller termina, con el pago completo y la asistencia
        registrada.
      </p>
    </Aviso>
  );
}

export default async function CertificadoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let texto = code;
  try {
    texto = decodeURIComponent(code).trim();
  } catch {
    // Un `%` suelto no es un código; se trata como no encontrado más abajo.
  }

  // Enlaces antiguos por referencia de la reserva: llevan al código si existe.
  if (esReferencia(texto)) {
    const codigo = await codigoPorReferencia(texto.toUpperCase());
    if (codigo === "unavailable") return <SinConexion />;
    if (codigo) redirect(`/certificado/${codigo}`);
    return <NoEncontrado />;
  }

  const codigo = normalizarCodigo(texto);
  if (!codigo) return <NoEncontrado />;
  if (codigo !== texto) redirect(`/certificado/${codigo}`);

  const r = await obtenerCertificado(codigo);
  if (r.kind === "unavailable") return <SinConexion />;
  if (r.kind === "not_found") return <NoEncontrado />;

  if (r.certificado.revocadoEn) {
    return (
      <Aviso titulo="Certificado revocado">
        <p>
          El certificado {codigo} fue revocado y ya no acredita la participación. Si crees que es un
          error, escríbenos.
        </p>
      </Aviso>
    );
  }

  return (
    <main className="cert-page min-h-[100svh] bg-cream px-4 py-10">
      <div className="cert-no-print mx-auto mb-8 flex max-w-[297mm] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight text-navy">Tu certificado</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Guárdalo como PDF desde el botón. Cualquiera puede comprobarlo con el QR o en{" "}
            <Link href={`/certificado/verificar/${codigo}`} className="text-azure underline-offset-4 hover:underline">
              la página de verificación
            </Link>
            .
          </p>
        </div>
        <PrintButton />
      </div>

      {/* La hoja mide 297 mm fijos. En móvil se desplaza dentro de su propio
          contenedor: escalarla con transform dejaría el hueco original y sacaría
          barra horizontal a toda la página. */}
      <div className="overflow-x-auto">
        <div className="mx-auto w-fit">
          <CertificateSheet certificado={r.certificado} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Página de verificación**

`src/app/certificado/verificar/[codigo]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Aviso } from "@/components/certificado/aviso";
import { normalizarCodigo } from "@/lib/certificados/codigo";
import { fechaLarga } from "@/lib/certificados/hoja";
import { obtenerCertificado } from "@/lib/certificados/repo";
import { enmascararDocumento } from "@/lib/inscripciones/documento";

// La respuesta cambia en cuanto se revoca: nada de caché.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificar certificado · STA",
  robots: { index: false, follow: false },
};

/**
 * Lo que abre el QR del certificado. Muestra lo justo para comprobar que el
 * papel es auténtico; el documento va enmascarado y no hay enlace a la hoja.
 */
export default async function VerificarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  let texto = crudo;
  try {
    texto = decodeURIComponent(crudo);
  } catch {
    // Se deja tal cual: no será un código válido.
  }
  const codigo = normalizarCodigo(texto);
  const r = codigo ? await obtenerCertificado(codigo) : ({ kind: "not_found" } as const);

  if (r.kind === "unavailable") {
    return (
      <Aviso titulo="No podemos verificarlo ahora mismo">
        <p>Hubo un problema al consultar los certificados. Vuelve a intentarlo en unos minutos.</p>
      </Aviso>
    );
  }

  if (r.kind === "not_found") {
    return (
      <Aviso titulo="Certificado no encontrado">
        <p>No existe ningún certificado con el código {codigo ?? texto}. Revisa que esté bien escrito.</p>
      </Aviso>
    );
  }

  const c = r.certificado;
  const vigente = !c.revocadoEn;
  const dato = "text-[14.5px] text-navy";
  const etiqueta = "text-[13px] text-ink-soft";

  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="w-full max-w-[560px] rounded-3xl bg-white p-7 sm:p-10">
        <p
          className={`inline-flex rounded-full px-4 py-1.5 text-[13px] font-semibold ${
            vigente ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {vigente ? "Certificado válido" : "Certificado revocado"}
        </p>
        <h1 className="mt-5 text-[clamp(24px,4vw,34px)] leading-[1.15] text-navy">{c.nombre}</h1>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3">
          <dt className={etiqueta}>Documento</dt>
          <dd className={dato}>{enmascararDocumento(c.tipoDocumento, c.documento)}</dd>
          <dt className={etiqueta}>Curso</dt>
          <dd className={dato}>{c.curso}</dd>
          <dt className={etiqueta}>Fechas</dt>
          <dd className={dato}>{c.fechasTexto}</dd>
          <dt className={etiqueta}>Sede</dt>
          <dd className={dato}>{[c.sede, c.ciudad, c.region].filter(Boolean).join(", ")}</dd>
          <dt className={etiqueta}>Emitido</dt>
          <dd className={dato}>{fechaLarga(c.emitidoEn)}</dd>
          {c.revocadoEn && (
            <>
              <dt className={etiqueta}>Revocado</dt>
              <dd className={dato}>{fechaLarga(c.revocadoEn)}</dd>
            </>
          )}
          <dt className={etiqueta}>Código</dt>
          <dd className={`${dato} font-mono`}>{c.codigo}</dd>
        </dl>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Impresión en lote por taller**

Reemplaza `src/app/admin/certificados/imprimir/page.tsx` entero por:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/certificado/print-button";
import { CertificateSheet } from "@/components/certificado/sheet";
import { puertaAdmin } from "@/lib/admin-auth";
import { listarCertificadosTaller } from "@/lib/certificados/repo";
import { esUuid } from "@/lib/inscripciones/formulario";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Imprimir certificados · STA",
  robots: { index: false, follow: false },
};

/**
 * Todos los certificados vigentes del taller, uno por página.
 *
 * Al imprimir sale un único PDF con tantas páginas como certificados: el salto
 * lo pone la regla `break-after: page` de `sheet.css`.
 */
export default async function ImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) notFound();

  const tallerId = await tallerIdParaAdmin((await searchParams).taller);
  const certificados = tallerId && esUuid(tallerId) ? await listarCertificadosTaller(tallerId) : null;
  const vigentes = (certificados ?? []).filter((c) => !c.revocadoEn);
  const volver = tallerId ? `/admin/certificados?taller=${tallerId}` : "/admin/certificados";

  if (vigentes.length === 0) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream px-5">
        <div className="text-center">
          <p className="text-[15px] text-ink">No hay certificados vigentes que imprimir.</p>
          <Link
            href={volver}
            className="mt-5 inline-block text-[14px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cert-page min-h-[100svh] bg-cream px-4 py-10">
      <div className="cert-no-print mx-auto mb-8 flex max-w-[297mm] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight text-navy">{vigentes.length} certificados</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Imprime y elige «Guardar como PDF». Sale una página por certificado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={volver} className="text-[14px] font-semibold text-azure underline-offset-4 hover:underline">
            Volver
          </Link>
          <PrintButton label="Imprimir todos" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto flex w-fit flex-col gap-10">
          {vigentes.map((c) => (
            <CertificateSheet key={c.id} certificado={c} />
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde. (`/admin/certificados/page.tsx` todavía usa `listCertificates` y `slugParaAdmin`; se rehace en la Task 13 y el código viejo sigue compilando mientras tanto.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/certificados src/components/certificado src/app/certificado src/app/admin/certificados/imprimir
git commit -m "feat(certificados): hoja con nombre, documento, código y QR de verificación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Descarga de certificados por documento en `/taller`

**Files:**
- Create: `src/components/taller/certificados.tsx`
- Modify: `src/app/taller/actions.ts` (importaciones + acción nueva), `src/app/taller/page.tsx`, `src/components/taller/nav.tsx`, `src/components/taller/footer.tsx`, `src/lib/taller.ts` (FAQ)

**Interfaces:**
- Consumes: Task 11 `certificadosPorDocumento`, `CertificadoPublico`; Task 5 `dentroDelLimite` (interno de `actions.ts`); `normalizarDocumento`, `documentoValido`, `MENSAJES_INSCRIPCION`; `TallerVista.mostrar.certificados`.
- Produces: `CertificadosState = { status: "idle" } | { status: "error"; message: string } | { status: "ok"; certificados: CertificadoPublico[] }`; `buscarCertificados(prev: CertificadosState, fd: FormData): Promise<CertificadosState>` (campo `documento`); `CertificadosSection({ destacada }: { destacada: boolean })` con ancla `#certificados`.

- [ ] **Step 1: Acción de búsqueda**

En `src/app/taller/actions.ts`, tras la línea `import { getPaymentProvider, type CheckoutResult, type Money, type OrderDraft } from "@/lib/payments";` añade:

```ts
import { certificadosPorDocumento } from "@/lib/certificados/repo";
import type { CertificadoPublico } from "@/lib/certificados/tipos";
```

Y añade al final del archivo:

```ts
/* ----------------------------------------------------------- Certificados */

export type CertificadosState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; certificados: CertificadoPublico[] };

/**
 * «Descarga tu certificado»: los vigentes de ese documento en todos los
 * talleres. Sin resultados la respuesta es la misma exista o no la persona,
 * y comparte el límite por IP con las demás consultas por documento.
 */
export async function buscarCertificados(
  _prev: CertificadosState,
  formData: FormData,
): Promise<CertificadosState> {
  const documento = normalizarDocumento(str(formData, "documento"));
  if (!documentoValido(documento))
    return { status: "error", message: "Escribe tu número de documento (cédula o pasaporte)." };
  if (!(await dentroDelLimite())) return { status: "error", message: MENSAJES_INSCRIPCION.limite };

  const certificados = await certificadosPorDocumento(documento);
  if (certificados === null) {
    return {
      status: "error",
      message: "No pudimos consultar los certificados ahora mismo. Inténtalo en unos minutos.",
    };
  }
  return { status: "ok", certificados };
}
```

- [ ] **Step 2: Sección de certificados**

`src/components/taller/certificados.tsx`:

```tsx
"use client";

import { startTransition, useActionState } from "react";
import { buscarCertificados, type CertificadosState } from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";

const inicial: CertificadosState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";

/**
 * «Descarga tu certificado». Con el taller finalizado va destacada y arriba:
 * es lo que viene a buscar quien entra a la página después del taller.
 */
export function CertificadosSection({ destacada }: { destacada: boolean }) {
  const [state, action, pending] = useActionState(buscarCertificados, inicial);

  return (
    <section
      id="certificados"
      className={`${destacada ? "bg-ice" : "bg-white"} px-5 py-24 sm:px-8 lg:px-16 lg:py-32`}
    >
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            Certificados
          </Reveal>
          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy">
              {destacada ? "¿Asististe?" : "Descarga tu"}
              <span className="block text-azure">
                {destacada ? "Descarga tu certificado." : "certificado."}
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ink">
              Escribe el documento con el que te inscribiste y verás los certificados de todos los
              talleres en los que participaste, listos para guardar en PDF. Se emiten cuando el
              taller termina, con el pago completo y la asistencia registrada.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="rounded-3xl bg-cream p-6 sm:p-8">
            <form
              onSubmit={(e) => {
                // A mano y no con `action`: así el documento no se borra al responder.
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(() => action(formData));
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="cert-documento" className={labelClass}>
                  Número de documento
                </label>
                <input
                  id="cert-documento"
                  name="documento"
                  required
                  maxLength={30}
                  autoComplete="off"
                  placeholder="Cédula o pasaporte"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-navy px-7 py-3.5 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Buscando…" : "Buscar"}
              </button>
            </form>

            {state.status === "error" && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {state.message}
              </p>
            )}

            {state.status === "ok" &&
              (state.certificados.length === 0 ? (
                <p className="mt-5 text-[14px] leading-[1.8] text-ink">
                  No encontramos certificados disponibles con ese documento. Si asististe y pagaste
                  el 100%, puede que todavía no los hayamos emitido: escríbenos por WhatsApp.
                </p>
              ) : (
                <ul className="mt-5 flex flex-col gap-3">
                  {state.certificados.map((c) => (
                    <li
                      key={c.codigo}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-semibold text-navy">{c.curso}</p>
                        <p className="text-[12.5px] text-ink-soft">
                          {c.fechasTexto} · <span className="font-mono">{c.codigo}</span>
                        </p>
                      </div>
                      <a
                        href={`/certificado/${c.codigo}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-azure"
                      >
                        Ver y descargar
                      </a>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: La sección en la página**

En `src/app/taller/page.tsx`, tras `import { ScrollProgress } from "@/components/scroll-progress";` añade:

```tsx
import { CertificadosSection } from "@/components/taller/certificados";
```

y sustituye:

```tsx
      <main>
        <TallerHero />
        <Contenido />
        <Galeria />
        <Instructor />
        {(t.mostrar.reserva || t.mostrar.listaEspera) && <ReservaSection />}
        {t.mostrar.pago && <PagoSection />}
        <Faq />
      </main>
```

por:

```tsx
      <main>
        <TallerHero />
        {/* Con el taller terminado lo que se busca es el certificado: va arriba. */}
        {t.mostrar.certificados && t.estado === "finalizado" && <CertificadosSection destacada />}
        <Contenido />
        <Galeria />
        <Instructor />
        {(t.mostrar.reserva || t.mostrar.listaEspera) && <ReservaSection />}
        {t.mostrar.pago && <PagoSection />}
        {t.mostrar.certificados && t.estado !== "finalizado" && <CertificadosSection destacada={false} />}
        <Faq />
      </main>
```

- [ ] **Step 4: Enlaces en el nav y el footer**

En `src/components/taller/nav.tsx`, sustituye:

```tsx
  { href: "#registro-pago", label: "Registrar pago" },
  { href: "#faq", label: "Preguntas" },
```

por:

```tsx
  { href: "#registro-pago", label: "Registrar pago" },
  { href: "#certificados", label: "Certificados" },
  { href: "#faq", label: "Preguntas" },
```

y sustituye:

```tsx
  // "Registrar pago" solo existe en la página si el taller acepta pagos.
  const visibles = links.filter((l) => l.href !== "#registro-pago" || taller.mostrar.pago);
```

por:

```tsx
  // "Registrar pago" y "Certificados" solo existen en la página si el estado
  // del taller los muestra.
  const visibles = links.filter(
    (l) =>
      (l.href !== "#registro-pago" || taller.mostrar.pago) &&
      (l.href !== "#certificados" || taller.mostrar.certificados),
  );
```

En `src/components/taller/footer.tsx`, sustituye:

```tsx
              {taller.mostrar.pago && (
                <a
                  href="#registro-pago"
                  className="text-[13.5px] text-white/80 transition-colors hover:text-white"
                >
                  Registrar pago
                </a>
              )}
```

por:

```tsx
              {taller.mostrar.pago && (
                <a
                  href="#registro-pago"
                  className="text-[13.5px] text-white/80 transition-colors hover:text-white"
                >
                  Registrar pago
                </a>
              )}
              {taller.mostrar.certificados && (
                <a
                  href="#certificados"
                  className="text-[13.5px] text-white/80 transition-colors hover:text-white"
                >
                  Descargar certificado
                </a>
              )}
```

- [ ] **Step 5: FAQ**

En `src/lib/taller.ts`, sustituye:

```ts
    {
      q: "¿El taller entrega certificado?",
      a: "Sí. Al completar las dos jornadas recibes certificado de asistencia, avalado por SCARE – SARG.",
    },
```

por:

```ts
    {
      q: "¿El taller entrega certificado?",
      a: "Sí. Al completar las dos jornadas recibes certificado de asistencia, avalado por SCARE – SARG.",
    },
    {
      q: "¿Cómo descargo mi certificado?",
      a: "Cuando el taller termina, si tienes el pago completo y la asistencia registrada, tu certificado queda listo con tu nombre y tu documento. Búscalo en la sección «Certificados» de esta página con tu número de documento y guárdalo en PDF. Lleva un código y un QR para que cualquiera pueda verificarlo.",
    },
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/taller src/components/taller src/lib/taller.ts
git commit -m "feat(taller): descarga de certificados por documento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Admin — certificados por taller y limpieza del código antiguo

**Files:**
- Create: `src/app/admin/certificados/actions.ts`, `src/components/admin/certificado-fila.tsx`
- Modify: `src/app/admin/certificados/page.tsx` (completo), `src/lib/inscripciones/mapeo.ts` (`COLUMNAS_INSCRITO`), `src/app/admin/inscritos/page.tsx` (enlaces), `src/app/admin/talleres/[id]/page.tsx` (enlace), `src/lib/talleres/publico.ts` (quitar `slugParaAdmin`)
- Delete: `src/lib/reservations/certificates.ts`

**Interfaces:**
- Consumes: Task 11 `listarCertificadosTaller`, `revocarCertificado`; Task 9 `documentoImpreso`, `fechaLarga`; Task 6 `SelectorTaller`, `Mensaje`, `EstadoAccion`; `tallerIdParaAdmin`; columnas `certificado_codigo`, `certificado_revocado` de `inscritos_admin` (Task 10).
- Produces: `revocarAccion(prev: EstadoAccion, fd: FormData): Promise<EstadoAccion>` (campos `id`, `revocar` = `si` | `no`); `CertificadoFila({ certificado, emitido }: { certificado: Certificado; emitido: string })`; ruta `/admin/certificados?taller=<id>`; `Inscrito.certificado` relleno.

- [ ] **Step 1: Acción de revocar/reactivar**

`src/app/admin/certificados/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { isAdmin } from "@/lib/admin-auth";
import { revocarCertificado } from "@/lib/certificados/repo";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { esUuid } from "@/lib/inscripciones/formulario";

const SESION_VENCIDA: EstadoAccion = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

export async function revocarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  if (!esUuid(id)) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION.no_encontrado };
  const revocar = fd.get("revocar") === "si";

  const r = await revocarCertificado(id, revocar);
  if (!r.ok) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION[r.motivo] };

  revalidatePath("/admin", "layout");
  return {
    status: "ok",
    message: revocar
      ? "Certificado revocado."
      : r.vigente
        ? "Certificado reactivado."
        : "Se quitó la revocación manual, pero sigue sin cumplir los requisitos (100% pagado, asistencia y taller finalizado).",
  };
}
```

- [ ] **Step 2: Fila de certificado**

`src/components/admin/certificado-fila.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { revocarAccion } from "@/app/admin/certificados/actions";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { documentoImpreso } from "@/lib/certificados/hoja";
import type { Certificado } from "@/lib/certificados/tipos";
import { Mensaje } from "./mensaje";
import { botonSecundario } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

/** `emitido` llega formateado del servidor: así no hay diferencias de hidratación. */
export function CertificadoFila({ certificado: c, emitido }: { certificado: Certificado; emitido: string }) {
  const [state, action, pending] = useActionState(revocarAccion, inicial);
  const vigente = !c.revocadoEn;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-navy">{c.nombre}</p>
        <p className="text-[12.5px] text-ink-soft">
          {documentoImpreso(c.tipoDocumento, c.documento) || "Sin documento"} ·{" "}
          <span className="font-mono">{c.codigo}</span> · emitido el {emitido}
        </p>
        <p className={`mt-1 text-[12.5px] font-semibold ${vigente ? "text-emerald-700" : "text-red-700"}`}>
          {vigente
            ? "Vigente"
            : c.revocadoManual
              ? "Revocado a mano"
              : "Revocado: ya no cumple (pago, asistencia o estado del taller)"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/certificado/${c.codigo}`} target="_blank" rel="noopener" className={botonSecundario}>
          Ver / descargar
        </a>
        <a
          href={`/certificado/verificar/${c.codigo}`}
          target="_blank"
          rel="noopener"
          className="text-[13px] font-semibold text-azure hover:underline"
        >
          Verificación
        </a>
        {/* Uno revocado porque ya no cumple se arregla en Inscritos (pago o
            asistencia), no aquí. */}
        {(vigente || c.revocadoManual) && (
          <form
            action={action}
            onSubmit={(e) => {
              if (vigente && !confirm(`¿Revocar el certificado de ${c.nombre}? Dejará de acreditar la participación.`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="revocar" value={vigente ? "si" : "no"} />
            <button
              type="submit"
              disabled={pending}
              className={vigente ? `${botonSecundario} border-red-300 text-red-700 hover:border-red-500` : botonSecundario}
            >
              {vigente ? "Revocar" : "Reactivar"}
            </button>
          </form>
        )}
        <Mensaje state={state} />
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Página de certificados por taller**

Reemplaza `src/app/admin/certificados/page.tsx` entero por:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CertificadoFila } from "@/components/admin/certificado-fila";
import { LoginScreen } from "@/components/admin/login-screen";
import { SelectorTaller } from "@/components/admin/selector-taller";
import { AdminShell } from "@/components/admin/shell";
import { botonPrimario, botonSecundario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { fechaLarga } from "@/lib/certificados/hoja";
import { listarCertificadosTaller } from "@/lib/certificados/repo";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";
import { listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificados · STA",
  robots: { index: false, follow: false },
};

export default async function CertificadosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  const [talleres, preferido] = await Promise.all([listarTalleres(), tallerIdParaAdmin(sp.taller)]);

  if (talleres === null) {
    return (
      <AdminShell titulo="Certificados">
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      </AdminShell>
    );
  }

  const taller = talleres.find((t) => t.id === preferido) ?? talleres[0];
  if (!taller) {
    return (
      <AdminShell titulo="Certificados">
        <p className={tarjeta}>Todavía no hay talleres.</p>
      </AdminShell>
    );
  }

  const certificados = await listarCertificadosTaller(taller.id);
  const vigentes = (certificados ?? []).filter((c) => !c.revocadoEn).length;

  return (
    <AdminShell
      titulo="Certificados"
      subtitulo={
        <>
          {[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")} · {taller.fechasTexto} ·{" "}
          {ESTADO_ETIQUETA[taller.estado]}
        </>
      }
      acciones={<SelectorTaller talleres={talleres} actual={taller.id} ruta="/admin/certificados" />}
    >
      {certificados === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : certificados.length === 0 ? (
        <p className={`${tarjeta} text-[14.5px] leading-relaxed text-ink`}>
          Todavía no hay certificados en este taller. Se emiten solos cuando el taller está{" "}
          <strong>Finalizado</strong> y la inscripción tiene <strong>100% pagado</strong> y{" "}
          <strong>asistencia</strong> marcada, en{" "}
          <Link href={`/admin/inscritos?taller=${taller.id}`} className="font-semibold text-azure hover:underline">
            Inscritos
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {vigentes > 0 && (
              <Link href={`/admin/certificados/imprimir?taller=${taller.id}`} className={botonPrimario}>
                Imprimir los {vigentes} vigentes en un PDF
              </Link>
            )}
            <Link href={`/admin/inscritos?taller=${taller.id}`} className={botonSecundario}>
              Ir a inscritos
            </Link>
          </div>
          <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
            {certificados.map((c) => (
              <CertificadoFila key={c.id} certificado={c} emitido={fechaLarga(c.emitidoEn)} />
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 4: El certificado en la lista de inscritos**

En `src/lib/inscripciones/mapeo.ts`, sustituye:

```ts
/** Columnas de `inscritos_admin`. La etapa 3 añade las del certificado. */
export const COLUMNAS_INSCRITO =
  "id, referencia, taller_id, persona_id, documento, tipo_documento, nombre, email, telefono, ciudad, profesion, tarifa_nombre, monto, moneda, porcentaje_pagado, porcentaje_manual, porcentaje_en_revision, comprobantes_verificados, cancelada, asistio, origen, notas, creado_en";
```

por:

```ts
/** Columnas de `inscritos_admin`, incluidas las del certificado (migración 20261015_02). */
export const COLUMNAS_INSCRITO =
  "id, referencia, taller_id, persona_id, documento, tipo_documento, nombre, email, telefono, ciudad, profesion, tarifa_nombre, monto, moneda, porcentaje_pagado, porcentaje_manual, porcentaje_en_revision, comprobantes_verificados, cancelada, asistio, origen, notas, creado_en, certificado_codigo, certificado_revocado";
```

En `src/app/admin/inscritos/page.tsx`, sustituye:

```tsx
          <p className="mb-3 text-[13px] text-ink-soft">
            {activos.length} activos · {pagados} con el 100% · {asistieron} con asistencia
            {lista.length > activos.length && ` · ${lista.length - activos.length} canceladas`}
          </p>
```

por:

```tsx
          <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
            <span>
              {activos.length} activos · {pagados} con el 100% · {asistieron} con asistencia
              {lista.length > activos.length && ` · ${lista.length - activos.length} canceladas`}
            </span>
            <Link href={`/admin/certificados?taller=${taller.id}`} className="font-semibold text-azure hover:underline">
              Certificados de este taller
            </Link>
            <Link
              href={`/admin/certificados/imprimir?taller=${taller.id}`}
              className="font-semibold text-azure hover:underline"
            >
              Imprimir todos
            </Link>
          </p>
```

En `src/app/admin/talleres/[id]/page.tsx`, sustituye `<Link href={\`/admin/certificados?taller=${taller.slug}\`} className="text-azure hover:underline">` por:

```tsx
          <Link href={`/admin/certificados?taller=${taller.id}`} className="text-azure hover:underline">
```

- [ ] **Step 5: Quitar lo que ya no se usa**

En `src/lib/talleres/publico.ts`, borra entero:

```ts
/** Taller con el que abre una pantalla del admin: el de la URL o el activo. */
export async function slugParaAdmin(param: string | undefined): Promise<string | null> {
  if (param) return param;
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista.slug : null;
}
```

Run: `git rm src/lib/reservations/certificates.ts`

Run: `grep -rnE "slugParaAdmin|listCertificates|getCertificate|reservations/certificates|taller_certificates|create_reservation|register_payment_proof|\"reservations\"|payment_proofs" src`
Expected: sin resultados.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde; `next build` lista `/certificado/[code]` y `/certificado/verificar/[codigo]` como dinámicas.

- [ ] **Step 7: Commit**

```bash
git add -A src/app/admin src/components/admin src/lib/inscripciones/mapeo.ts src/lib/talleres/publico.ts src/lib/reservations
git commit -m "feat(admin): certificados por taller con revocar, reactivar e imprimir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: PUERTA MANUAL — migración, despliegue y limpieza de la etapa 3

**Files:** ninguno.

**Interfaces:**
- Consumes: Tasks 9–13 comiteadas y sin push; etapa 2 ya desplegada (Task 8).
- Produces: certificados en producción; funciones y vista antiguas eliminadas.

- [ ] **Step 1: Verificación completa en local**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build && ./scripts/probar-migraciones.sh 2>&1 | tail -n 3`
Expected: todo en verde; termina con `Todo en verde.`.

- [ ] **Step 2: PUERTA MANUAL — migración de certificados y despliegue**

Detente y pide al usuario, textualmente:

> 1. Backup en Supabase → Database → Backups.
> 2. `SUPABASE_DB_URL='…' ./scripts/migrar.sh supabase/migrations/20261015_02_certificados.sql` → `si`. En «Verificación» debe salir el certificado de prueba de `taller-2026-10` (código `C-XXXX-XXXX`, `revocado_en` vacío) y `vigentes = 1`.
> 3. `git push origin main`. Esta migración es aditiva: no hay ventana, el sitio actual sigue funcionando.
> 4. **No** apliques todavía `20261015_03_limpieza.sql`. Dime «desplegado» cuando termine.

- [ ] **Step 3: Comprobación en producción (navegador)**

1. `/admin/certificados` (taller `taller-2026-10`): aparece el certificado de prueba «Vigente».
2. «Ver / descargar»: la hoja muestra el **nombre** sobre su línea y el **documento** sobre la suya (en blanco si la persona sigue «por identificar»); junto al QR, el código y «Verifica en <dominio>». Imprimir → «Guardar como PDF» → **una sola página** A4 apaisada, sin nada cortado. Prueba también con un nombre de 40 letras (edita temporalmente la ficha en Inscritos y vuelve a dejarla como estaba).
3. Escanear el QR (o abrir `/certificado/verificar/<código>`) → «Certificado válido», documento como `CC ****468`, curso, fechas, sede y fecha de emisión.
4. `/certificado/<referencia STA-… de la prueba>` → redirige a `/certificado/<código>`.
5. Inscritos → «Gestionar» de la prueba: poner un documento (p. ej. `77777777`) y guardar → la hoja muestra ese documento. En `/taller` (sección «Certificados», arriba porque el taller está finalizado) buscar `77.777.777` → aparece el certificado → «Ver y descargar». Buscar `12345` → mensaje neutro.
6. Revocar en `/admin/certificados` → la verificación dice «Certificado revocado» y `/certificado/<código>` muestra el aviso. Reactivar → vuelve a «válido» con el mismo código.
7. Quitar la asistencia de la prueba en Inscritos → el certificado sale «Revocado: ya no cumple»; devolverla → vuelve a «Vigente».
8. «Imprimir todos» → tantas páginas como certificados vigentes.
9. `/certificado/verificar/C-2222-2222` → «Certificado no encontrado».

Si este paso lo ejecuta un agente sin navegador, lista estos puntos en su informe como pendientes para el usuario.

- [ ] **Step 4: PUERTA MANUAL — limpieza**

Con la etapa 3 servida y comprobada, pide al usuario:

> `SUPABASE_DB_URL='…' ./scripts/migrar.sh supabase/migrations/20261015_03_limpieza.sql` → `si`. En «Verificación» las tres columnas deben salir vacías.

- [ ] **Step 5: Informe al usuario**

Resume: commits creados; migraciones aplicadas (01, 02, 03) con sus verificaciones; resultado de `scripts/probar-migraciones.sh` (47 `OK`); pasos manuales de las Tasks 8 y 14 que queden pendientes. Recuerda:
- Los duplicados de las reservas migradas **no** se fusionaron solos: hazlo desde Inscritos → Gestionar → Fusionar, y completa los documentos «por identificar» (sin documento la persona no puede registrar pagos ni buscar su certificado por la web).
- El certificado guarda la copia del taller **al emitirse**: si cambias horas, aval o firma de `taller-2026-10`, el certificado de prueba ya emitido no se actualiza.
- `_legacy_reservations` y `_legacy_payment_proofs` siguen en la base como respaldo; se pueden borrar más adelante a mano.
