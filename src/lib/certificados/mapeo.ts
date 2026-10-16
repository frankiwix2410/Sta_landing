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
