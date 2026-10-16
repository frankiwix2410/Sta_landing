import type { TipoDocumento } from "@/lib/inscripciones/tipos";
import { ZONA_HORARIA } from "@/lib/talleres/reglas";

const PREFIJO: Record<TipoDocumento, string> = {
  CC: "C.C.",
  CE: "C.E.",
  PAS: "Pasaporte",
  CI: "C.I.",
  OTRO: "",
};

/**
 * El documento como se imprime: "C.C. 1.136.882.468", con el mismo formato
 * que la firma del instructor. Los pasaportes y los que llevan letras van tal
 * cual: ponerles puntos los volvería irreconocibles.
 */
export function documentoImpreso(tipo: TipoDocumento, documento: string | null): string {
  if (!documento) return "";
  const cuerpo =
    tipo !== "PAS" && /^\d+$/.test(documento)
      ? documento.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      : documento;
  return [PREFIJO[tipo], cuerpo].filter(Boolean).join(" ");
}

/**
 * Tamaño del nombre en mm. Va en mayúsculas sobre una línea de 175 mm: a 9 mm
 * caben ~22 letras; los nombres largos bajan de tamaño en vez de partirse.
 */
export function tallaNombre(nombre: string): number {
  const n = nombre.trim().length;
  if (n <= 22) return 9;
  if (n <= 30) return 7.5;
  if (n <= 40) return 6;
  return 5;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

/** "26 de octubre de 2026", en la zona del negocio. */
export function fechaLarga(iso: string): string {
  return FECHA_LARGA.format(new Date(iso));
}
