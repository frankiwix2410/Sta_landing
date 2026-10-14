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
