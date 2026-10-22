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
  /** Las funciones de inscripción reciben el id, no el slug. */
  id: string;
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
  terms: readonly ContenidoTaller["terms"][number][];
  refunds: ContenidoTaller["refunds"];
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
    id: taller.id,
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
    terms: lista("terms", base.terms),
    refunds: base.refunds,
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
