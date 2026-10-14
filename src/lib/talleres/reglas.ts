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
