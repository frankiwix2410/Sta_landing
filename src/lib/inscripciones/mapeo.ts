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
