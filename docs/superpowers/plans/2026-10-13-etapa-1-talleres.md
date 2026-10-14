# Etapa 1 — Talleres administrables: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los talleres se creen, programen y gestionen desde `/admin`, y que `/taller` muestre sola el taller activo con datos reales de la base (cupos, estado, fechas, sede, precios).

**Architecture:** La tabla `taller_editions` se convierte (renombrar + ampliar) en `talleres`, con estado, fechas reales y una restricción de Postgres que impide dos talleres activos con fechas solapadas. Una capa pura en `src/lib/talleres/` (reglas, validación, mapeo, vista) decide qué taller está activo y qué se muestra; `repo.ts` es la única que habla con Supabase. La página pública arma un `TallerVista` (misma forma que el antiguo objeto `taller`) y lo reparte a los componentes cliente por contexto de React. El admin usa Server Actions protegidas por la contraseña existente.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), React 19.2, TypeScript, Tailwind 4, Supabase (`@supabase/supabase-js` con `service_role`), Postgres, Vitest (nuevo).

**Spec:** `docs/superpowers/specs/2026-10-13-gestion-talleres-design.md` (secciones 3.2, 3.7 paso 2, 4 «Talleres», 5, 9 etapa 1).

## Global Constraints

- Lee `node_modules/next/dist/docs/` antes de usar una API de Next que no aparezca en este plan (AGENTS.md: «This is NOT the Next.js you know»). `params` y `searchParams` son `Promise` y se leen con `await`.
- Toda la UI y los mensajes, en español; los comentarios del código siguen el estilo del repo: en español, explicando el porqué.
- Supabase solo desde el servidor (`getSupabase()` de `src/lib/reservations/supabase.ts`); nunca claves `NEXT_PUBLIC_` para Supabase.
- Toda Server Action del admin empieza comprobando `await isAdmin()`; un Server Action es un endpoint POST público.
- Estados de taller exactamente: `borrador`, `publicado`, `cerrado`, `finalizado`, `archivado`.
- Porcentajes de pago: subconjunto de `{25, 50, 75, 100}` que siempre incluye `100`.
- Nunca dos talleres en estado `publicado` o `cerrado` con fechas (`[fecha_inicio, fecha_fin]`, ambos incluidos) solapadas.
- Zona horaria del negocio para "hoy": `America/Caracas` (en código y en SQL).
- El taller existente `taller-2026-10` queda migrado en estado `finalizado` (decisión del usuario: taller de prueba ya terminado).
- `reservations` y `payment_proofs` NO cambian de estructura en esta etapa; solo cambian las funciones SQL que leen la tabla de talleres.
- La migración SQL es idempotente y la ejecuta el usuario en Supabase → SQL Editor. Ningún agente escribe en la base de producción.
- Sin dependencias nuevas salvo `vitest` (dev).

## Review Focus

1. **Taller `publicado` cuya `fecha_fin` ya pasó** (el admin olvidó finalizarlo) → la página lo muestra como finalizado y ni el servidor ni la base aceptan reservas ni pagos. Tests: Task 1 (`elegirTallerActivo`), Task 3 (SQL `fecha_fin` en `create_reservation`).
2. **Cupos bajados por debajo de los ya ocupados** (20 → 5 con 8 reservas) → `libres = 0`, se ofrece lista de espera y el hero dice "100%", nunca "160%" ni "-3 cupos". Test: Task 1 (`escasez`, `visibilidad`).
3. **Publicar o editar fechas de un taller que choca con otro activo** → mensaje claro "ya hay un taller activo en esas fechas", nunca un error 500. Tests: Task 2 (`motivoDesdeError('23P01')`), Task 3 (SQL de solapamiento).
4. **Error de validación en el formulario del admin** → lo escrito no se borra (React 19 resetea los `<form action>` tras cada envío). Pin: Task 8 usa `onSubmit` + `startTransition`; paso de verificación manual explícito.
5. **Supabase caído o sin configurar** → `/taller` muestra "Próxima edición pronto" con WhatsApp y el admin muestra un aviso; nada revienta. Pin: Task 5 (`cargarTallerPublico` devuelve `sin_conexion`) + verificación manual en Task 6.

---

## Mapa de archivos

**Nuevos**
- `vitest.config.ts` — configuración de pruebas (alias `@`).
- `src/lib/talleres/tipos.ts` — tipos y constantes del dominio.
- `src/lib/talleres/reglas.ts` — lógica pura: taller activo, visibilidad, escasez, fechas, hoy.
- `src/lib/talleres/errores.ts` — traducción de errores de Postgres a motivos y mensajes.
- `src/lib/talleres/mapeo.ts` — fila de BD ⇄ `Taller`.
- `src/lib/talleres/formulario.ts` — lectura y validación del formulario del admin.
- `src/lib/talleres/vista.ts` — `TallerVista` para la página pública.
- `src/lib/talleres/repo.ts` — acceso a Supabase (solo servidor).
- `src/lib/talleres/publico.ts` — `cargarTallerPublico()` cacheado por petición.
- `src/lib/talleres/contexto.tsx` — `TallerProvider` / `useTaller()` (cliente).
- `src/lib/talleres/__tests__/fabrica.ts` y `*.test.ts`.
- `supabase/migrations/20261013_01_talleres.sql` — migración.
- `supabase/tests/talleres.sql` — pruebas de la base (proyecto de prueba).
- `src/components/taller/proxima-edicion.tsx` — página sin taller activo.
- `src/app/admin/actions.ts`, `src/app/admin/page.tsx`.
- `src/components/admin/ui.ts`, `shell.tsx`, `login-form.tsx`, `login-screen.tsx`, `taller-form.tsx`, `taller-acciones.tsx`.
- `src/app/admin/talleres/actions.ts`, `page.tsx`, `nuevo/page.tsx`, `[id]/page.tsx`.

**Modificados**
- `package.json` (script `test`, dev dep `vitest`).
- `supabase/schema.sql` (nota de cabecera).
- `src/lib/taller.ts` → contenido por defecto (`contenidoTaller`).
- `src/app/taller/page.tsx`, `src/app/taller/actions.ts`.
- `src/components/taller/{hero,nav,sections,reserva-form,pago-form,footer}.tsx`.
- `src/lib/reservations/{index,payment-proofs,certificates}.ts`, `src/lib/payments/{types,manual}.ts`.
- `src/components/certificado/sheet.tsx`, `src/app/certificado/[code]/page.tsx`.
- `src/lib/admin-auth.ts`, `src/app/admin/certificados/page.tsx`, `src/app/admin/certificados/imprimir/page.tsx`.

**Eliminados**
- `src/app/admin/certificados/actions.ts`, `src/app/admin/certificados/login-form.tsx` (se mueven).

---

### Task 1: Vitest + reglas del dominio

**Files:**
- Create: `vitest.config.ts`, `src/lib/talleres/tipos.ts`, `src/lib/talleres/reglas.ts`, `src/lib/talleres/__tests__/fabrica.ts`, `src/lib/talleres/__tests__/reglas.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces (`tipos.ts`): `ESTADOS_TALLER`, `TallerEstado`, `ESTADO_ETIQUETA`, `PORCENTAJES_PAGO`, `Tarifa`, `Taller`, `TallerInput`, `Disponibilidad`, `Visibilidad`.
- Produces (`reglas.ts`): `ZONA_HORARIA`, `hoyISO(ahora?: Date, zona?: string): string`, `TallerActivo = { taller: Taller; estadoEfectivo: TallerEstado }`, `elegirTallerActivo(talleres: Taller[], hoy: string): TallerActivo | null`, `visibilidad(estado, disp): Visibilidad`, `escasez(estado, disp): { value: string; label: string }`, `fechasCortas(inicio, fin): string`, `fechasLargas(inicio, fin): string`.
- Produces (`__tests__/fabrica.ts`): `tallerDePrueba(p?: Partial<Taller>): Taller`.

- [ ] **Step 1: Instalar Vitest y añadir el script**

Run: `npm install -D vitest`

En `package.json`, dentro de `"scripts"`, añade tras `"lint": "eslint"`:

```json
    "lint": "eslint",
    "test": "vitest run"
```

Crea `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Crear los tipos**

`src/lib/talleres/tipos.ts`:

```ts
/**
 * Tipos del dominio de talleres. No importan nada de Supabase ni de React: los
 * usan por igual el servidor, el admin y las pruebas.
 */

export const ESTADOS_TALLER = [
  "borrador",
  "publicado",
  "cerrado",
  "finalizado",
  "archivado",
] as const;

export type TallerEstado = (typeof ESTADOS_TALLER)[number];

export const ESTADO_ETIQUETA: Record<TallerEstado, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  cerrado: "Cerrado",
  finalizado: "Finalizado",
  archivado: "Archivado",
};

/** Porcentajes que un taller puede aceptar como pago. El 100 siempre está. */
export const PORCENTAJES_PAGO = [25, 50, 75, 100] as const;

export type Tarifa = {
  /** Estable entre ediciones del taller: las reservas guardan este id. */
  id: string;
  nombre: string;
  descripcion: string;
  /** En la unidad de la moneda, sin decimales (COP no los usa). */
  precio: number;
  /** La que se aplica a las reservas web. */
  destacada: boolean;
};

export type Taller = {
  id: string;
  slug: string;
  /** Nombre interno, se calcula al guardar (título + fechas). */
  nombre: string;
  titulo: string;
  tituloAcento: string | null;
  modalidad: string;
  estado: TallerEstado;
  /** `YYYY-MM-DD` */
  fechaInicio: string;
  /** `YYYY-MM-DD`, igual o posterior a `fechaInicio`. */
  fechaFin: string;
  /** Como se lee en la página y el certificado: "Octubre 24 y 25, 2026". */
  fechasTexto: string;
  sedeNombre: string;
  ciudad: string;
  region: string | null;
  pais: string;
  cuposTotal: number;
  horas: number | null;
  aval: string | null;
  porcentajesPago: number[];
  moneda: string;
  preciosPublicados: boolean;
  tarifas: Tarifa[];
  fotoPrincipal: string | null;
  fotoPrincipalAlt: string | null;
  firmaNombre: string | null;
  firmaCargo: string | null;
  firmaDocumento: string | null;
  /** Reservado para contenido propio del taller (módulos, FAQ…). Nulo = el del código. */
  contenido: unknown;
  creadoEn: string;
};

/** Lo que el admin edita. Estado, id y nombre interno no se escriben desde el formulario. */
export type TallerInput = Omit<Taller, "id" | "nombre" | "estado" | "contenido" | "creadoEn">;

export type Disponibilidad = {
  total: number;
  /** Reservas que ocupan cupo (todas menos las canceladas). */
  ocupados: number;
  libres: number;
};

/** Qué bloques de la página pública se muestran. */
export type Visibilidad = {
  reserva: boolean;
  /** Panel de "agotado" con botón de lista de espera en lugar del formulario. */
  listaEspera: boolean;
  pago: boolean;
  certificados: boolean;
};
```

- [ ] **Step 3: Crear la fábrica de pruebas**

`src/lib/talleres/__tests__/fabrica.ts`:

```ts
import type { Taller } from "../tipos";

export function tallerDePrueba(p: Partial<Taller> = {}): Taller {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "taller-2026-10",
    nombre: "Taller de prueba",
    titulo: "Anestesia Regional Ecoguiada",
    tituloAcento: "+ Sedación TCI",
    modalidad: "Taller presencial",
    estado: "publicado",
    fechaInicio: "2026-10-24",
    fechaFin: "2026-10-25",
    fechasTexto: "Octubre 24 y 25, 2026",
    sedeNombre: "Policlínico San Francisco",
    ciudad: "Maracaibo",
    region: "Zulia",
    pais: "Venezuela",
    cuposTotal: 20,
    horas: null,
    aval: "Avalado por SCARE – SARG",
    porcentajesPago: [50, 100],
    moneda: "COP",
    preciosPublicados: false,
    tarifas: [
      { id: "general", nombre: "Cupo General", descripcion: "", precio: 0, destacada: true },
    ],
    fotoPrincipal: null,
    fotoPrincipalAlt: null,
    firmaNombre: null,
    firmaCargo: null,
    firmaDocumento: null,
    contenido: null,
    creadoEn: "2026-09-17T15:24:23Z",
    ...p,
  };
}
```

- [ ] **Step 4: Escribir las pruebas (fallan)**

`src/lib/talleres/__tests__/reglas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  elegirTallerActivo,
  escasez,
  fechasCortas,
  fechasLargas,
  hoyISO,
  visibilidad,
} from "../reglas";
import { tallerDePrueba } from "./fabrica";

describe("elegirTallerActivo", () => {
  const hoy = "2026-10-13";

  it("elige el publicado que todavía no termina", () => {
    const t = tallerDePrueba({ estado: "publicado" });
    expect(elegirTallerActivo([t], hoy)).toEqual({ taller: t, estadoEfectivo: "publicado" });
  });

  it("un cerrado vigente también es el activo", () => {
    const t = tallerDePrueba({ estado: "cerrado" });
    expect(elegirTallerActivo([t], hoy)?.estadoEfectivo).toBe("cerrado");
  });

  it("el día de fin todavía cuenta como vigente", () => {
    const t = tallerDePrueba({ fechaInicio: "2026-10-12", fechaFin: "2026-10-13" });
    expect(elegirTallerActivo([t], hoy)?.estadoEfectivo).toBe("publicado");
  });

  it("con dos vigentes gana el que empieza antes", () => {
    const tarde = tallerDePrueba({ slug: "b", fechaInicio: "2027-03-01", fechaFin: "2027-03-02" });
    const pronto = tallerDePrueba({ slug: "a", fechaInicio: "2026-11-01", fechaFin: "2026-11-02" });
    expect(elegirTallerActivo([tarde, pronto], hoy)?.taller.slug).toBe("a");
  });

  it("sin vigentes muestra el último finalizado", () => {
    const viejo = tallerDePrueba({ slug: "v", estado: "finalizado", fechaInicio: "2025-01-01", fechaFin: "2025-01-02" });
    const reciente = tallerDePrueba({ slug: "r", estado: "finalizado", fechaInicio: "2026-05-01", fechaFin: "2026-05-02" });
    expect(elegirTallerActivo([viejo, reciente], hoy)?.taller.slug).toBe("r");
  });

  it("un publicado vencido se trata como finalizado", () => {
    const t = tallerDePrueba({ estado: "publicado", fechaInicio: "2026-10-01", fechaFin: "2026-10-02" });
    expect(elegirTallerActivo([t], hoy)).toEqual({ taller: t, estadoEfectivo: "finalizado" });
  });

  it("ignora borradores y archivados", () => {
    const b = tallerDePrueba({ estado: "borrador" });
    const a = tallerDePrueba({ estado: "archivado", fechaFin: "2026-01-02", fechaInicio: "2026-01-01" });
    expect(elegirTallerActivo([b, a], hoy)).toBeNull();
  });

  it("sin talleres devuelve null", () => {
    expect(elegirTallerActivo([], hoy)).toBeNull();
  });
});

describe("visibilidad", () => {
  it("publicado con cupos: reserva y pago", () => {
    expect(visibilidad("publicado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      reserva: true,
      listaEspera: false,
      pago: true,
      certificados: true,
    });
  });

  it("publicado lleno: lista de espera, el pago sigue abierto", () => {
    expect(visibilidad("publicado", { total: 20, ocupados: 20, libres: 0 })).toEqual({
      reserva: false,
      listaEspera: true,
      pago: true,
      certificados: true,
    });
  });

  it("publicado sin datos de cupo: se deja reservar (la base decide al enviar)", () => {
    expect(visibilidad("publicado", null).reserva).toBe(true);
  });

  it("cerrado: lista de espera, sin pago", () => {
    expect(visibilidad("cerrado", null)).toEqual({
      reserva: false,
      listaEspera: true,
      pago: false,
      certificados: true,
    });
  });

  it("finalizado: solo certificados", () => {
    expect(visibilidad("finalizado", null)).toEqual({
      reserva: false,
      listaEspera: false,
      pago: false,
      certificados: true,
    });
  });

  it("borrador: nada", () => {
    expect(visibilidad("borrador", null)).toEqual({
      reserva: false,
      listaEspera: false,
      pago: false,
      certificados: false,
    });
  });
});

describe("escasez", () => {
  it("porcentaje real de cupos vendidos", () => {
    expect(escasez("publicado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      value: "40%",
      label: "de cupos vendidos",
    });
  });

  it("nunca dice 100% si queda al menos un cupo", () => {
    expect(escasez("publicado", { total: 200, ocupados: 199, libres: 1 }).value).toBe("99%");
  });

  it("lleno: 100%", () => {
    expect(escasez("publicado", { total: 20, ocupados: 20, libres: 0 }).value).toBe("100%");
  });

  it("cupos bajados por debajo de los ocupados: 100%, no más", () => {
    expect(escasez("publicado", { total: 5, ocupados: 8, libres: 0 }).value).toBe("100%");
  });

  it("cupo total 0: 100%", () => {
    expect(escasez("publicado", { total: 0, ocupados: 0, libres: 0 }).value).toBe("100%");
  });

  it("sin datos: cupos limitados", () => {
    expect(escasez("publicado", null)).toEqual({ value: "Cupos", label: "limitados" });
  });

  it("cerrado: 100% vendidos aunque queden cupos", () => {
    expect(escasez("cerrado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      value: "100%",
      label: "de cupos vendidos",
    });
  });

  it("finalizado", () => {
    expect(escasez("finalizado", null)).toEqual({ value: "100%", label: "edición finalizada" });
  });
});

describe("fechas", () => {
  it("cortas, mismo mes", () => {
    expect(fechasCortas("2026-10-24", "2026-10-25")).toBe("24–25 OCT 2026");
  });
  it("cortas, un solo día", () => {
    expect(fechasCortas("2026-10-24", "2026-10-24")).toBe("24 OCT 2026");
  });
  it("cortas, cambia de mes", () => {
    expect(fechasCortas("2026-09-30", "2026-10-02")).toBe("30 SEP – 2 OCT 2026");
  });
  it("cortas, cambia de año", () => {
    expect(fechasCortas("2026-12-30", "2027-01-02")).toBe("30 DIC 2026 – 2 ENE 2027");
  });
  it("largas, dos días seguidos", () => {
    expect(fechasLargas("2026-10-24", "2026-10-25")).toBe("Octubre 24 y 25, 2026");
  });
  it("largas, rango de días", () => {
    expect(fechasLargas("2026-10-24", "2026-10-26")).toBe("Octubre 24 al 26, 2026");
  });
  it("largas, un día", () => {
    expect(fechasLargas("2026-10-24", "2026-10-24")).toBe("Octubre 24, 2026");
  });
  it("largas, cambia de mes", () => {
    expect(fechasLargas("2026-09-30", "2026-10-02")).toBe("Septiembre 30 al Octubre 2, 2026");
  });
  it("largas, cambia de año", () => {
    expect(fechasLargas("2026-12-30", "2027-01-02")).toBe("Diciembre 30, 2026 al Enero 2, 2027");
  });
});

describe("hoyISO", () => {
  it("usa la hora de Caracas, no UTC", () => {
    // 02:00 UTC del 14 son las 22:00 del 13 en Caracas (UTC-4).
    expect(hoyISO(new Date("2026-10-14T02:00:00Z"))).toBe("2026-10-13");
  });
});
```

- [ ] **Step 5: Ejecutar y ver que fallan**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../reglas"`.

- [ ] **Step 6: Implementar `reglas.ts`**

`src/lib/talleres/reglas.ts`:

```ts
import type { Disponibilidad, Taller, TallerEstado, Visibilidad } from "./tipos";

/** "Hoy" del negocio. El taller es en Maracaibo; la base usa la misma zona. */
export const ZONA_HORARIA = "America/Caracas";

/** Fecha de hoy como `YYYY-MM-DD` en la zona del negocio. */
export function hoyISO(ahora: Date = new Date(), zona: string = ZONA_HORARIA): string {
  // `en-CA` formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export type TallerActivo = { taller: Taller; estadoEfectivo: TallerEstado };

const vigente = (t: Taller) => t.estado === "publicado" || t.estado === "cerrado";

/**
 * Taller que muestra `/taller`.
 *
 * 1. El publicado o cerrado que todavía no terminó; si hay varios (en fechas
 *    distintas, la base impide solapes), el que empieza antes.
 * 2. Si no, el último que terminó. Un publicado/cerrado cuya fecha ya pasó
 *    cuenta como finalizado: si el admin olvida cerrarlo, la página no debe
 *    seguir vendiendo cupos de un taller que ya ocurrió.
 */
export function elegirTallerActivo(talleres: Taller[], hoy: string): TallerActivo | null {
  const proximos = talleres
    .filter((t) => vigente(t) && t.fechaFin >= hoy)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  if (proximos[0]) return { taller: proximos[0], estadoEfectivo: proximos[0].estado };

  const pasados = talleres
    .filter((t) => t.estado === "finalizado" || (vigente(t) && t.fechaFin < hoy))
    .sort((a, b) => b.fechaFin.localeCompare(a.fechaFin));

  return pasados[0] ? { taller: pasados[0], estadoEfectivo: "finalizado" } : null;
}

export function visibilidad(estado: TallerEstado, disp: Disponibilidad | null): Visibilidad {
  switch (estado) {
    case "publicado": {
      // Sin dato de cupos se deja reservar: la función de la base es quien
      // decide de verdad al enviar, dentro de su transacción.
      const hayCupo = disp ? disp.libres > 0 : true;
      return { reserva: hayCupo, listaEspera: !hayCupo, pago: true, certificados: true };
    }
    case "cerrado":
      return { reserva: false, listaEspera: true, pago: false, certificados: true };
    case "finalizado":
      return { reserva: false, listaEspera: false, pago: false, certificados: true };
    default:
      return { reserva: false, listaEspera: false, pago: false, certificados: false };
  }
}

/**
 * Cifra grande del hero: "40% / de cupos vendidos".
 *
 * Cerrado dice 100% aunque queden plazas: es una decisión comercial (los
 * últimos cupos se cierran por WhatsApp y no dejan fila).
 */
export function escasez(
  estado: TallerEstado,
  disp: Disponibilidad | null,
): { value: string; label: string } {
  if (estado === "finalizado") return { value: "100%", label: "edición finalizada" };
  if (estado !== "publicado") return { value: "100%", label: "de cupos vendidos" };
  if (!disp) return { value: "Cupos", label: "limitados" };
  if (disp.total <= 0 || disp.libres <= 0) return { value: "100%", label: "de cupos vendidos" };

  // Tope en 99: con un cupo libre, "100% vendidos" sería mentira.
  const pct = Math.min(99, Math.max(0, Math.round((disp.ocupados / disp.total) * 100)));
  return { value: `${pct}%`, label: "de cupos vendidos" };
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Se parte el texto en vez de usar `Date`: así ninguna zona horaria mueve el día. */
function partes(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m, d };
}

const corto = (m: number) => MESES[m - 1].slice(0, 3).toUpperCase();
const largo = (m: number) => MESES[m - 1].charAt(0).toUpperCase() + MESES[m - 1].slice(1);

/** "24–25 OCT 2026", para la etiqueta pequeña del hero. */
export function fechasCortas(inicio: string, fin: string): string {
  const i = partes(inicio);
  const f = partes(fin);
  if (inicio === fin) return `${i.d} ${corto(i.m)} ${i.a}`;
  if (i.a === f.a && i.m === f.m) return `${i.d}–${f.d} ${corto(i.m)} ${i.a}`;
  if (i.a === f.a) return `${i.d} ${corto(i.m)} – ${f.d} ${corto(f.m)} ${i.a}`;
  return `${i.d} ${corto(i.m)} ${i.a} – ${f.d} ${corto(f.m)} ${f.a}`;
}

/** "Octubre 24 y 25, 2026": valor por defecto de `fechasTexto`. */
export function fechasLargas(inicio: string, fin: string): string {
  const i = partes(inicio);
  const f = partes(fin);
  if (inicio === fin) return `${largo(i.m)} ${i.d}, ${i.a}`;
  if (i.a === f.a && i.m === f.m) {
    const dias = f.d - i.d === 1 ? `${i.d} y ${f.d}` : `${i.d} al ${f.d}`;
    return `${largo(i.m)} ${dias}, ${i.a}`;
  }
  if (i.a === f.a) return `${largo(i.m)} ${i.d} al ${largo(f.m)} ${f.d}, ${i.a}`;
  return `${largo(i.m)} ${i.d}, ${i.a} al ${largo(f.m)} ${f.d}, ${f.a}`;
}
```

- [ ] **Step 7: Ejecutar y ver que pasan**

Run: `npm test`
Expected: PASS, 32 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/talleres
git commit -m "feat(talleres): reglas del dominio y Vitest"
```

---

### Task 2: Errores, mapeo y formulario del admin

**Files:**
- Create: `src/lib/talleres/errores.ts`, `src/lib/talleres/mapeo.ts`, `src/lib/talleres/formulario.ts`
- Test: `src/lib/talleres/__tests__/errores.test.ts`, `mapeo.test.ts`, `formulario.test.ts`

**Interfaces:**
- Consumes: `Taller`, `TallerInput`, `Tarifa`, `PORCENTAJES_PAGO` (Task 1), `fechasLargas` (Task 1).
- Produces (`errores.ts`): `MotivoError = "sin_conexion" | "solapamiento" | "slug_duplicado" | "tiene_inscripciones" | "no_encontrado" | "error"`, `motivoDesdeError(error: { code?: string } | null | undefined): MotivoError`, `MENSAJES_ERROR: Record<MotivoError, string>`.
- Produces (`mapeo.ts`): `FilaTaller` (snake_case), `COLUMNAS_TALLER: string`, `filaATaller(f: FilaTaller): Taller`, `tallerAFila(t: TallerInput): Omit<FilaTaller, "id" | "estado" | "contenido" | "creado_en">`, `nombreInterno(t: Pick<TallerInput, "titulo" | "tituloAcento" | "fechasTexto">): string`.
- Produces (`formulario.ts`): `slugify(texto: string): string`, `LecturaTaller = { ok: true; datos: TallerInput } | { ok: false; errores: Record<string, string> }`, `leerTallerForm(fd: FormData): LecturaTaller`. Nombres de campo del formulario: `slug, titulo, titulo_acento, modalidad, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, region, pais, cupos_total, horas, aval, porcentajes_pago (múltiple), moneda, precios_publicados (checkbox), tarifa_id[], tarifa_nombre[], tarifa_descripcion[], tarifa_precio[], tarifa_destacada (radio con el índice de fila), foto_principal, foto_principal_alt, firma_nombre, firma_cargo, firma_documento`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

`src/lib/talleres/__tests__/errores.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MENSAJES_ERROR, motivoDesdeError } from "../errores";

describe("motivoDesdeError", () => {
  it("23P01 (exclusión) es solapamiento de fechas", () => {
    expect(motivoDesdeError({ code: "23P01" })).toBe("solapamiento");
  });
  it("23505 (único) es slug duplicado", () => {
    expect(motivoDesdeError({ code: "23505" })).toBe("slug_duplicado");
  });
  it("23503 (FK) es que tiene inscripciones", () => {
    expect(motivoDesdeError({ code: "23503" })).toBe("tiene_inscripciones");
  });
  it("cualquier otro código o ninguno es error genérico", () => {
    expect(motivoDesdeError({ code: "XX000" })).toBe("error");
    expect(motivoDesdeError(null)).toBe("error");
  });
  it("todos los motivos tienen mensaje en español", () => {
    expect(MENSAJES_ERROR.solapamiento).toMatch(/fechas/);
  });
});
```

`src/lib/talleres/__tests__/mapeo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filaATaller, nombreInterno, tallerAFila, type FilaTaller } from "../mapeo";

const fila: FilaTaller = {
  id: "abc",
  slug: "taller-2026-10",
  nombre: "x",
  titulo: "Anestesia Regional Ecoguiada",
  titulo_acento: "+ Sedación TCI",
  modalidad: "Taller presencial",
  estado: "finalizado",
  fecha_inicio: "2026-10-24",
  fecha_fin: "2026-10-25",
  fechas_texto: "Octubre 24 y 25, 2026",
  sede_nombre: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  pais: "Venezuela",
  cupos_total: 20,
  horas: null,
  aval: "Avalado por SCARE – SARG",
  porcentajes_pago: [50, 100],
  moneda: "COP",
  precios_publicados: false,
  tarifas: [{ id: "general", nombre: "Cupo General", descripcion: "", precio: 0, destacada: true }],
  foto_principal: null,
  foto_principal_alt: null,
  firma_nombre: "MD. Stevan J. Camelo C.",
  firma_cargo: "Anestesiólogo",
  firma_documento: "C.C. 1.136.882.468",
  contenido: null,
  creado_en: "2026-09-17T15:24:23Z",
};

describe("mapeo", () => {
  it("fila → Taller en camelCase", () => {
    const t = filaATaller(fila);
    expect(t.tituloAcento).toBe("+ Sedación TCI");
    expect(t.cuposTotal).toBe(20);
    expect(t.estado).toBe("finalizado");
    expect(t.firmaDocumento).toBe("C.C. 1.136.882.468");
  });

  it("tarifas nulas llegan como lista vacía", () => {
    expect(filaATaller({ ...fila, tarifas: null }).tarifas).toEqual([]);
  });

  it("Taller → fila calcula el nombre interno", () => {
    const { id, nombre, estado, contenido, creadoEn, ...input } = filaATaller(fila);
    void id; void nombre; void estado; void contenido; void creadoEn;
    const out = tallerAFila(input);
    expect(out.nombre).toBe("Anestesia Regional Ecoguiada + Sedación TCI · Octubre 24 y 25, 2026");
    expect(out.titulo_acento).toBe("+ Sedación TCI");
    expect(out).not.toHaveProperty("estado");
  });

  it("nombre interno sin acento", () => {
    expect(nombreInterno({ titulo: "Curso", tituloAcento: null, fechasTexto: "Marzo 3, 2027" })).toBe(
      "Curso · Marzo 3, 2027",
    );
  });
});
```

`src/lib/talleres/__tests__/formulario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leerTallerForm, slugify } from "../formulario";

function form(campos: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

const valido = {
  titulo: "Anestesia Regional Ecoguiada",
  titulo_acento: "+ Sedación TCI",
  fecha_inicio: "2027-03-06",
  fecha_fin: "2027-03-07",
  sede_nombre: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  pais: "Venezuela",
  cupos_total: "20",
  horas: "",
  porcentajes_pago: ["50"],
  moneda: "cop",
  tarifa_id: ["general", ""],
  tarifa_nombre: ["Cupo General", "Residente / Estudiante"],
  tarifa_descripcion: ["Acceso completo", "Tarifa especial"],
  tarifa_precio: ["1200000", "900000"],
  tarifa_destacada: "0",
};

describe("slugify", () => {
  it("quita tildes, espacios y símbolos", () => {
    expect(slugify("Residente / Estudiante")).toBe("residente-estudiante");
    expect(slugify("  Sedación TCI  ")).toBe("sedacion-tci");
  });
});

describe("leerTallerForm", () => {
  it("lee un formulario válido", () => {
    const r = leerTallerForm(form(valido));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.slug).toBe("taller-2027-03");
    expect(r.datos.fechasTexto).toBe("Marzo 6 y 7, 2027");
    expect(r.datos.cuposTotal).toBe(20);
    expect(r.datos.horas).toBeNull();
    expect(r.datos.moneda).toBe("COP");
    expect(r.datos.modalidad).toBe("Taller presencial");
    expect(r.datos.porcentajesPago).toEqual([50, 100]);
    expect(r.datos.preciosPublicados).toBe(false);
    expect(r.datos.tarifas).toEqual([
      { id: "general", nombre: "Cupo General", descripcion: "Acceso completo", precio: 1200000, destacada: true },
      { id: "residente-estudiante", nombre: "Residente / Estudiante", descripcion: "Tarifa especial", precio: 900000, destacada: false },
    ]);
  });

  it("respeta el slug y el texto de fechas escritos a mano", () => {
    const r = leerTallerForm(form({ ...valido, slug: "taller-marzo", fechas_texto: "6 y 7 de marzo" }));
    expect(r.ok && r.datos.slug).toBe("taller-marzo");
    expect(r.ok && r.datos.fechasTexto).toBe("6 y 7 de marzo");
  });

  it("el 100% siempre está y se ignoran porcentajes inventados", () => {
    const r = leerTallerForm(form({ ...valido, porcentajes_pago: ["33", "25"] }));
    expect(r.ok && r.datos.porcentajesPago).toEqual([25, 100]);
  });

  it("fin antes que inicio es error", () => {
    const r = leerTallerForm(form({ ...valido, fecha_fin: "2027-03-01" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.fecha_fin).toMatch(/anterior/);
  });

  it("fecha imposible es error", () => {
    const r = leerTallerForm(form({ ...valido, fecha_inicio: "2027-02-30" }));
    expect(!r.ok && r.errores.fecha_inicio).toBeTruthy();
  });

  it("cupos no numéricos es error", () => {
    const r = leerTallerForm(form({ ...valido, cupos_total: "veinte" }));
    expect(!r.ok && r.errores.cupos_total).toBeTruthy();
  });

  it("horas fuera de rango es error", () => {
    const r = leerTallerForm(form({ ...valido, horas: "0" }));
    expect(!r.ok && r.errores.horas).toBeTruthy();
  });

  it("slug inválido es error", () => {
    const r = leerTallerForm(form({ ...valido, slug: "Taller Marzo!" }));
    expect(!r.ok && r.errores.slug).toBeTruthy();
  });

  it("sin tarifas es error", () => {
    const r = leerTallerForm(
      form({ ...valido, tarifa_id: [""], tarifa_nombre: [""], tarifa_descripcion: [""], tarifa_precio: [""] }),
    );
    expect(!r.ok && r.errores.tarifas).toBeTruthy();
  });

  it("precio negativo es error", () => {
    const r = leerTallerForm(form({ ...valido, tarifa_precio: ["-5", "900000"] }));
    expect(!r.ok && r.errores.tarifa_precio_0).toBeTruthy();
  });

  it("si ninguna tarifa queda destacada, se destaca la primera", () => {
    const r = leerTallerForm(form({ ...valido, tarifa_destacada: "9" }));
    expect(r.ok && r.datos.tarifas[0].destacada).toBe(true);
  });

  it("título, sede, ciudad y país son obligatorios", () => {
    const r = leerTallerForm(form({ ...valido, titulo: "", sede_nombre: "", ciudad: "", pais: "" }));
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["ciudad", "pais", "sede_nombre", "titulo"]);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npm test`
Expected: FAIL — no se resuelven `../errores`, `../mapeo`, `../formulario`.

- [ ] **Step 3: Implementar `errores.ts`**

```ts
/**
 * Traducción de los errores de Postgres que el admin puede provocar. Las
 * reglas viven en la base (restricciones), así que el código solo tiene que
 * ponerles nombre y mensaje.
 */

export type MotivoError =
  | "sin_conexion"
  | "solapamiento"
  | "slug_duplicado"
  | "tiene_inscripciones"
  | "no_encontrado"
  | "error";

export function motivoDesdeError(error: { code?: string } | null | undefined): MotivoError {
  switch (error?.code) {
    case "23P01": // exclusion_violation: `talleres_sin_solape`
      return "solapamiento";
    case "23505": // unique_violation: slug repetido
      return "slug_duplicado";
    case "23503": // foreign_key_violation: hay reservas colgando del taller
      return "tiene_inscripciones";
    default:
      return "error";
  }
}

export const MENSAJES_ERROR: Record<MotivoError, string> = {
  sin_conexion: "No hay conexión con la base de datos. Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
  solapamiento:
    "Ya hay otro taller publicado o cerrado en esas fechas. Cambia las fechas o finaliza el otro taller primero.",
  slug_duplicado: "Ya existe un taller con ese identificador (slug). Escribe otro.",
  tiene_inscripciones:
    "Este taller tiene reservas y no se puede eliminar. Archívalo para ocultarlo sin perder el historial.",
  no_encontrado: "No encontramos ese taller. Puede que se haya eliminado.",
  error: "No se pudo guardar. Inténtalo otra vez en unos segundos.",
};
```

- [ ] **Step 4: Implementar `mapeo.ts`**

```ts
import type { Tarifa, Taller, TallerEstado, TallerInput } from "./tipos";

/** Fila de `public.talleres` tal como la devuelve Supabase. */
export type FilaTaller = {
  id: string;
  slug: string;
  nombre: string;
  titulo: string;
  titulo_acento: string | null;
  modalidad: string;
  estado: TallerEstado;
  fecha_inicio: string;
  fecha_fin: string;
  fechas_texto: string;
  sede_nombre: string;
  ciudad: string;
  region: string | null;
  pais: string;
  cupos_total: number;
  horas: number | null;
  aval: string | null;
  porcentajes_pago: number[];
  moneda: string;
  precios_publicados: boolean;
  tarifas: Tarifa[] | null;
  foto_principal: string | null;
  foto_principal_alt: string | null;
  firma_nombre: string | null;
  firma_cargo: string | null;
  firma_documento: string | null;
  contenido: unknown;
  creado_en: string;
};

export const COLUMNAS_TALLER =
  "id, slug, nombre, titulo, titulo_acento, modalidad, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, region, pais, cupos_total, horas, aval, porcentajes_pago, moneda, precios_publicados, tarifas, foto_principal, foto_principal_alt, firma_nombre, firma_cargo, firma_documento, contenido, creado_en";

export function filaATaller(f: FilaTaller): Taller {
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    titulo: f.titulo,
    tituloAcento: f.titulo_acento,
    modalidad: f.modalidad,
    estado: f.estado,
    fechaInicio: f.fecha_inicio,
    fechaFin: f.fecha_fin,
    fechasTexto: f.fechas_texto,
    sedeNombre: f.sede_nombre,
    ciudad: f.ciudad,
    region: f.region,
    pais: f.pais,
    cuposTotal: f.cupos_total,
    horas: f.horas,
    aval: f.aval,
    porcentajesPago: f.porcentajes_pago,
    moneda: f.moneda,
    preciosPublicados: f.precios_publicados,
    tarifas: f.tarifas ?? [],
    fotoPrincipal: f.foto_principal,
    fotoPrincipalAlt: f.foto_principal_alt,
    firmaNombre: f.firma_nombre,
    firmaCargo: f.firma_cargo,
    firmaDocumento: f.firma_documento,
    contenido: f.contenido,
    creadoEn: f.creado_en,
  };
}

/** Nombre interno de la fila: lo que se lee en listados de Supabase. */
export function nombreInterno(t: Pick<TallerInput, "titulo" | "tituloAcento" | "fechasTexto">) {
  return `${[t.titulo, t.tituloAcento].filter(Boolean).join(" ")} · ${t.fechasTexto}`;
}

export function tallerAFila(t: TallerInput): Omit<FilaTaller, "id" | "estado" | "contenido" | "creado_en"> {
  return {
    slug: t.slug,
    nombre: nombreInterno(t),
    titulo: t.titulo,
    titulo_acento: t.tituloAcento,
    modalidad: t.modalidad,
    fecha_inicio: t.fechaInicio,
    fecha_fin: t.fechaFin,
    fechas_texto: t.fechasTexto,
    sede_nombre: t.sedeNombre,
    ciudad: t.ciudad,
    region: t.region,
    pais: t.pais,
    cupos_total: t.cuposTotal,
    horas: t.horas,
    aval: t.aval,
    porcentajes_pago: t.porcentajesPago,
    moneda: t.moneda,
    precios_publicados: t.preciosPublicados,
    tarifas: t.tarifas,
    foto_principal: t.fotoPrincipal,
    foto_principal_alt: t.fotoPrincipalAlt,
    firma_nombre: t.firmaNombre,
    firma_cargo: t.firmaCargo,
    firma_documento: t.firmaDocumento,
  };
}
```

- [ ] **Step 5: Implementar `formulario.ts`**

```ts
import { fechasLargas } from "./reglas";
import { PORCENTAJES_PAGO, type Tarifa, type TallerInput } from "./tipos";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rechaza también fechas imposibles como 2027-02-30, que `Date` corregiría en silencio. */
function fechaValida(s: string) {
  if (!FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type LecturaTaller =
  | { ok: true; datos: TallerInput }
  | { ok: false; errores: Record<string, string> };

/**
 * Lee y valida el formulario de taller del admin. Las mismas reglas están en
 * la base como restricciones; aquí se repiten para dar el mensaje junto al
 * campo en lugar de un error genérico.
 */
export function leerTallerForm(fd: FormData): LecturaTaller {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const opcional = (k: string) => s(k) || null;
  const errores: Record<string, string> = {};

  const titulo = s("titulo");
  if (titulo.length < 3) errores.titulo = "Escribe el título del taller.";

  const fechaInicio = s("fecha_inicio");
  const fechaFin = s("fecha_fin");
  const inicioOk = fechaValida(fechaInicio);
  if (!inicioOk) errores.fecha_inicio = "Fecha de inicio no válida.";
  if (!fechaValida(fechaFin)) errores.fecha_fin = "Fecha de fin no válida.";
  else if (inicioOk && fechaFin < fechaInicio)
    errores.fecha_fin = "La fecha de fin no puede ser anterior a la de inicio.";

  const slug = s("slug") || (inicioOk ? `taller-${fechaInicio.slice(0, 7)}` : "");
  if (!SLUG.test(slug)) errores.slug = "Solo minúsculas, números y guiones (ej. taller-2027-03).";

  const sedeNombre = s("sede_nombre");
  const ciudad = s("ciudad");
  const pais = s("pais");
  if (!sedeNombre) errores.sede_nombre = "Indica la sede.";
  if (!ciudad) errores.ciudad = "Indica la ciudad.";
  if (!pais) errores.pais = "Indica el país.";

  const cuposTotal = Number(s("cupos_total"));
  if (!s("cupos_total") || !Number.isInteger(cuposTotal) || cuposTotal < 0 || cuposTotal > 1000)
    errores.cupos_total = "Cupos: número entero entre 0 y 1000.";

  const horasTexto = s("horas");
  const horas = horasTexto ? Number(horasTexto) : null;
  if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 500))
    errores.horas = "Horas: número entero entre 1 y 500, o vacío.";

  const elegidos = fd.getAll("porcentajes_pago").map(Number);
  const porcentajesPago = PORCENTAJES_PAGO.filter((p) => p === 100 || elegidos.includes(p));

  const moneda = (s("moneda") || "COP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) errores.moneda = "Código de moneda de 3 letras (COP, USD…).";

  const tarifas = leerTarifas(fd, errores);

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      slug,
      titulo,
      tituloAcento: opcional("titulo_acento"),
      modalidad: s("modalidad") || "Taller presencial",
      fechaInicio,
      fechaFin,
      fechasTexto: s("fechas_texto") || fechasLargas(fechaInicio, fechaFin),
      sedeNombre,
      ciudad,
      region: opcional("region"),
      pais,
      cuposTotal,
      horas,
      aval: opcional("aval"),
      porcentajesPago: [...porcentajesPago],
      moneda,
      preciosPublicados: fd.get("precios_publicados") === "on",
      tarifas,
      fotoPrincipal: opcional("foto_principal"),
      fotoPrincipalAlt: opcional("foto_principal_alt"),
      firmaNombre: opcional("firma_nombre"),
      firmaCargo: opcional("firma_cargo"),
      firmaDocumento: opcional("firma_documento"),
    },
  };
}

/**
 * Las tarifas llegan como columnas paralelas (`tarifa_nombre[]`, …). Una fila
 * sin nombre se ignora: es la fila vacía que el formulario ofrece para añadir.
 */
function leerTarifas(fd: FormData, errores: Record<string, string>): Tarifa[] {
  const col = (k: string) => fd.getAll(k).map((v) => String(v).trim());
  const ids = col("tarifa_id");
  const nombres = col("tarifa_nombre");
  const descripciones = col("tarifa_descripcion");
  const precios = col("tarifa_precio");
  const destacada = String(fd.get("tarifa_destacada") ?? "0");

  const tarifas: Tarifa[] = [];
  nombres.forEach((nombre, i) => {
    if (!nombre) return;
    const precio = Number(precios[i] || "0");
    if (!Number.isInteger(precio) || precio < 0) {
      errores[`tarifa_precio_${i}`] = `Precio no válido en «${nombre}».`;
      return;
    }
    // El id se conserva al editar: las reservas guardan `tier_id`.
    let id = ids[i] || slugify(nombre) || `tarifa-${i + 1}`;
    while (tarifas.some((t) => t.id === id)) id = `${id}-${i + 1}`;
    tarifas.push({ id, nombre, descripcion: descripciones[i] ?? "", precio, destacada: String(i) === destacada });
  });

  if (tarifas.length === 0) errores.tarifas = "Añade al menos una tarifa.";
  else if (!tarifas.some((t) => t.destacada)) tarifas[0].destacada = true;

  return tarifas;
}
```

- [ ] **Step 6: Ejecutar y ver que pasan**

Run: `npm test`
Expected: PASS (todas, incluidas las de Task 1).

- [ ] **Step 7: Commit**

```bash
git add src/lib/talleres
git commit -m "feat(talleres): validación del formulario, mapeo y errores"
```

---

### Task 3: Migración SQL de `taller_editions` a `talleres`

**Files:**
- Create: `supabase/migrations/20261013_01_talleres.sql`, `supabase/tests/talleres.sql`
- Modify: `supabase/schema.sql:1-12` (nota de cabecera)

**Interfaces:**
- Produces (base de datos):
  - Tabla `public.talleres` con exactamente las columnas de `COLUMNAS_TALLER` (Task 2) + `actualizado_en`. `slug` sigue siendo la clave primaria (FK de `reservations.edition` y `payment_proofs.edition`); `id` es `uuid unique`.
  - Enum `public.taller_estado`.
  - Restricciones `talleres_fechas_orden`, `talleres_porcentajes_validos`, `talleres_sin_solape` (exclusión → código `23P01`).
  - Vista `public.talleres_disponibilidad (id, slug, total, ocupados, libres)`.
  - Vista `public.taller_certificates` con las columnas de antes + `venue_city, venue_region, signature_name, signature_title, signature_document`.
  - `create_reservation(...)` y `register_payment_proof(...)` con la misma firma; devuelven `closed` si el taller no está `publicado` o su `fecha_fin` ya pasó (hora de Caracas).
  - Se eliminan la vista `taller_availability` y las columnas `is_open`, `course_title`.

- [ ] **Step 1: Escribir la migración**

`supabase/migrations/20261013_01_talleres.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Etapa 1 · Talleres administrables
--
-- Convierte `taller_editions` en `talleres`: estado, fechas reales, sede,
-- precios y firma por taller, y la regla de que nunca haya dos talleres activos
-- con fechas solapadas.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar → Run. Se ejecuta después de
-- `supabase/schema.sql` y es idempotente: puede volver a ejecutarse.
--
-- No toca `reservations` ni `payment_proofs`: sus FK a `taller_editions(slug)`
-- siguen la tabla al renombrarla.
-- ---------------------------------------------------------------------------

begin;

do $$
begin
  create type public.taller_estado as enum
    ('borrador', 'publicado', 'cerrado', 'finalizado', 'archivado');
exception
  when duplicate_object then null;
end
$$;

-- Las vistas dependen de columnas que cambian o desaparecen: se recrean al final.
drop view if exists public.taller_availability;
drop view if exists public.taller_certificates;

do $$
begin
  if to_regclass('public.talleres') is null then
    alter table public.taller_editions rename to talleres;
  end if;
end
$$;

-- Renombres de columnas (solo si siguen con el nombre viejo).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('name', 'nombre'),
      ('total_seats', 'cupos_total'),
      ('dates_label', 'fechas_texto'),
      ('hours', 'horas'),
      ('endorsement', 'aval'),
      ('created_at', 'creado_en')
    ) as v(viejo, nuevo)
  loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'talleres' and column_name = r.viejo
    ) and not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'talleres' and column_name = r.nuevo
    ) then
      execute format('alter table public.talleres rename column %I to %I', r.viejo, r.nuevo);
    end if;
  end loop;
end
$$;

alter table public.talleres
  add column if not exists id                 uuid not null default gen_random_uuid(),
  add column if not exists titulo             text,
  add column if not exists titulo_acento      text,
  add column if not exists modalidad          text not null default 'Taller presencial',
  add column if not exists estado             public.taller_estado not null default 'borrador',
  add column if not exists fecha_inicio       date,
  add column if not exists fecha_fin          date,
  add column if not exists sede_nombre        text,
  add column if not exists ciudad             text,
  add column if not exists region             text,
  add column if not exists pais               text,
  add column if not exists porcentajes_pago   integer[] not null default '{50,100}',
  add column if not exists moneda             text not null default 'COP',
  add column if not exists precios_publicados boolean not null default false,
  add column if not exists tarifas            jsonb not null default '[]'::jsonb,
  add column if not exists foto_principal     text,
  add column if not exists foto_principal_alt text,
  add column if not exists firma_nombre       text,
  add column if not exists firma_cargo        text,
  add column if not exists firma_documento    text,
  -- Reservado para contenido propio del taller (módulos, FAQ, galería…).
  -- Nulo = la página usa el contenido por defecto de `src/lib/taller.ts`.
  add column if not exists contenido          jsonb,
  add column if not exists actualizado_en     timestamptz not null default now();

create unique index if not exists talleres_id_key on public.talleres (id);

-- `course_title` ("A + B") se parte en título y acento.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talleres' and column_name = 'course_title'
  ) then
    update public.talleres
       set titulo = coalesce(
             titulo,
             case when position(' + ' in course_title) > 0
                  then split_part(course_title, ' + ', 1)
                  else coalesce(course_title, nombre) end),
           titulo_acento = coalesce(
             titulo_acento,
             case when position(' + ' in course_title) > 0
                  then '+ ' || substr(course_title, position(' + ' in course_title) + 3) end);
    alter table public.talleres drop column course_title;
  end if;
end
$$;

-- `is_open` pasa a `estado`. Solo corre la primera vez (luego la columna ya no
-- existe), así que no pisa estados elegidos después desde el admin.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talleres' and column_name = 'is_open'
  ) then
    update public.talleres
       set estado = case when is_open then 'publicado'::public.taller_estado
                         else 'cerrado'::public.taller_estado end;
    -- Decisión del dueño: la edición de octubre 2026 se trata como terminada
    -- (taller de prueba para certificados).
    update public.talleres set estado = 'finalizado' where slug = 'taller-2026-10';
    alter table public.talleres drop column is_open;
  end if;
end
$$;

-- Datos de la edición existente que antes vivían en `src/lib/taller.ts`.
update public.talleres
   set titulo             = coalesce(titulo, 'Anestesia Regional Ecoguiada'),
       titulo_acento      = coalesce(titulo_acento, '+ Sedación TCI'),
       fecha_inicio       = coalesce(fecha_inicio, date '2026-10-24'),
       fecha_fin          = coalesce(fecha_fin, date '2026-10-25'),
       sede_nombre        = coalesce(sede_nombre, 'Policlínico San Francisco'),
       ciudad             = coalesce(ciudad, 'Maracaibo'),
       region             = coalesce(region, 'Zulia'),
       pais               = coalesce(pais, 'Venezuela'),
       foto_principal     = coalesce(foto_principal, '/assets/taller-bomba-tci.webp'),
       foto_principal_alt = coalesce(foto_principal_alt,
                              'Stevan J. Camelo junto a una bomba de infusión para sedación TCI'),
       firma_nombre       = coalesce(firma_nombre, 'MD. Stevan J. Camelo C.'),
       firma_cargo        = coalesce(firma_cargo, 'Anestesiólogo'),
       firma_documento    = coalesce(firma_documento, 'C.C. 1.136.882.468'),
       tarifas = case when tarifas = '[]'::jsonb then
         '[{"id":"general","nombre":"Cupo General","descripcion":"Acceso completo a los 7 módulos, prácticas y certificado.","precio":0,"destacada":true},
           {"id":"residente","nombre":"Residente / Estudiante","descripcion":"Tarifa especial. Requiere certificado de residencia vigente.","precio":0,"destacada":false}]'::jsonb
         else tarifas end
 where slug = 'taller-2026-10';

-- Cualquier otra fila antigua: valores mínimos para poder exigir NOT NULL.
update public.talleres
   set titulo       = coalesce(titulo, nombre),
       fecha_inicio = coalesce(fecha_inicio, creado_en::date),
       fecha_fin    = coalesce(fecha_fin, creado_en::date),
       fechas_texto = coalesce(fechas_texto, ''),
       sede_nombre  = coalesce(sede_nombre, ''),
       ciudad       = coalesce(ciudad, ''),
       pais         = coalesce(pais, '');

alter table public.talleres
  alter column titulo       set not null,
  alter column fecha_inicio set not null,
  alter column fecha_fin    set not null,
  alter column fechas_texto set not null,
  alter column sede_nombre  set not null,
  alter column ciudad       set not null,
  alter column pais         set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'talleres_fechas_orden') then
    alter table public.talleres
      add constraint talleres_fechas_orden check (fecha_fin >= fecha_inicio);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'talleres_porcentajes_validos') then
    alter table public.talleres
      add constraint talleres_porcentajes_validos
      check (porcentajes_pago <@ array[25, 50, 75, 100] and 100 = any (porcentajes_pago));
  end if;

  -- La regla central: dos talleres activos (publicado o cerrado) nunca
  -- comparten un día. Los rangos son cerrados por ambos lados ('[]').
  if not exists (select 1 from pg_constraint where conname = 'talleres_sin_solape') then
    alter table public.talleres
      add constraint talleres_sin_solape
      exclude using gist (daterange(fecha_inicio, fecha_fin, '[]') with &&)
      where (estado in ('publicado', 'cerrado'));
  end if;
end
$$;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists talleres_actualizado_en on public.talleres;
create trigger talleres_actualizado_en
  before update on public.talleres
  for each row execute function public.tocar_actualizado_en();

alter table public.talleres enable row level security;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create or replace view public.talleres_disponibilidad
with (security_invoker = on) as
  select
    t.id,
    t.slug,
    t.cupos_total as total,
    (count(r.id) filter (where r.status <> 'cancelled'))::integer as ocupados,
    greatest(t.cupos_total - (count(r.id) filter (where r.status <> 'cancelled')), 0)::integer as libres
  from public.talleres t
  left join public.reservations r on r.edition = t.slug
  group by t.id, t.slug, t.cupos_total;

create or replace view public.taller_certificates
with (security_invoker = on) as
  select
    r.reference,
    r.name,
    r.email,
    r.profession,
    r.city,
    r.edition,
    trim(concat_ws(' ', t.titulo, t.titulo_acento)) as course_title,
    t.fechas_texto as dates_label,
    t.horas        as hours,
    t.aval         as endorsement,
    t.ciudad       as venue_city,
    t.region       as venue_region,
    t.firma_nombre    as signature_name,
    t.firma_cargo     as signature_title,
    t.firma_documento as signature_document,
    r.created_at
  from public.reservations r
  join public.talleres t on t.slug = r.edition
  where r.status = 'confirmed'
    and r.attended;

-- ---------------------------------------------------------------------------
-- Funciones de reserva y pago: misma firma, ahora leen `talleres`.
-- "Abierto" = publicado y sin haber terminado (hora de Caracas).
-- ---------------------------------------------------------------------------

create or replace function public.create_reservation(
  p_edition    text,
  p_reference  text,
  p_tier_id    text,
  p_tier_name  text,
  p_amount     integer,
  p_currency   text,
  p_name       text,
  p_email      text,
  p_phone      text,
  p_city       text,
  p_profession text,
  p_notes      text
)
returns table (
  ok             boolean,
  reason         text,
  reservation_id uuid,
  seats_total    integer,
  seats_taken    integer,
  seats_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_open  boolean;
  v_taken integer;
  v_id    uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_edition));

  select t.cupos_total,
         (t.estado = 'publicado' and t.fecha_fin >= (now() at time zone 'America/Caracas')::date)
    into v_total, v_open
    from public.talleres t
   where t.slug = p_edition;

  if not found then
    return query select false, 'unknown_edition'::text, null::uuid, 0, 0, 0;
    return;
  end if;

  select count(*)::integer
    into v_taken
    from public.reservations r
   where r.edition = p_edition
     and r.status <> 'cancelled';

  if not v_open then
    return query select false, 'closed'::text, null::uuid,
                        v_total, v_taken, greatest(v_total - v_taken, 0);
    return;
  end if;

  if v_taken >= v_total then
    return query select false, 'sold_out'::text, null::uuid, v_total, v_taken, 0;
    return;
  end if;

  insert into public.reservations (
    reference, edition, tier_id, tier_name, amount, currency,
    name, email, phone, city, profession, notes
  )
  values (
    p_reference, p_edition, p_tier_id, p_tier_name, p_amount, p_currency,
    p_name, p_email, p_phone, p_city, p_profession, coalesce(p_notes, '')
  )
  returning public.reservations.id into v_id;

  v_taken := v_taken + 1;

  return query select true, null::text, v_id,
                      v_total, v_taken, greatest(v_total - v_taken, 0);
end;
$$;

create or replace function public.register_payment_proof(
  p_edition            text,
  p_proof_id           uuid,
  p_existing_reference text,
  p_new_reference      text,
  p_tier_id            text,
  p_tier_name          text,
  p_amount             integer,
  p_currency           text,
  p_kind               text,
  p_name               text,
  p_document           text,
  p_email              text,
  p_phone              text,
  p_city               text,
  p_profession         text,
  p_notes              text,
  p_file_path          text,
  p_file_type          text,
  p_file_size          integer
)
returns table (
  ok                    boolean,
  reason                text,
  reservation_reference text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total  integer;
  v_open   boolean;
  v_taken  integer;
  v_res_id uuid;
  v_ref    text;
begin
  perform pg_advisory_xact_lock(hashtext(p_edition));

  select t.cupos_total,
         (t.estado = 'publicado' and t.fecha_fin >= (now() at time zone 'America/Caracas')::date)
    into v_total, v_open
    from public.talleres t
   where t.slug = p_edition;

  if not found then
    return query select false, 'unknown_edition'::text, null::text;
    return;
  end if;

  -- Antes el pago a una reserva existente se aceptaba siempre. Ahora el
  -- registro de pagos se cierra con el taller, igual que en la página.
  if not v_open then
    return query select false, 'closed'::text, null::text;
    return;
  end if;

  if p_existing_reference is not null then
    select r.id, r.reference
      into v_res_id, v_ref
      from public.reservations r
     where r.reference = p_existing_reference
       and r.edition   = p_edition
       and r.status   <> 'cancelled';

    if not found then
      return query select false, 'unknown_reference'::text, null::text;
      return;
    end if;

    update public.reservations
       set document = coalesce(document, p_document)
     where id = v_res_id;
  else
    select count(*)::integer
      into v_taken
      from public.reservations r
     where r.edition = p_edition
       and r.status <> 'cancelled';

    if v_taken >= v_total then
      return query select false, 'sold_out'::text, null::text;
      return;
    end if;

    insert into public.reservations (
      reference, edition, tier_id, tier_name, amount, currency,
      name, document, email, phone, city, profession
    )
    values (
      p_new_reference, p_edition, p_tier_id, p_tier_name, p_amount, p_currency,
      p_name, p_document, p_email, p_phone, p_city, p_profession
    )
    returning public.reservations.id, public.reservations.reference
      into v_res_id, v_ref;
  end if;

  insert into public.payment_proofs (
    id, edition, reservation_id, reference, kind,
    name, document, email, phone, notes, file_path, file_type, file_size
  )
  values (
    p_proof_id, p_edition, v_res_id, v_ref, p_kind::public.payment_kind,
    p_name, p_document, p_email, p_phone, coalesce(p_notes, ''),
    p_file_path, p_file_type, p_file_size
  );

  return query select true, null::text, v_ref;
end;
$$;

revoke all on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_reservation(
  text, text, text, text, integer, text, text, text, text, text, text, text
) to service_role;

revoke all on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.register_payment_proof(
  text, uuid, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text, text, integer
) to service_role;

commit;
```

- [ ] **Step 2: Escribir las pruebas de la base**

`supabase/tests/talleres.sql`:

```sql
-- Pruebas de las reglas de `talleres`. Ejecutar SOLO en un proyecto de prueba
-- que ya tenga `schema.sql` y la migración 20261013_01 aplicados. Todo corre
-- dentro de una transacción que se deshace al final: no deja datos.
-- Cada comprobación imprime "OK ..." o aborta con "FALLO ...".

begin;

insert into public.talleres
  (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
values
  ('prueba-a', 'A', 'A', 'publicado', '2030-01-10', '2030-01-12', 'x', 'S', 'C', 'P', 1);

do $$
declare
  v_reason text;
begin
  -- 1. Dos activos solapados: rechazado.
  begin
    insert into public.talleres
      (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
    values ('prueba-b', 'B', 'B', 'cerrado', '2030-01-12', '2030-01-13', 'x', 'S', 'C', 'P', 10);
    raise exception 'FALLO: se permitió solapar dos talleres activos';
  exception when exclusion_violation then
    raise notice 'OK solapamiento rechazado';
  end;

  -- 2. Un borrador sí puede solapar.
  insert into public.talleres
    (slug, nombre, titulo, estado, fecha_inicio, fecha_fin, fechas_texto, sede_nombre, ciudad, pais, cupos_total)
  values ('prueba-c', 'C', 'C', 'borrador', '2030-01-11', '2030-01-11', 'x', 'S', 'C', 'P', 10);
  raise notice 'OK borrador puede solapar';

  -- 3. Publicar ese borrador sí choca.
  begin
    update public.talleres set estado = 'publicado' where slug = 'prueba-c';
    raise exception 'FALLO: se permitió publicar un taller solapado';
  exception when exclusion_violation then
    raise notice 'OK publicar solapado rechazado';
  end;

  -- 4. Porcentajes sin 100: rechazado.
  begin
    update public.talleres set porcentajes_pago = '{50}' where slug = 'prueba-a';
    raise exception 'FALLO: porcentajes sin 100 aceptados';
  exception when check_violation then
    raise notice 'OK porcentajes sin 100 rechazados';
  end;

  -- 5. Fin antes que inicio: rechazado.
  begin
    update public.talleres set fecha_fin = '2030-01-01' where slug = 'prueba-a';
    raise exception 'FALLO: fecha_fin anterior aceptada';
  exception when check_violation then
    raise notice 'OK orden de fechas';
  end;

  -- 6. Reserva en publicado con cupo: ok; la segunda: sold_out.
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0001', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is not null then raise exception 'FALLO: reserva rechazada (%)', v_reason; end if;

  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0002', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'sold_out' then raise exception 'FALLO: esperaba sold_out, llegó %', v_reason; end if;
  raise notice 'OK cupo respetado';

  -- 7. Taller cerrado: closed.
  update public.talleres set estado = 'cerrado', cupos_total = 10 where slug = 'prueba-a';
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0003', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'closed' then raise exception 'FALLO: esperaba closed, llegó %', v_reason; end if;
  raise notice 'OK cerrado no acepta reservas';

  -- 8. Publicado pero con fecha pasada: closed.
  update public.talleres
     set estado = 'publicado', fecha_inicio = '2020-01-01', fecha_fin = '2020-01-02'
   where slug = 'prueba-a';
  select reason into v_reason from public.create_reservation(
    'prueba-a', 'STA-TEST0004', 'general', 'Cupo General', null, null,
    'Prueba', 'p@example.com', '3000000000', 'C', 'P', '');
  if v_reason is distinct from 'closed' then raise exception 'FALLO: esperaba closed por fecha, llegó %', v_reason; end if;
  raise notice 'OK publicado vencido no acepta reservas';

  -- 9. Disponibilidad nunca negativa con cupos por debajo de lo ocupado.
  update public.talleres set cupos_total = 0 where slug = 'prueba-a';
  if (select libres from public.talleres_disponibilidad where slug = 'prueba-a') <> 0 then
    raise exception 'FALLO: libres negativo';
  end if;
  raise notice 'OK libres no baja de 0';
end
$$;

rollback;
```

- [ ] **Step 3: Nota en `schema.sql`**

En `supabase/schema.sql`, justo después de la línea `-- Es idempotente: se puede volver a ejecutar sin romper nada.` añade:

```sql
--
-- Después de este archivo se aplican, en orden, los de `supabase/migrations/`.
-- Este archivo describe el esquema inicial; las migraciones lo transforman
-- (p. ej. `taller_editions` pasa a llamarse `talleres`).
```

- [ ] **Step 4: Revisar la sintaxis sin tocar producción**

Si hay Postgres local (`which psql` y `docker`), levanta uno desechable y ejecuta `schema.sql` (con un esquema `storage` mínimo que imita el de Supabase), la migración dos veces y `supabase/tests/talleres.sql`:

```bash
docker run --rm -d --name pg-sta -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
sleep 4
export PGPASSWORD=x PGHOST=localhost PGPORT=55432 PGUSER=postgres
psql -c "create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);"
psql -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261013_01_talleres.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261013_01_talleres.sql   # idempotencia
psql -v ON_ERROR_STOP=1 -f supabase/tests/talleres.sql
psql -c "select slug, estado, titulo, titulo_acento, fecha_inicio, fecha_fin from public.talleres"
docker stop pg-sta
```

Expected: las dos ejecuciones de la migración terminan con `COMMIT`; las pruebas imprimen 9 líneas `NOTICE: OK ...`; la fila `taller-2026-10` sale `finalizado`, `Anestesia Regional Ecoguiada`, `+ Sedación TCI`, `2026-10-24`, `2026-10-25`.

Si no hay Docker, salta este paso y deja constancia en el informe: el usuario hará la prueba en el paso 6.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261013_01_talleres.sql supabase/tests/talleres.sql supabase/schema.sql
git commit -m "feat(db): talleres con estado, fechas y restricción de solapamiento"
```

- [ ] **Step 6: PUERTA MANUAL — el usuario aplica la migración**

Detente y pide al usuario, textualmente:

> Ejecuta `supabase/migrations/20261013_01_talleres.sql` en Supabase → SQL Editor (recomendado: haz antes un backup en Database → Backups). Después corre `select slug, estado, fecha_inicio, fecha_fin from public.talleres;` y dime el resultado. Hasta entonces el código nuevo no puede probarse contra la base.

Las tareas 4 y 5 pueden avanzarse mientras tanto; la verificación en vivo de las tareas 6 a 9 necesita la migración aplicada.

---

### Task 4: Contenido por defecto y `TallerVista`

**Files:**
- Modify: `src/lib/taller.ts`
- Create: `src/lib/talleres/vista.ts`
- Test: `src/lib/talleres/__tests__/vista.test.ts`

**Interfaces:**
- Consumes: `Taller`, `TallerEstado`, `Disponibilidad`, `Visibilidad` (Task 1); `visibilidad`, `escasez`, `fechasCortas` (Task 1).
- Produces (`src/lib/taller.ts`): `contenidoTaller` (heroPhoto, instructor —con `signature`—, gallery, contact, modules, highlights, payment, faq), `type ContenidoTaller = typeof contenidoTaller`, `formatPrice(amount: number, currency: string)`, `tallerWaLink(text: string)`. El export antiguo `taller` y `defaultTier` se conservan **temporalmente** (se borran en Task 9).
- Produces (`vista.ts`):

```ts
export type TierVista = { id: string; name: string; desc: string; amount: number; featured: boolean };
export type TallerVista = {
  slug: string;
  estado: TallerEstado; // estado efectivo
  title: string;
  titleAccent: string;
  kind: string;
  heroPhoto: { src: string; alt: string };
  instructor: ContenidoTaller["instructor"];
  venue: { name: string; city: string; region: string; country: string };
  dates: { label: string; short: string; startIso: string; endIso: string };
  endorsement: string;
  seats: Disponibilidad | null;
  scarcity: { value: string; label: string };
  soldOut: boolean;
  mostrar: Visibilidad;
  pricing: { published: boolean; currency: string; tiers: TierVista[] };
  porcentajesPago: number[];
  modules: readonly ContenidoTaller["modules"][number][];
  highlights: readonly string[];
  faq: readonly ContenidoTaller["faq"][number][];
  gallery: readonly ContenidoTaller["gallery"][number][];
  contact: ContenidoTaller["contact"];
  payment: ContenidoTaller["payment"];
};
export function construirTallerVista(taller: Taller, estado: TallerEstado, disp: Disponibilidad | null, base?: ContenidoTaller): TallerVista;
export function tarifaPorDefecto(v: TallerVista): TierVista;
export function nombreCurso(v: Pick<TallerVista, "title" | "titleAccent">): string; // "Taller de A + B"
```

- [ ] **Step 1: Separar el contenido por defecto en `src/lib/taller.ts`**

Cambia el comentario de cabecera y añade `contenidoTaller` al final del archivo (antes de `export type TallerTier`), sin borrar todavía el objeto `taller`:

```ts
/**
 * Contenido por defecto de la página del taller: lo que no cambia entre
 * ediciones (instructor, módulos, galería, FAQ, contactos).
 *
 * Lo operativo —título, fechas, sede, cupos, precios, estado— vive en la
 * tabla `talleres` y se edita desde /admin. Si un taller trae su propio
 * `contenido` en la base, este queda como respaldo.
 */
```

```ts
/** Lo que comparten todas las ediciones. Ver comentario de cabecera. */
export const contenidoTaller = {
  heroPhoto: taller.heroPhoto,
  instructor: taller.instructor,
  gallery: taller.gallery,
  contact: taller.contact,
  modules: taller.modules,
  highlights: taller.highlights,
  payment: taller.payment,
  faq: taller.faq,
} as const;

export type ContenidoTaller = typeof contenidoTaller;
```

Y cambia `formatPrice` para que la moneda sea obligatoria (ya no hay moneda global):

```ts
/** Formatea un importe para mostrarlo en pantalla. */
export function formatPrice(amount: number, currency: string) {
```

Run: `npx tsc --noEmit`
Expected: sin errores (nadie llama a `formatPrice` sin moneda; si aparece alguno, pásale `taller.pricing.currency`).

- [ ] **Step 2: Escribir las pruebas de la vista (fallan)**

`src/lib/talleres/__tests__/vista.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contenidoTaller } from "@/lib/taller";
import { construirTallerVista, nombreCurso, tarifaPorDefecto } from "../vista";
import { tallerDePrueba } from "./fabrica";

const disp = { total: 20, ocupados: 8, libres: 12 };

describe("construirTallerVista", () => {
  it("toma lo operativo de la base", () => {
    const v = construirTallerVista(tallerDePrueba(), "publicado", disp);
    expect(v.slug).toBe("taller-2026-10");
    expect(v.title).toBe("Anestesia Regional Ecoguiada");
    expect(v.titleAccent).toBe("+ Sedación TCI");
    expect(v.venue).toEqual({ name: "Policlínico San Francisco", city: "Maracaibo", region: "Zulia", country: "Venezuela" });
    expect(v.dates).toEqual({
      label: "Octubre 24 y 25, 2026",
      short: "24–25 OCT 2026",
      startIso: "2026-10-24",
      endIso: "2026-10-25",
    });
    expect(v.scarcity).toEqual({ value: "40%", label: "de cupos vendidos" });
    expect(v.soldOut).toBe(false);
    expect(v.mostrar.pago).toBe(true);
  });

  it("usa el estado efectivo, no el guardado", () => {
    const v = construirTallerVista(tallerDePrueba({ estado: "publicado" }), "finalizado", disp);
    expect(v.estado).toBe("finalizado");
    expect(v.mostrar.reserva).toBe(false);
    expect(v.soldOut).toBe(true);
  });

  it("sin foto propia usa la del contenido por defecto", () => {
    const v = construirTallerVista(tallerDePrueba({ fotoPrincipal: null }), "publicado", disp);
    expect(v.heroPhoto).toEqual(contenidoTaller.heroPhoto);
  });

  it("con foto propia usa la de la base", () => {
    const v = construirTallerVista(
      tallerDePrueba({ fotoPrincipal: "/assets/x.webp", fotoPrincipalAlt: "X" }),
      "publicado",
      disp,
    );
    expect(v.heroPhoto).toEqual({ src: "/assets/x.webp", alt: "X" });
  });

  it("el contenido propio del taller reemplaza solo las listas que trae", () => {
    const modules = [{ n: "01", title: "Otro", desc: "Distinto" }];
    const v = construirTallerVista(tallerDePrueba({ contenido: { modules, faq: "no-es-lista" } }), "publicado", disp);
    expect(v.modules).toEqual(modules);
    expect(v.faq).toEqual(contenidoTaller.faq);
  });

  it("aval vacío se muestra como cadena vacía", () => {
    expect(construirTallerVista(tallerDePrueba({ aval: null }), "publicado", disp).endorsement).toBe("");
  });

  it("tarifas pasan a la forma de la página", () => {
    const v = construirTallerVista(tallerDePrueba(), "publicado", disp);
    expect(v.pricing).toEqual({
      published: false,
      currency: "COP",
      tiers: [{ id: "general", name: "Cupo General", desc: "", amount: 0, featured: true }],
    });
  });
});

describe("tarifaPorDefecto", () => {
  it("la destacada", () => {
    const v = construirTallerVista(
      tallerDePrueba({
        tarifas: [
          { id: "a", nombre: "A", descripcion: "", precio: 1, destacada: false },
          { id: "b", nombre: "B", descripcion: "", precio: 2, destacada: true },
        ],
      }),
      "publicado",
      disp,
    );
    expect(tarifaPorDefecto(v).id).toBe("b");
  });

  it("sin tarifas, una general a 0", () => {
    const v = construirTallerVista(tallerDePrueba({ tarifas: [] }), "publicado", disp);
    expect(tarifaPorDefecto(v)).toEqual({ id: "general", name: "Cupo General", desc: "", amount: 0, featured: true });
  });
});

describe("nombreCurso", () => {
  it("con y sin acento", () => {
    expect(nombreCurso({ title: "A", titleAccent: "+ B" })).toBe("Taller de A + B");
    expect(nombreCurso({ title: "A", titleAccent: "" })).toBe("Taller de A");
  });
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

Run: `npm test`
Expected: FAIL — no se resuelve `../vista`.

- [ ] **Step 4: Implementar `vista.ts`**

```ts
import { contenidoTaller, type ContenidoTaller } from "@/lib/taller";
import { escasez, fechasCortas, visibilidad } from "./reglas";
import type { Disponibilidad, Taller, TallerEstado, Visibilidad } from "./tipos";

/**
 * Lo que necesita la página `/taller`. Tiene la misma forma que el antiguo
 * objeto `taller` de `src/lib/taller.ts` a propósito: los componentes cambian
 * de dónde lo leen, no cómo.
 */
export type TierVista = { id: string; name: string; desc: string; amount: number; featured: boolean };

export type TallerVista = {
  slug: string;
  /** Estado efectivo: un publicado vencido llega como `finalizado`. */
  estado: TallerEstado;
  title: string;
  titleAccent: string;
  kind: string;
  heroPhoto: { src: string; alt: string };
  instructor: ContenidoTaller["instructor"];
  venue: { name: string; city: string; region: string; country: string };
  dates: { label: string; short: string; startIso: string; endIso: string };
  endorsement: string;
  seats: Disponibilidad | null;
  scarcity: { value: string; label: string };
  /** `true` cuando no se puede reservar (lleno, cerrado o finalizado). */
  soldOut: boolean;
  mostrar: Visibilidad;
  pricing: { published: boolean; currency: string; tiers: TierVista[] };
  porcentajesPago: number[];
  modules: readonly ContenidoTaller["modules"][number][];
  highlights: readonly string[];
  faq: readonly ContenidoTaller["faq"][number][];
  gallery: readonly ContenidoTaller["gallery"][number][];
  contact: ContenidoTaller["contact"];
  payment: ContenidoTaller["payment"];
};

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function construirTallerVista(
  taller: Taller,
  estado: TallerEstado,
  disp: Disponibilidad | null,
  base: ContenidoTaller = contenidoTaller,
): TallerVista {
  // `contenido` es el hueco para la opción B: solo se usa una lista si la trae
  // como lista, para que un JSON a medio escribir no rompa la página.
  const extra = esObjeto(taller.contenido) ? taller.contenido : {};
  function lista<T>(clave: string, defecto: readonly T[]): readonly T[] {
    const v = extra[clave];
    return Array.isArray(v) ? (v as T[]) : defecto;
  }

  const mostrar = visibilidad(estado, disp);

  return {
    slug: taller.slug,
    estado,
    title: taller.titulo,
    titleAccent: taller.tituloAcento ?? "",
    kind: taller.modalidad,
    heroPhoto: taller.fotoPrincipal
      ? { src: taller.fotoPrincipal, alt: taller.fotoPrincipalAlt ?? taller.titulo }
      : base.heroPhoto,
    instructor: base.instructor,
    venue: {
      name: taller.sedeNombre,
      city: taller.ciudad,
      region: taller.region ?? "",
      country: taller.pais,
    },
    dates: {
      label: taller.fechasTexto,
      short: fechasCortas(taller.fechaInicio, taller.fechaFin),
      startIso: taller.fechaInicio,
      endIso: taller.fechaFin,
    },
    endorsement: taller.aval ?? "",
    seats: disp,
    scarcity: escasez(estado, disp),
    soldOut: !mostrar.reserva,
    mostrar,
    pricing: {
      published: taller.preciosPublicados,
      currency: taller.moneda,
      tiers: taller.tarifas.map((t) => ({
        id: t.id,
        name: t.nombre,
        desc: t.descripcion,
        amount: t.precio,
        featured: t.destacada,
      })),
    },
    porcentajesPago: taller.porcentajesPago,
    modules: lista("modules", base.modules),
    highlights: lista("highlights", base.highlights),
    faq: lista("faq", base.faq),
    gallery: lista("gallery", base.gallery),
    contact: base.contact,
    payment: base.payment,
  };
}

/** Tarifa con la que entra toda reserva web (el formulario no la pregunta). */
export function tarifaPorDefecto(v: TallerVista): TierVista {
  return (
    v.pricing.tiers.find((t) => t.featured) ??
    v.pricing.tiers[0] ?? { id: "general", name: "Cupo General", desc: "", amount: 0, featured: true }
  );
}

export function nombreCurso(v: Pick<TallerVista, "title" | "titleAccent">) {
  return `Taller de ${[v.title, v.titleAccent].filter(Boolean).join(" ")}`;
}
```

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `npm test && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/taller.ts src/lib/talleres
git commit -m "feat(talleres): vista pública del taller y contenido por defecto"
```

---

### Task 5: Capa de datos (`repo.ts`, `publico.ts`)

**Files:**
- Create: `src/lib/talleres/repo.ts`, `src/lib/talleres/publico.ts`

**Interfaces:**
- Consumes: `getSupabase()` (`src/lib/reservations/supabase.ts`); `FilaTaller`, `COLUMNAS_TALLER`, `filaATaller`, `tallerAFila` (Task 2); `motivoDesdeError`, `MotivoError` (Task 2); `elegirTallerActivo`, `hoyISO` (Task 1); `construirTallerVista`, `TallerVista` (Task 4); tablas/vistas de Task 3.
- Produces (`repo.ts`):

```ts
export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoError };
export async function listarTalleres(): Promise<Taller[] | null>;            // todos, fecha_inicio desc
export async function listarTalleresVisibles(): Promise<Taller[] | null>;    // publicado|cerrado|finalizado
export async function obtenerTaller(id: string): Promise<Resultado<Taller>>;
export async function obtenerDisponibilidad(slug: string): Promise<Disponibilidad | null>;
export async function listarDisponibilidades(): Promise<Map<string, Disponibilidad>>; // por slug
export async function contarInscripciones(slug: string): Promise<number | null>; // incluye canceladas
export async function crearTaller(input: TallerInput): Promise<Resultado<string>>; // id nuevo, estado borrador
export async function actualizarTaller(id: string, input: TallerInput): Promise<Resultado<null>>; // no cambia slug
export async function cambiarEstadoTaller(id: string, estado: TallerEstado): Promise<Resultado<null>>;
export async function duplicarTaller(id: string): Promise<Resultado<string>>; // id de la copia (borrador)
export async function eliminarTaller(id: string): Promise<Resultado<null>>;
```

- Produces (`publico.ts`):

```ts
export type TallerPublico =
  | { kind: "ok"; vista: TallerVista }
  | { kind: "ninguno" }
  | { kind: "sin_conexion" };
export const cargarTallerPublico: () => Promise<TallerPublico>; // React cache(): una consulta por petición
export async function slugParaAdmin(param: string | undefined): Promise<string | null>;
```

- [ ] **Step 1: Implementar `repo.ts`**

```ts
import { getSupabase } from "@/lib/reservations/supabase";
import { motivoDesdeError, type MotivoError } from "./errores";
import { COLUMNAS_TALLER, filaATaller, tallerAFila, type FilaTaller } from "./mapeo";
import type { Disponibilidad, Taller, TallerEstado, TallerInput } from "./tipos";

/**
 * Único módulo que lee y escribe `public.talleres`. Solo servidor: usa la
 * clave `service_role`. Las reglas (solapamiento, porcentajes, fechas) las
 * hace cumplir la base; aquí solo se traducen sus errores.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoError };

const fallo = (motivo: MotivoError) => ({ ok: false, motivo }) as const;

type FilaDisponibilidad = { slug: string; total: number; ocupados: number; libres: number };

function aDisponibilidad(f: FilaDisponibilidad): Disponibilidad {
  return { total: f.total, ocupados: f.ocupados, libres: f.libres };
}

export async function listarTalleres(): Promise<Taller[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .order("fecha_inicio", { ascending: false });
  if (error) {
    console.error("[talleres] no se pudo listar", error);
    return null;
  }
  return (data as FilaTaller[]).map(filaATaller);
}

export async function listarTalleresVisibles(): Promise<Taller[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .in("estado", ["publicado", "cerrado", "finalizado"]);
  if (error) {
    console.error("[talleres] no se pudieron leer los talleres visibles", error);
    return null;
  }
  return (data as FilaTaller[]).map(filaATaller);
}

export async function obtenerTaller(id: string): Promise<Resultado<Taller>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .eq("id", id)
    .maybeSingle<FilaTaller>();
  if (error) {
    // Un id que no es uuid llega como error 22P02: para el admin es "no existe".
    if (error.code === "22P02") return fallo("no_encontrado");
    console.error("[talleres] no se pudo leer", { id, error });
    return fallo("error");
  }
  return data ? { ok: true, valor: filaATaller(data) } : fallo("no_encontrado");
}

export async function obtenerDisponibilidad(slug: string): Promise<Disponibilidad | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres_disponibilidad")
    .select("slug, total, ocupados, libres")
    .eq("slug", slug)
    .maybeSingle<FilaDisponibilidad>();
  if (error || !data) {
    if (error) console.error("[talleres] no se pudo leer la disponibilidad", error);
    return null;
  }
  return aDisponibilidad(data);
}

export async function listarDisponibilidades(): Promise<Map<string, Disponibilidad>> {
  const mapa = new Map<string, Disponibilidad>();
  const supabase = getSupabase();
  if (!supabase) return mapa;
  const { data, error } = await supabase
    .from("talleres_disponibilidad")
    .select("slug, total, ocupados, libres");
  if (error) {
    console.error("[talleres] no se pudo listar la disponibilidad", error);
    return mapa;
  }
  for (const f of data as FilaDisponibilidad[]) mapa.set(f.slug, aDisponibilidad(f));
  return mapa;
}

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

export async function crearTaller(input: TallerInput): Promise<Resultado<string>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("talleres")
    .insert({ ...tallerAFila(input), estado: "borrador" })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error) console.error("[talleres] no se pudo crear", error);
    return fallo(motivoDesdeError(error));
  }
  return { ok: true, valor: data.id };
}

export async function actualizarTaller(id: string, input: TallerInput): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  // El slug no se cambia: es la clave con la que las reservas apuntan al taller.
  const { slug, ...fila } = tallerAFila(input);
  void slug;
  const { data, error } = await supabase.from("talleres").update(fila).eq("id", id).select("id");
  if (error) {
    console.error("[talleres] no se pudo actualizar", { id, error });
    return fallo(motivoDesdeError(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

export async function cambiarEstadoTaller(id: string, estado: TallerEstado): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("talleres").update({ estado }).eq("id", id).select("id");
  if (error) {
    console.error("[talleres] no se pudo cambiar el estado", { id, estado, error });
    return fallo(motivoDesdeError(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

/** Copia todo menos estado (queda en borrador) y slug; las fechas se ajustan al editar. */
export async function duplicarTaller(id: string): Promise<Resultado<string>> {
  const original = await obtenerTaller(id);
  if (!original.ok) return original;
  const { id: _id, nombre, estado, contenido, creadoEn, ...input } = original.valor;
  void _id; void nombre; void estado; void creadoEn;
  const sufijo = crypto.randomUUID().slice(0, 4);
  const creado = await crearTaller({ ...input, slug: `${input.slug}-copia-${sufijo}` });
  if (!creado.ok || contenido == null) return creado;

  const supabase = getSupabase();
  await supabase?.from("talleres").update({ contenido }).eq("id", creado.valor);
  return creado;
}

export async function eliminarTaller(id: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const taller = await obtenerTaller(id);
  if (!taller.ok) return taller;

  const reservas = await contarInscripciones(taller.valor.slug);
  if (reservas === null) return fallo("error");
  if (reservas > 0) return fallo("tiene_inscripciones");

  const { error } = await supabase.from("talleres").delete().eq("id", id);
  if (error) {
    console.error("[talleres] no se pudo eliminar", { id, error });
    return fallo(motivoDesdeError(error));
  }
  return { ok: true, valor: null };
}
```

- [ ] **Step 2: Implementar `publico.ts`**

```ts
import { cache } from "react";
import { elegirTallerActivo, hoyISO } from "./reglas";
import { listarTalleresVisibles, obtenerDisponibilidad } from "./repo";
import { construirTallerVista, type TallerVista } from "./vista";

export type TallerPublico =
  | { kind: "ok"; vista: TallerVista }
  | { kind: "ninguno" }
  | { kind: "sin_conexion" };

/**
 * Taller que muestra `/taller`, ya armado para la página.
 *
 * `cache` de React lo deduplica dentro de una misma petición: la página y
 * `generateMetadata` lo piden los dos y solo se consulta la base una vez.
 */
export const cargarTallerPublico = cache(async (): Promise<TallerPublico> => {
  const talleres = await listarTalleresVisibles();
  if (talleres === null) return { kind: "sin_conexion" };

  const activo = elegirTallerActivo(talleres, hoyISO());
  if (!activo) return { kind: "ninguno" };

  const disp = await obtenerDisponibilidad(activo.taller.slug);
  return { kind: "ok", vista: construirTallerVista(activo.taller, activo.estadoEfectivo, disp) };
});

/** Taller con el que abre una pantalla del admin: el de la URL o el activo. */
export async function slugParaAdmin(param: string | undefined): Promise<string | null> {
  if (param) return param;
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista.slug : null;
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; tests en verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/talleres/repo.ts src/lib/talleres/publico.ts
git commit -m "feat(talleres): acceso a la base y taller público"
```

---

### Task 6: Página `/taller` dinámica

**Files:**
- Create: `src/lib/talleres/contexto.tsx`, `src/components/taller/proxima-edicion.tsx`
- Modify: `src/app/taller/page.tsx`, `src/app/taller/actions.ts`, `src/components/taller/{hero,nav,sections,reserva-form,pago-form,footer}.tsx`, `src/lib/reservations/index.ts`, `src/lib/reservations/payment-proofs.ts`, `src/lib/payments/types.ts`, `src/lib/payments/manual.ts`

**Interfaces:**
- Consumes: `cargarTallerPublico`, `TallerPublico` (Task 5); `TallerVista`, `tarifaPorDefecto`, `nombreCurso` (Task 4); `contenidoTaller`, `tallerWaLink` (Task 4).
- Produces: `TallerProvider({ value: TallerVista, children })`, `useTaller(): TallerVista`; `saveReservation(edition: string, order: OrderDraft)`; `PaymentProofDraft.edition: string`; `OrderDraft.courseName: string`; `TallerFooter({ taller }: { taller: TallerVista })`; `ProximaEdicion()`. Se elimina `getSeats`.

- [ ] **Step 1: Contexto del taller**

`src/lib/talleres/contexto.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TallerVista } from "./vista";

/**
 * Reparte el taller activo a los componentes cliente de `/taller`. La página
 * (servidor) lo lee de la base una vez y lo pasa aquí; así ningún componente
 * importa datos operativos fijos del código.
 */
const TallerContext = createContext<TallerVista | null>(null);

export function TallerProvider({ value, children }: { value: TallerVista; children: ReactNode }) {
  return <TallerContext value={value}>{children}</TallerContext>;
}

export function useTaller(): TallerVista {
  const taller = useContext(TallerContext);
  if (!taller) throw new Error("useTaller() se usó fuera de <TallerProvider>.");
  return taller;
}
```

- [ ] **Step 2: Adaptar las librerías de reserva y pago**

`src/lib/payments/types.ts` — en `OrderDraft`, añade tras `reference: string;`:

```ts
  /** "Taller de …", para los mensajes de WhatsApp. */
  courseName: string;
```

`src/lib/payments/manual.ts` — cambia la primera línea del mensaje y el import:

```ts
import { tallerWaLink } from "@/lib/taller";
```

```ts
      `Hola, quiero reservar mi cupo en el ${order.courseName}.`,
```

`src/lib/reservations/index.ts`:
- Borra `import { taller } from "@/lib/taller";`, el tipo `AvailabilityRow` y la función `getSeats` completa (con su comentario).
- `toSeats` pasa a recibir la fila de `create_reservation` directamente:

```ts
function toSeats(row: CreateReservationRow): Seats {
  return {
    total: row.seats_total,
    taken: row.seats_taken,
    remaining: row.seats_remaining,
    isOpen: row.reason !== "closed",
  };
}
```

- Firma y uso de la edición:

```ts
export async function saveReservation(edition: string, order: OrderDraft): Promise<SaveResult> {
```

```ts
    p_edition: edition,
```

- Sustituye el bloque `const seats = toSeats({ ... });` por `const seats = toSeats(row);`.

`src/lib/reservations/payment-proofs.ts`:
- Borra `import { taller } from "@/lib/taller";`.
- En `PaymentProofDraft`, añade como primer campo:

```ts
  /** Slug del taller al que se registra el pago. */
  edition: string;
```

- Sustituye las dos apariciones de `taller.edition` por `draft.edition`.

- [ ] **Step 3: Server actions de `/taller`**

En `src/app/taller/actions.ts`:

Imports — sustituye `import { defaultTier, taller, tallerWaLink } from "@/lib/taller";` por:

```ts
import { tallerWaLink } from "@/lib/taller";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, tarifaPorDefecto, type TallerVista } from "@/lib/talleres/vista";
```

Sustituye `currentPrice` por:

```ts
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
async function tallerActivo(): Promise<TallerVista | null> {
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista : null;
}

function waitlistMessage(t: TallerVista, customer: { name: string; email: string; city: string; profession: string }) {
  return tallerWaLink(
    [
      `Hola, quiero entrar en la lista de espera del ${nombreCurso(t)}.`,
      "",
      `Nombre: ${customer.name}`,
      `Email: ${customer.email}`,
      `Ciudad: ${customer.city}`,
      `Profesión: ${customer.profession}`,
    ].join("\n"),
  );
}
```

En `createReservation`, sustituye desde `// Edición cerrada a mano en el catálogo.` hasta el final del bloque `if (saved.kind === "sold_out" || saved.kind === "closed") { ... }` por:

```ts
  const t = await tallerActivo();
  if (!t) {
    return {
      status: "error",
      errors: {},
      message: "Ahora mismo no hay un taller con inscripciones abiertas. Escríbenos por WhatsApp.",
    };
  }

  // La página puede estar cacheada: se vuelve a comprobar aquí porque un
  // server action es un endpoint público.
  if (!t.mostrar.reserva) {
    return {
      status: "sold_out",
      message:
        t.estado === "publicado"
          ? "Los cupos de esta edición se agotaron."
          : "Se vendieron todos los cupos de esta edición.",
      handoffUrl: waitlistMessage(t, customer),
    };
  }

  const tier = tarifaPorDefecto(t);
  const order: OrderDraft = {
    reference: newReference(),
    courseName: nombreCurso(t),
    tierId: tier.id,
    tierName: tier.name,
    // El precio sale del taller en la base, nunca del formulario.
    price: currentPrice(t),
    customer,
    notes,
  };

  // Guardar es también reclamar el cupo: la base rechaza si se llenó o se cerró.
  const saved = await saveReservation(t.slug, order);

  if (saved.kind === "sold_out" || saved.kind === "closed") {
    return {
      status: "sold_out",
      message:
        saved.kind === "closed"
          ? "Las reservas de esta edición están cerradas."
          : "Los cupos de esta edición se agotaron mientras completabas el formulario.",
      handoffUrl: waitlistMessage(t, customer),
    };
  }
```

En `registerPayment`, justo después de `if (Object.keys(errors).length > 0 || !kind || !file) { return { status: "error", errors }; }` añade:

```ts
  const t = await tallerActivo();
  if (!t || !t.mostrar.pago) {
    return {
      status: "error",
      errors: {},
      message:
        "El registro de pagos de esta edición está cerrado. Envíanos tu comprobante por WhatsApp y lo resolvemos.",
      handoffUrl: tallerWaLink(
        `Hola, quiero registrar un pago. Nombre: ${customer.name}. Documento: ${document}.`,
      ),
    };
  }
  const tier = tarifaPorDefecto(t);
```

Dentro de `handoff`, sustituye `` `Hola, registré mi ${KIND_LABEL[kind]} del Taller de ${taller.title} ${taller.titleAccent}.` `` por `` `Hola, registré mi ${KIND_LABEL[kind]} del ${nombreCurso(t)}.` ``.

En la llamada a `savePaymentProof`, añade `edition: t.slug,` como primer campo y cambia:

```ts
    tierId: tier.id,
    tierName: tier.name,
    price: currentPrice(t),
```

Run: `npx tsc --noEmit`
Expected: los únicos errores restantes están en `src/app/taller/page.tsx` (usa `getSeats`) y en los componentes; ninguno en `actions.ts` ni en `src/lib`.

- [ ] **Step 4: Componentes cliente leen del contexto**

En cada archivo, sustituye `import { taller } from "@/lib/taller";` (o `import { taller, tallerWaLink } ...`) por `import { useTaller } from "@/lib/talleres/contexto";` (conservando `tallerWaLink` desde `@/lib/taller` donde se use) y añade `const taller = useTaller();` como **primera línea** de cada componente exportado que use `taller`:

`src/components/taller/sections.tsx` — en `Contenido`, `Galeria`, `Instructor` y `Faq`. Import resultante:

```ts
import { tallerWaLink } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";
```

`src/components/taller/pago-form.tsx` — en `PagoForm` y `PagoSection`.

`src/components/taller/hero.tsx` — borra la constante de módulo `facts` y créala dentro de `TallerHero`, tras `const taller = useTaller();`:

```tsx
  const taller = useTaller();
  /** Datos que el flyer pone en grande: fecha, sede y aval. */
  const facts = [
    { k: "Fecha", v: taller.dates.label },
    { k: "Sede", v: `${taller.venue.name} · ${taller.venue.city}` },
    ...(taller.endorsement
      ? [{ k: "Aval", v: taller.endorsement.replace(/^Avalado por\s*/i, "") }]
      : []),
  ];
  // Sin reserva ni lista de espera (taller finalizado) no hay a dónde llevar el botón.
  const cta = taller.mostrar.reserva
    ? "Reservar mi cupo"
    : taller.mostrar.listaEspera
      ? "Entrar en lista de espera"
      : null;
```

Y envuelve el `<SmoothLink href="#reservar" ...>` del hero en `{cta && ( ... )}`, con `{cta}` como texto en lugar de `{taller.soldOut ? "Entrar en lista de espera" : "Reservar mi cupo"}`.

`src/components/taller/nav.tsx` — añade el import de `useTaller` y, al inicio de `TallerNav`:

```tsx
  const taller = useTaller();
  // "Registrar pago" solo existe en la página si el taller acepta pagos.
  const visibles = links.filter((l) => l.href !== "#registro-pago" || taller.mostrar.pago);
  const cta = taller.mostrar.reserva ? "Reservar cupo" : taller.mostrar.listaEspera ? "Lista de espera" : null;
```

Sustituye los dos `links.map(` por `visibles.map(`. Envuelve los dos `<SmoothLink href="#reservar" ...>Reservar cupo</SmoothLink>` en `{cta && ( ... )}` con `{cta}` como texto (en el menú móvil, envuelve el `<motion.div>` que lo contiene).

`src/components/taller/reserva-form.tsx`:
- Borra `import type { Seats } from "@/lib/reservations/types";`; cambia el import de `@/lib/taller` a `import { tallerWaLink } from "@/lib/taller";` y añade `import { useTaller } from "@/lib/talleres/contexto";` y `import { nombreCurso, type TallerVista } from "@/lib/talleres/vista";`.
- `waitlistLink` recibe el taller:

```ts
function waitlistLink(taller: TallerVista) {
  return tallerWaLink(`Hola, quiero entrar en la lista de espera del ${nombreCurso(taller)}.`);
}
```

- `export function ReservaForm() {` (sin props) y como primeras líneas:

```ts
  const taller = useTaller();
  const seats = taller.seats;
```

- `handoffUrl={waitlistLink()}` → `handoffUrl={waitlistLink(taller)}`.
- En el párrafo bajo el botón: `seats && seats.remaining <= LOW_SEATS` → `seats && seats.libres <= LOW_SEATS`, y las dos `seats.remaining` → `seats.libres`.
- `export function ReservaSection() {` (sin props) y:

```ts
  const taller = useTaller();
  const seats = taller.seats;
  // Con Supabase conectado el dato es real; sin él se cae al texto de escasez.
  const scarcity =
    !taller.soldOut && seats && seats.libres > 0 && seats.libres <= LOW_SEATS
      ? `Quedan ${seats.libres} de ${seats.total} cupos`
      : `${taller.scarcity.value} ${taller.scarcity.label}`;
```

- Dentro de `ReservaSection`, donde se renderiza `<ReservaForm seats={seats} />`, cámbialo a `<ReservaForm />`.

- [ ] **Step 5: Footer (servidor) y página sin taller**

`src/components/taller/footer.tsx`:

```ts
import { tallerWaLink } from "@/lib/taller";
import type { TallerVista } from "@/lib/talleres/vista";
```

```tsx
export function TallerFooter({ taller }: { taller: TallerVista }) {
```

`src/components/taller/proxima-edicion.tsx`:

```tsx
import Link from "next/link";
import { WhatsAppIcon } from "@/components/ui/icons";
import { contenidoTaller, tallerWaLink } from "@/lib/taller";

/** Lo que muestra `/taller` cuando no hay ningún taller publicado ni pasado. */
export function ProximaEdicion() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-navy px-5 py-16 text-center">
      <div className="max-w-[520px]">
        <p className="eyebrow mb-4 justify-center text-sky">Taller presencial</p>
        <h1 className="text-[clamp(30px,5vw,52px)] leading-[1.1] text-white">
          Próxima edición
          <span className="block text-sky">muy pronto.</span>
        </h1>
        <p className="mt-5 text-[15px] leading-[1.8] text-ice/80">
          Estamos preparando las fechas. Escríbenos y te avisamos en cuanto abramos
          inscripciones.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={tallerWaLink("Hola, quiero que me avisen de la próxima edición del taller.")}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2.5 rounded-full bg-azure px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-navy"
          >
            <WhatsAppIcon className="size-4" />
            Avisarme por WhatsApp
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/30 px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:border-white"
          >
            Volver al inicio
          </Link>
        </div>
        <p className="mt-10 text-[12.5px] text-ice/50">@{contenidoTaller.contact.instagram}</p>
      </div>
    </main>
  );
}
```

Comprueba que `WhatsAppIcon` acepta `className` (`grep -n "export function WhatsAppIcon" -A3 src/components/ui/icons.tsx`); si no, quita la prop.

- [ ] **Step 6: Reescribir `src/app/taller/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ScrollProgress } from "@/components/scroll-progress";
import { TallerFooter } from "@/components/taller/footer";
import { TallerHero } from "@/components/taller/hero";
import { TallerNav } from "@/components/taller/nav";
import { PagoSection } from "@/components/taller/pago-form";
import { ProximaEdicion } from "@/components/taller/proxima-edicion";
import { ReservaSection } from "@/components/taller/reserva-form";
import { Contenido, Faq, Galeria, Instructor } from "@/components/taller/sections";
import { TallerProvider } from "@/lib/talleres/contexto";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, type TallerVista } from "@/lib/talleres/vista";

/**
 * Estática con regeneración cada 5 minutos, como antes: el conteo en pantalla
 * es informativo y el cupo real se comprueba en la base al enviar. Los cambios
 * hechos desde /admin invalidan la página al instante (`revalidatePath`).
 */
export const revalidate = 300;

function descripcion(t: TallerVista) {
  return `${t.dates.label} · ${t.venue.name}, ${t.venue.city}. ${t.kind} con ${t.instructor.name}: anestesia regional ecoguiada, accesos vasculares y sedación TCI.${t.endorsement ? ` ${t.endorsement}.` : ""}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const publico = await cargarTallerPublico();
  if (publico.kind !== "ok") {
    return { title: "Taller · Próxima edición", robots: { index: true, follow: true } };
  }
  const t = publico.vista;
  const name = nombreCurso(t);
  const description = descripcion(t);
  return {
    title: `${name} · ${t.dates.label}`,
    description,
    keywords: [
      "taller anestesia regional",
      "anestesia regional ecoguiada",
      "sedación TCI",
      "bloqueos ecoguiados",
      "accesos vasculares ecoguiados",
      `curso anestesiología ${t.venue.city}`,
    ],
    openGraph: { title: name, description, type: "website", locale: "es_CO" },
    robots: { index: true, follow: true },
  };
}

/** Ficha de evento para que el taller pueda aparecer como tal en buscadores. */
function jsonLd(t: TallerVista) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationEvent",
    name: nombreCurso(t),
    description: descripcion(t),
    startDate: t.dates.startIso,
    endDate: t.dates.endIso,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: t.venue.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: t.venue.city,
        addressRegion: t.venue.region || undefined,
        addressCountry: t.venue.country,
      },
    },
    performer: { "@type": "Person", name: t.instructor.name },
    organizer: { "@type": "Organization", name: "STA", url: t.contact.instagramUrl },
  };
}

export default async function TallerPage() {
  const publico = await cargarTallerPublico();
  if (publico.kind !== "ok") return <ProximaEdicion />;

  const t = publico.vista;

  return (
    <TallerProvider value={t}>
      <ScrollProgress />
      <TallerNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(t)) }}
      />
      <main>
        <TallerHero />
        <Contenido />
        <Galeria />
        <Instructor />
        {(t.mostrar.reserva || t.mostrar.listaEspera) && <ReservaSection />}
        {t.mostrar.pago && <PagoSection />}
        <Faq />
      </main>
      <TallerFooter taller={t} />
    </TallerProvider>
  );
}
```

- [ ] **Step 7: Verificar compilación, lint y pruebas**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores. Si `tsc` señala usos restantes de `taller.` en `src/components/taller/`, aplícales el mismo cambio del Step 4.

- [ ] **Step 8: Verificación en vivo (requiere la migración aplicada, Task 3 Step 6)**

Run: `npm run dev` (puerto 3002) en segundo plano y luego:

```bash
curl -s http://localhost:3002/taller | grep -o "edición finalizada\|Registrar pago\|Reservar mi cupo\|Próxima edición" | sort | uniq -c
```

Expected con `taller-2026-10` en `finalizado`: aparece `edición finalizada`; NO aparecen `Reservar mi cupo` ni `Registrar pago`.

Prueba de "sin conexión": arranca otra instancia con `SUPABASE_URL= npm run dev -- -p 3003` y `curl -s http://localhost:3003/taller | grep -c "Próxima edición"` → `1` o más. Detén ambas.

- [ ] **Step 9: Commit**

```bash
git add src/app/taller src/components/taller src/lib/talleres/contexto.tsx src/lib/reservations src/lib/payments
git commit -m "feat(taller): la página lee el taller activo de la base"
```

---

### Task 7: Base del admin y certificados con datos del taller

**Files:**
- Create: `src/app/admin/actions.ts`, `src/app/admin/page.tsx`, `src/components/admin/ui.ts`, `src/components/admin/shell.tsx`, `src/components/admin/login-form.tsx`, `src/components/admin/login-screen.tsx`
- Delete: `src/app/admin/certificados/actions.ts`, `src/app/admin/certificados/login-form.tsx`
- Modify: `src/lib/admin-auth.ts`, `src/app/admin/certificados/page.tsx`, `src/app/admin/certificados/imprimir/page.tsx`, `src/lib/reservations/certificates.ts`, `src/components/certificado/sheet.tsx`, `src/app/certificado/[code]/page.tsx`

**Interfaces:**
- Consumes: `cargarTallerPublico`, `slugParaAdmin` (Task 5); `listarTalleres` (Task 5); `ESTADO_ETIQUETA` (Task 1); `contenidoTaller` (Task 4); vista `taller_certificates` ampliada (Task 3).
- Produces: `puertaAdmin(): Promise<boolean>` (404 si no hay contraseña; `false` si falta iniciar sesión); `login`, `logout` en `@/app/admin/actions`; `LoginForm`, `LoginScreen`; `AdminShell({ titulo, subtitulo?, acciones?, children })`; clases `inputClass`, `labelClass`, `errorClass`, `botonPrimario`, `botonSecundario`, `tarjeta` en `@/components/admin/ui`; `Certificate` con `venueCity`, `venueRegion`, `signatureName`, `signatureTitle`, `signatureDocument` (todos `string | null`).

- [ ] **Step 1: Puerta del admin**

En `src/lib/admin-auth.ts`, añade el import y la función al final:

```ts
import { notFound } from "next/navigation";
```

```ts
/**
 * Para páginas del admin: responde 404 si no hay contraseña configurada y
 * devuelve si hay sesión. Cada página decide qué pintar sin sesión (el login).
 */
export async function puertaAdmin(): Promise<boolean> {
  if (!adminConfigured()) notFound();
  return isAdmin();
}
```

- [ ] **Step 2: Mover login/logout**

`src/app/admin/actions.ts` (contenido de `src/app/admin/certificados/actions.ts`, revalidando todo el admin):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/lib/admin-auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const ok = typeof password === "string" && (await signIn(password));

  if (!ok) return { error: "Contraseña incorrecta." };

  revalidatePath("/admin", "layout");
  return {};
}

export async function logout() {
  await signOut();
  revalidatePath("/admin", "layout");
}
```

Run: `git mv src/app/admin/certificados/login-form.tsx src/components/admin/login-form.tsx && git rm src/app/admin/certificados/actions.ts`

En `src/components/admin/login-form.tsx`, cambia `import { login, type LoginState } from "./actions";` por `import { login, type LoginState } from "@/app/admin/actions";`.

`src/components/admin/login-screen.tsx`:

```tsx
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[28px] leading-tight text-navy">Administración</h1>
        <p className="mt-2 mb-7 text-[14px] leading-relaxed text-ink-soft">Zona privada del taller.</p>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Estilos compartidos y shell**

`src/components/admin/ui.ts`:

```ts
/** Clases compartidas del admin: mismo lenguaje visual que el login existente. */
export const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-[14.5px] text-navy outline-none transition-colors duration-200 focus:border-azure aria-[invalid=true]:border-red-500 read-only:bg-sand/40";
export const labelClass = "mb-1.5 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";
export const errorClass = "mt-1.5 text-[12.5px] text-red-600";
export const botonPrimario =
  "inline-flex cursor-pointer items-center justify-center rounded-full bg-navy px-6 py-3 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-azure disabled:cursor-wait disabled:opacity-60";
export const botonSecundario =
  "inline-flex cursor-pointer items-center justify-center rounded-full border border-navy/20 px-5 py-2.5 text-[13px] font-semibold text-navy transition-colors duration-200 hover:border-navy/50 disabled:cursor-wait disabled:opacity-60";
export const tarjeta = "rounded-2xl bg-white p-6";
```

`src/components/admin/shell.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/admin/actions";
import { botonSecundario } from "./ui";

const enlaces = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/talleres", label: "Talleres" },
  { href: "/admin/certificados", label: "Certificados" },
];

export function AdminShell({
  titulo,
  subtitulo,
  acciones,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[100svh] bg-cream px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[1000px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-navy/10 pb-5">
          <nav className="flex flex-wrap gap-5">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="text-[14px] font-semibold text-navy underline-offset-4 hover:text-azure hover:underline"
              >
                {e.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button type="submit" className={botonSecundario}>
              Salir
            </button>
          </form>
        </header>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-tight text-navy">{titulo}</h1>
            {subtitulo && <div className="mt-1.5 text-[14px] text-ink-soft">{subtitulo}</div>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Página de inicio del admin**

`src/app/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { botonPrimario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA, ESTADOS_TALLER } from "@/lib/talleres/tipos";
import { nombreCurso } from "@/lib/talleres/vista";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración · STA",
  robots: { index: false, follow: false },
};

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
            {publico.vista.seats && (
              <p className="mt-3 text-[14px] text-ink">
                Cupos: {publico.vista.seats.ocupados}/{publico.vista.seats.total} ocupados ·{" "}
                {publico.vista.seats.libres} libres
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[14px] text-ink">
            Ningún taller visible: la página muestra «Próxima edición pronto».
          </p>
        )}
      </section>

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

- [ ] **Step 5: Certificados con los datos del taller**

`src/lib/reservations/certificates.ts`:
- Al tipo `Certificate`, añade tras `endorsement`:

```ts
  venueCity: string | null;
  venueRegion: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
  signatureDocument: string | null;
```

- A `CertificateRow`, añade `venue_city`, `venue_region`, `signature_name`, `signature_title`, `signature_document` (todos `string | null`).
- `COLUMNS`:

```ts
const COLUMNS =
  "reference, name, email, profession, city, edition, course_title, dates_label, hours, endorsement, venue_city, venue_region, signature_name, signature_title, signature_document";
```

- En `toCertificate`, añade:

```ts
    venueCity: row.venue_city,
    venueRegion: row.venue_region,
    signatureName: row.signature_name,
    signatureTitle: row.signature_title,
    signatureDocument: row.signature_document,
```

- Cambia en el comentario del tipo `src/lib/taller.ts` por "la tabla `talleres`".

`src/components/certificado/sheet.tsx`:
- `import { taller } from "@/lib/taller";` → `import { contenidoTaller } from "@/lib/taller";`
- Sustituye `const { signature } = taller.instructor;` por:

```ts
  // La firma y la sede salen del taller en la base; el contenido por defecto
  // solo cubre talleres anteriores a que existieran esos campos.
  const fallback = contenidoTaller.instructor.signature;
  const signature = {
    name: certificate.signatureName ?? fallback.name,
    title: certificate.signatureTitle ?? fallback.title,
    document: certificate.signatureDocument ?? fallback.document,
  };
  const lugar = [certificate.venueCity, certificate.venueRegion].filter(Boolean).join(", ");
```

- Sustituye `{taller.venue.city}, {taller.venue.region}` por `{lugar}`.

`src/app/certificado/[code]/page.tsx`:
- `import { taller, tallerWaLink } from "@/lib/taller";` → `import { tallerWaLink } from "@/lib/taller";`
- En `Notice`, el texto del enlace pasa a `` tallerWaLink("Hola, tengo una duda con mi certificado del taller.") ``.

- [ ] **Step 6: Páginas de certificados del admin**

`src/app/admin/certificados/page.tsx`:
- Imports: quita `adminConfigured, isAdmin`, `taller`, `logout` y `LoginForm`; añade:

```ts
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { puertaAdmin } from "@/lib/admin-auth";
import { slugParaAdmin } from "@/lib/talleres/publico";
```

- La firma y el arranque:

```tsx
export default async function CertificadosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const slug = await slugParaAdmin((await searchParams).taller);
  if (!slug) {
    return (
      <AdminShell titulo="Certificados">
        <p className="rounded-2xl bg-white p-6 text-[14.5px] text-ink">
          No hay ningún taller visible. Elige uno desde Talleres.
        </p>
      </AdminShell>
    );
  }

  const certificates = await listCertificates(slug);
```

- Sustituye el `<main>…<div className="flex flex-wrap items-start justify-between gap-4">…</div>` de cabecera (título, edición y botón Salir) por `<AdminShell titulo="Certificados" subtitulo={<>Edición <span className="font-mono text-[13px]">{slug}</span></>}>` y cierra con `</AdminShell>` en lugar de `</div></main>`. El resto (avisos y lista) queda igual.
- El enlace de imprimir: `href={`/admin/certificados/imprimir?taller=${slug}`}`.

`src/app/admin/certificados/imprimir/page.tsx`:
- Imports: quita `adminConfigured, isAdmin` y `taller`; añade `import { puertaAdmin } from "@/lib/admin-auth";` y `import { slugParaAdmin } from "@/lib/talleres/publico";`.
- Arranque:

```tsx
export default async function ImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) notFound();

  const slug = await slugParaAdmin((await searchParams).taller);
  const certificates = slug ? await listCertificates(slug) : null;
```

- El enlace "Volver" de las dos ramas: `href={slug ? `/admin/certificados?taller=${slug}` : "/admin/certificados"}`.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores.

Con `CERTIFICADOS_PASSWORD` puesta en `.env.local` y `npm run dev`:
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/admin` → `200` (pantalla de login).
- Sin `CERTIFICADOS_PASSWORD`: `CERTIFICADOS_PASSWORD= npm run dev -- -p 3003` y el mismo curl a 3003 → `404`.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/admin src/components/admin src/lib/admin-auth.ts src/lib/reservations/certificates.ts src/components/certificado/sheet.tsx "src/app/certificado/[code]/page.tsx"
git commit -m "feat(admin): inicio, sesión común y certificados con datos del taller"
```

---

### Task 8: Admin de talleres

**Files:**
- Create: `src/app/admin/talleres/actions.ts`, `src/app/admin/talleres/page.tsx`, `src/app/admin/talleres/nuevo/page.tsx`, `src/app/admin/talleres/[id]/page.tsx`, `src/components/admin/taller-form.tsx`, `src/components/admin/taller-acciones.tsx`

**Interfaces:**
- Consumes: `isAdmin`, `puertaAdmin` (Task 7); `leerTallerForm` (Task 2); `MENSAJES_ERROR` (Task 2); `crearTaller`, `actualizarTaller`, `cambiarEstadoTaller`, `duplicarTaller`, `eliminarTaller`, `listarTalleres`, `listarDisponibilidades`, `obtenerTaller`, `contarInscripciones` (Task 5); `ESTADOS_TALLER`, `ESTADO_ETIQUETA`, `PORCENTAJES_PAGO`, `Taller` (Task 1); `AdminShell`, `LoginScreen`, clases de `ui.ts` (Task 7); `contenidoTaller` (Task 4).
- Produces (`actions.ts`): `AccionState = { status: "idle" } | { status: "error"; errores: Record<string, string>; message?: string } | { status: "ok"; message: string }`; `guardarTaller(prev, fd)`, `cambiarEstado(prev, fd)`, `duplicar(prev, fd)`, `eliminar(prev, fd)` — todas `(AccionState, FormData) => Promise<AccionState>`.

- [ ] **Step 1: Server actions**

`src/app/admin/talleres/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { MENSAJES_ERROR, type MotivoError } from "@/lib/talleres/errores";
import { leerTallerForm } from "@/lib/talleres/formulario";
import {
  actualizarTaller,
  cambiarEstadoTaller,
  crearTaller,
  duplicarTaller,
  eliminarTaller,
} from "@/lib/talleres/repo";
import { ESTADOS_TALLER, type TallerEstado } from "@/lib/talleres/tipos";

export type AccionState =
  | { status: "idle" }
  | { status: "error"; errores: Record<string, string>; message?: string }
  | { status: "ok"; message: string };

const SESION_VENCIDA: AccionState = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

function error(motivo: MotivoError): AccionState {
  return {
    status: "error",
    errores: motivo === "slug_duplicado" ? { slug: MENSAJES_ERROR.slug_duplicado } : {},
    message: MENSAJES_ERROR[motivo],
  };
}

/** La página pública y todo el admin dependen de la tabla de talleres. */
function refrescar() {
  revalidatePath("/taller");
  revalidatePath("/admin", "layout");
}

export async function guardarTaller(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const lectura = leerTallerForm(fd);
  if (!lectura.ok) {
    return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };
  }

  const id = String(fd.get("id") ?? "");

  if (!id) {
    const creado = await crearTaller(lectura.datos);
    if (!creado.ok) return error(creado.motivo);
    refrescar();
    redirect(`/admin/talleres/${creado.valor}`);
  }

  const actualizado = await actualizarTaller(id, lectura.datos);
  if (!actualizado.ok) return error(actualizado.motivo);
  refrescar();
  return { status: "ok", message: "Cambios guardados." };
}

export async function cambiarEstado(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  const estado = String(fd.get("estado") ?? "");
  if (!ESTADOS_TALLER.includes(estado as TallerEstado)) {
    return { status: "error", errores: {}, message: "Estado no válido." };
  }

  const r = await cambiarEstadoTaller(id, estado as TallerEstado);
  if (!r.ok) return error(r.motivo);
  refrescar();
  return { status: "ok", message: "Estado actualizado." };
}

export async function duplicar(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const r = await duplicarTaller(String(fd.get("id") ?? ""));
  if (!r.ok) return error(r.motivo);
  refrescar();
  redirect(`/admin/talleres/${r.valor}`);
}

export async function eliminar(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const r = await eliminarTaller(String(fd.get("id") ?? ""));
  if (!r.ok) return error(r.motivo);
  refrescar();
  redirect("/admin/talleres");
}
```

- [ ] **Step 2: Formulario de taller**

`src/components/admin/taller-form.tsx`:

```tsx
"use client";

import { startTransition, useActionState, useState, type InputHTMLAttributes } from "react";
import { guardarTaller, type AccionState } from "@/app/admin/talleres/actions";
import { PORCENTAJES_PAGO, type Taller, type Tarifa } from "@/lib/talleres/tipos";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass, tarjeta } from "./ui";

const inicial: AccionState = { status: "idle" };

type FilaTarifa = Tarifa & { clave: string };

const TARIFA_VACIA: Tarifa = { id: "", nombre: "", descripcion: "", precio: 0, destacada: false };

/**
 * Alta y edición de un taller.
 *
 * Se envía con `onSubmit` + `startTransition` y no con `<form action>`: React
 * 19 vacía los campos no controlados después de cada envío por `action`, y un
 * error de validación borraría todo lo escrito.
 */
export function TallerForm({ taller }: { taller?: Taller }) {
  const [state, action, pending] = useActionState(guardarTaller, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const [tarifas, setTarifas] = useState<FilaTarifa[]>(() =>
    (taller?.tarifas.length
      ? taller.tarifas
      : [{ ...TARIFA_VACIA, nombre: "Cupo General", destacada: true }]
    ).map((t, i) => ({ ...t, clave: `t${i}` })),
  );

  function campo(
    name: string,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> & { ayuda?: string } = {},
  ) {
    const { ayuda, ...rest } = props;
    return (
      <div>
        <label htmlFor={name} className={labelClass}>
          {label}
        </label>
        <input
          id={name}
          name={name}
          className={inputClass}
          aria-invalid={Boolean(errores[name])}
          {...rest}
        />
        {ayuda && !errores[name] && <p className="mt-1.5 text-[12px] text-ink-soft">{ayuda}</p>}
        {errores[name] && <p className={errorClass}>{errores[name]}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-5"
    >
      {taller && <input type="hidden" name="id" value={taller.id} />}

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Curso</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Curso</h2>
        {campo("titulo", "Título", { defaultValue: taller?.titulo, required: true })}
        {campo("titulo_acento", "Acento del título (opcional)", {
          defaultValue: taller?.tituloAcento ?? "",
          ayuda: "Se pinta en azul: «+ Sedación TCI».",
        })}
        {campo("modalidad", "Modalidad", { defaultValue: taller?.modalidad ?? "Taller presencial" })}
        {campo("slug", "Identificador (slug)", {
          defaultValue: taller?.slug ?? "",
          readOnly: Boolean(taller),
          ayuda: taller
            ? "No se cambia: las reservas apuntan a este identificador."
            : "Vacío = taller-AAAA-MM según la fecha de inicio.",
        })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-3`}>
        <legend className="sr-only">Fechas</legend>
        <h2 className="text-[18px] text-navy sm:col-span-3">Fechas</h2>
        {campo("fecha_inicio", "Inicio", { type: "date", defaultValue: taller?.fechaInicio, required: true })}
        {campo("fecha_fin", "Fin", { type: "date", defaultValue: taller?.fechaFin, required: true })}
        {campo("fechas_texto", "Texto de fechas (opcional)", {
          defaultValue: taller?.fechasTexto ?? "",
          ayuda: "Vacío = se genera: «Octubre 24 y 25, 2026».",
        })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Sede</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Sede</h2>
        {campo("sede_nombre", "Sede", { defaultValue: taller?.sedeNombre, required: true })}
        {campo("ciudad", "Ciudad", { defaultValue: taller?.ciudad, required: true })}
        {campo("region", "Estado / departamento (opcional)", { defaultValue: taller?.region ?? "" })}
        {campo("pais", "País", { defaultValue: taller?.pais, required: true })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-3`}>
        <legend className="sr-only">Cupos y certificado</legend>
        <h2 className="text-[18px] text-navy sm:col-span-3">Cupos y certificado</h2>
        {campo("cupos_total", "Cupos", {
          type: "number",
          min: 0,
          max: 1000,
          defaultValue: taller?.cuposTotal ?? 20,
          required: true,
        })}
        {campo("horas", "Horas académicas (opcional)", {
          type: "number",
          min: 1,
          max: 500,
          defaultValue: taller?.horas ?? "",
        })}
        {campo("aval", "Aval (opcional)", { defaultValue: taller?.aval ?? "" })}
      </fieldset>

      <fieldset className={`${tarjeta} flex flex-col gap-4`}>
        <legend className="sr-only">Pagos</legend>
        <h2 className="text-[18px] text-navy">Pagos</h2>

        <div>
          <p className={labelClass}>Porcentajes que se aceptan</p>
          <div className="flex flex-wrap gap-4">
            {PORCENTAJES_PAGO.map((p) => (
              <label key={p} className="flex items-center gap-2 text-[14px] text-navy">
                <input
                  type="checkbox"
                  name="porcentajes_pago"
                  value={p}
                  defaultChecked={p === 100 || (taller?.porcentajesPago ?? [50, 100]).includes(p)}
                  disabled={p === 100}
                />
                {p}%
              </label>
            ))}
            {/* Un checkbox deshabilitado no se envía: el 100 va oculto. */}
            <input type="hidden" name="porcentajes_pago" value="100" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {campo("moneda", "Moneda", { defaultValue: taller?.moneda ?? "COP", maxLength: 3 })}
          <label className="flex items-center gap-2 self-end pb-3 text-[14px] text-navy">
            <input type="checkbox" name="precios_publicados" defaultChecked={taller?.preciosPublicados} />
            Mostrar precios en la página
          </label>
        </div>

        <div>
          <p className={labelClass}>Tarifas (la marcada es la que se aplica a las reservas web)</p>
          {errores.tarifas && <p className={errorClass}>{errores.tarifas}</p>}
          <div className="flex flex-col gap-3">
            {tarifas.map((t, i) => (
              <div key={t.clave} className="grid items-start gap-2 sm:grid-cols-[auto_1fr_1.4fr_9rem_auto]">
                <input type="hidden" name="tarifa_id" value={t.id} />
                <input
                  type="radio"
                  name="tarifa_destacada"
                  value={i}
                  defaultChecked={t.destacada}
                  aria-label="Tarifa por defecto"
                  className="mt-4"
                />
                <input name="tarifa_nombre" defaultValue={t.nombre} placeholder="Nombre" className={inputClass} />
                <input
                  name="tarifa_descripcion"
                  defaultValue={t.descripcion}
                  placeholder="Descripción"
                  className={inputClass}
                />
                <div>
                  <input
                    name="tarifa_precio"
                    type="number"
                    min={0}
                    defaultValue={t.precio}
                    placeholder="Precio"
                    aria-invalid={Boolean(errores[`tarifa_precio_${i}`])}
                    className={inputClass}
                  />
                  {errores[`tarifa_precio_${i}`] && (
                    <p className={errorClass}>{errores[`tarifa_precio_${i}`]}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTarifas((ts) => ts.filter((x) => x.clave !== t.clave))}
                  className={botonSecundario}
                  disabled={tarifas.length === 1}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setTarifas((ts) => [...ts, { ...TARIFA_VACIA, clave: `t${Date.now()}` }])
            }
            className={`${botonSecundario} mt-3`}
          >
            Añadir tarifa
          </button>
        </div>
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Imagen y firma</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Imagen y firma del certificado</h2>
        {campo("foto_principal", "Foto principal (opcional)", {
          defaultValue: taller?.fotoPrincipal ?? "",
          ayuda: "Ruta en /public, p. ej. /assets/taller-bomba-tci.webp. Vacío = la de siempre.",
        })}
        {campo("foto_principal_alt", "Descripción de la foto", { defaultValue: taller?.fotoPrincipalAlt ?? "" })}
        {campo("firma_nombre", "Firma: nombre", { defaultValue: taller?.firmaNombre ?? "" })}
        {campo("firma_cargo", "Firma: cargo", { defaultValue: taller?.firmaCargo ?? "" })}
        {campo("firma_documento", "Firma: documento", { defaultValue: taller?.firmaDocumento ?? "" })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={botonPrimario}>
          {pending ? "Guardando…" : taller ? "Guardar cambios" : "Crear taller"}
        </button>
        {state.status === "error" && state.message && (
          <p role="alert" className="text-[13.5px] text-red-600">
            {state.message}
          </p>
        )}
        {state.status === "ok" && (
          <p role="status" className="text-[13.5px] text-emerald-700">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Acciones de estado, duplicar y eliminar**

`src/components/admin/taller-acciones.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { cambiarEstado, duplicar, eliminar, type AccionState } from "@/app/admin/talleres/actions";
import { ESTADO_ETIQUETA, ESTADOS_TALLER, type Taller } from "@/lib/talleres/tipos";
import { botonPrimario, botonSecundario, inputClass, tarjeta } from "./ui";

const inicial: AccionState = { status: "idle" };

function Mensaje({ state }: { state: AccionState }) {
  if (state.status === "error" && state.message)
    return (
      <p role="alert" className="text-[13px] text-red-600">
        {state.message}
      </p>
    );
  if (state.status === "ok")
    return (
      <p role="status" className="text-[13px] text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}

export function TallerAcciones({ taller, reservas }: { taller: Taller; reservas: number | null }) {
  const [estadoState, estadoAction, estadoPending] = useActionState(cambiarEstado, inicial);
  const [dupState, dupAction, dupPending] = useActionState(duplicar, inicial);
  const [delState, delAction, delPending] = useActionState(eliminar, inicial);

  return (
    <section className={`${tarjeta} flex flex-col gap-5`}>
      <form action={estadoAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={taller.id} />
        <div>
          <label htmlFor="estado" className="mb-1.5 block text-[12.5px] font-semibold text-navy">
            Estado
          </label>
          {/* `key` resetea el select cuando el estado cambia en el servidor. */}
          <select key={taller.estado} id="estado" name="estado" defaultValue={taller.estado} className={inputClass}>
            {ESTADOS_TALLER.map((e) => (
              <option key={e} value={e}>
                {ESTADO_ETIQUETA[e]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={estadoPending} className={botonPrimario}>
          {estadoPending ? "Cambiando…" : "Cambiar estado"}
        </button>
        <Mensaje state={estadoState} />
      </form>

      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Borrador: no se ve. Publicado: abierto a reservas y pagos. Cerrado: visible como
        agotado, sin pagos. Finalizado: ya ocurrió. Archivado: oculto, conserva el historial.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-5">
        <form action={dupAction}>
          <input type="hidden" name="id" value={taller.id} />
          <button type="submit" disabled={dupPending} className={botonSecundario}>
            {dupPending ? "Duplicando…" : "Duplicar para nueva edición"}
          </button>
        </form>
        <Mensaje state={dupState} />

        {reservas === 0 ? (
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm("¿Eliminar este taller? No se puede deshacer.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={taller.id} />
            <button
              type="submit"
              disabled={delPending}
              className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
            >
              {delPending ? "Eliminando…" : "Eliminar"}
            </button>
          </form>
        ) : (
          <p className="text-[12.5px] text-ink-soft">
            {reservas === null
              ? "No se pudo comprobar si tiene reservas."
              : `Tiene ${reservas} ${reservas === 1 ? "reserva" : "reservas"}: archívalo en lugar de eliminarlo.`}
          </p>
        )}
        <Mensaje state={delState} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Páginas**

`src/app/admin/talleres/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { botonPrimario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { listarDisponibilidades, listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talleres · STA",
  robots: { index: false, follow: false },
};

export default async function TalleresPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const [talleres, disponibilidad] = await Promise.all([listarTalleres(), listarDisponibilidades()]);

  return (
    <AdminShell
      titulo="Talleres"
      acciones={
        <Link href="/admin/talleres/nuevo" className={botonPrimario}>
          Nuevo taller
        </Link>
      }
    >
      {talleres === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : talleres.length === 0 ? (
        <p className={tarjeta}>Todavía no hay talleres. Crea el primero.</p>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
          {talleres.map((t) => {
            const d = disponibilidad.get(t.slug);
            const pct = d && d.total > 0 ? Math.min(100, Math.round((d.ocupados / d.total) * 100)) : 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/talleres/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 hover:bg-cream/60"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-navy">
                      {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-[12.5px] text-ink-soft">
                      {t.fechasTexto} · {t.ciudad} · <span className="font-mono">{t.slug}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {d && (
                      <div className="w-[140px]">
                        <div className="h-1.5 overflow-hidden rounded-full bg-navy/10">
                          <div className="h-full bg-azure" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[11.5px] text-ink-soft">
                          {d.ocupados}/{d.total} · {pct}%
                        </p>
                      </div>
                    )}
                    <span className="rounded-full bg-ice px-3 py-1 text-[12px] font-semibold text-navy">
                      {ESTADO_ETIQUETA[t.estado]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
```

`src/app/admin/talleres/nuevo/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { TallerForm } from "@/components/admin/taller-form";
import { puertaAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Nuevo taller · STA",
  robots: { index: false, follow: false },
};

export default async function NuevoTallerPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  return (
    <AdminShell
      titulo="Nuevo taller"
      subtitulo="Se crea como borrador: no aparece en la página hasta que lo publiques."
    >
      <TallerForm />
    </AdminShell>
  );
}
```

`src/app/admin/talleres/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { TallerAcciones } from "@/components/admin/taller-acciones";
import { TallerForm } from "@/components/admin/taller-form";
import { tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { MENSAJES_ERROR } from "@/lib/talleres/errores";
import { contarInscripciones, obtenerDisponibilidad, obtenerTaller } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar taller · STA",
  robots: { index: false, follow: false },
};

export default async function EditarTallerPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const { id } = await params;
  const r = await obtenerTaller(id);
  if (!r.ok && r.motivo === "no_encontrado") notFound();
  if (!r.ok) {
    return (
      <AdminShell titulo="Taller">
        <p className={tarjeta}>{MENSAJES_ERROR[r.motivo]}</p>
      </AdminShell>
    );
  }

  const taller = r.valor;
  const [reservas, disp] = await Promise.all([
    contarInscripciones(taller.slug),
    obtenerDisponibilidad(taller.slug),
  ]);

  return (
    <AdminShell
      titulo={[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")}
      subtitulo={
        <>
          {ESTADO_ETIQUETA[taller.estado]} · {taller.fechasTexto}
          {disp && ` · ${disp.ocupados}/${disp.total} cupos ocupados`} ·{" "}
          <Link href={`/admin/certificados?taller=${taller.slug}`} className="text-azure hover:underline">
            Certificados
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TallerAcciones taller={taller} reservas={reservas} />
        <TallerForm key={taller.id} taller={taller} />
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en el navegador (requiere migración aplicada)**

Con `CERTIFICADOS_PASSWORD` en `.env.local` y `npm run dev`, en `http://localhost:3002/admin`:

1. Entra con la contraseña → Inicio muestra `taller-2026-10` como **Finalizado** con `8/20` cupos.
2. Talleres → Nuevo taller. Deja el título vacío y fecha de fin anterior al inicio → Crear: aparecen los errores junto a los campos **y lo demás que escribiste sigue ahí** (Review Focus 4).
3. Corrige: título "Prueba de admin", 2030-01-10 a 2030-01-11, sede/ciudad/país cualesquiera → Crear: redirige a la ficha, estado Borrador, slug `taller-2030-01`.
4. Duplicar → se abre la copia en Borrador. En la copia pon fechas 2030-01-11 a 2030-01-12 y guarda. Publica el original y luego intenta publicar la copia → mensaje «Ya hay otro taller publicado o cerrado en esas fechas…» (Review Focus 3).
5. Elimina la copia (confirmar) → vuelve a la lista. Abre `taller-2026-10` → no hay botón Eliminar, dice «Tiene 8 reservas: archívalo…».
6. Con "Prueba de admin" publicado, abre `http://localhost:3002/taller` → muestra "Prueba de admin", `0%` de cupos vendidos, formulario de reserva y sección "Registrar pago". **No envíes el formulario** (escribiría en producción).
7. Vuelve al admin, pon "Prueba de admin" en Cerrado → `/taller` muestra "100% de cupos vendidos", el panel de lista de espera y no muestra "Registrar pago".
8. Elimina "Prueba de admin" → `/taller` vuelve a mostrar `taller-2026-10` finalizado.

Si este paso lo ejecuta un agente sin navegador, lista estos 8 pasos en el informe final como pendientes para el usuario.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/talleres src/components/admin
git commit -m "feat(admin): crear, editar, duplicar, programar y eliminar talleres"
```

---

### Task 9: Limpieza y verificación final

**Files:**
- Modify: `src/lib/taller.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `src/lib/taller.ts` exporta solo `contenidoTaller`, `ContenidoTaller`, `formatPrice`, `tallerWaLink`.

- [ ] **Step 1: Quitar el objeto `taller` antiguo**

En `src/lib/taller.ts`:
- Renombra `export const taller = {` a `const contenido = {` y elimina de él las claves `edition`, `title`, `titleAccent`, `kind`, `venue`, `dates`, `endorsement`, `scarcity`, `soldOut`, `pricing` (con sus comentarios).
- `contenidoTaller` pasa a ser directamente ese objeto: sustituye el bloque `export const contenidoTaller = { heroPhoto: taller.heroPhoto, … } as const;` por `export const contenidoTaller = contenido;`.
- Borra `export type TallerTier` y `export const defaultTier`.
- En `tallerWaLink`, `taller.contact.whatsapp` → `contenido.contact.whatsapp`.
- En la FAQ, la pregunta «¿Cómo se confirma mi cupo?» no cambia en esta etapa (el flujo de pago se rehace en la etapa 2).

- [ ] **Step 2: Comprobar que no queda ningún uso del objeto viejo**

Run: `grep -rnE "\btaller\.(edition|soldOut|scarcity|pricing|dates|venue)\b|defaultTier|getSeats|taller_editions|taller_availability" src`
Expected: solo coincidencias dentro de componentes de `src/components/taller/` donde `taller` es la variable local devuelta por `useTaller()` o la prop `taller` del footer (`taller.dates`, `taller.venue`, `taller.scarcity`, `taller.pricing`, `taller.soldOut`); ninguna importación de `taller` desde `@/lib/taller`, ninguna de `defaultTier`, `getSeats`, `taller_editions` ni `taller_availability`.

Run: `grep -rn 'import { taller\|import { defaultTier\|, taller }\|, taller,' src`
Expected: sin resultados.

- [ ] **Step 3: Verificación completa**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: todo en verde; `next build` lista `/taller` con revalidación (`○` o `ISR 5m`) y las rutas `/admin`, `/admin/talleres`, `/admin/talleres/[id]`, `/admin/talleres/nuevo`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/taller.ts
git commit -m "refactor(taller): el código solo guarda el contenido por defecto"
```

- [ ] **Step 5: Informe al usuario**

Resume: commits creados, si la migración ya está aplicada (Task 3 Step 6), resultado de `supabase/tests/talleres.sql` si se pudo correr, y los pasos manuales de Task 8 Step 6 que queden pendientes. Recuerda:
- Con `taller-2026-10` en Finalizado, la página no muestra reserva ni registro de pago: las 8 reservas pendientes ya no pueden subir comprobantes por la web hasta que el taller se publique de nuevo o llegue la etapa 2.
- Hay que desplegar el código **justo después** de aplicar la migración: el sitio antiguo sigue funcionando con la base migrada (mismas funciones), pero deja de mostrar el conteo de cupos.
