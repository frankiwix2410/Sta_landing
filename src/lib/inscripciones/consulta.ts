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
