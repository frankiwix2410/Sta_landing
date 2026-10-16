import type { TipoDocumento } from "@/lib/inscripciones/tipos";

/**
 * Un certificado tal como lo guarda la base. Nombre y documento son copia de
 * la persona (se actualizan si los corrige); curso, fechas, sede, aval y firma
 * son copia del taller al emitirse y no cambian aunque se edite el taller: un
 * certificado de octubre sigue diciendo octubre. La excepción son las horas:
 * si el admin carga o cambia las horas del taller, los certificados emitidos
 * las reflejan.
 */
export type Certificado = {
  id: string;
  codigo: string;
  inscripcionId: string;
  tallerId: string;
  referencia: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  documento: string | null;
  curso: string;
  fechasTexto: string;
  sede: string;
  ciudad: string;
  region: string | null;
  horas: number | null;
  aval: string | null;
  firmaNombre: string | null;
  firmaCargo: string | null;
  firmaDocumento: string | null;
  emitidoEn: string;
  /** `null` = vigente. Nunca se borra un certificado: se revoca. */
  revocadoEn: string | null;
  /** Revocado por el admin: la emisión automática no lo reactiva. */
  revocadoManual: boolean;
};

/** Lo que ve la persona al buscar sus certificados por documento. */
export type CertificadoPublico = { codigo: string; curso: string; fechasTexto: string };
