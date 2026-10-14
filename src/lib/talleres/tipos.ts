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
