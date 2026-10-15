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
