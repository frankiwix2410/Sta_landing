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
  | "estado_invalido"
  | "origen_invalido"
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
  "estado_invalido",
  "origen_invalido",
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
  estado_invalido: "Estado de comprobante no válido. Recarga la página e inténtalo de nuevo.",
  origen_invalido: "Origen de la inscripción no válido.",
  documento_duplicado: "Ya existe otra persona con ese documento. Usa «Fusionar» para unirlas.",
  limite: "Demasiadas consultas seguidas. Espera unos minutos e inténtalo de nuevo.",
  error: "No se pudo completar. Inténtalo otra vez en unos segundos.",
};
