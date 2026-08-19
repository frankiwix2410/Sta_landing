import { getSupabase } from "./supabase";

/**
 * Datos de un certificado.
 *
 * Salen de la vista `public.taller_certificates`, que ya filtra por pago
 * confirmado y asistencia marcada: si una fila llega hasta aquí, el certificado
 * es válido. Los campos de la edición vienen de la base y no de
 * `src/lib/taller.ts` para que un certificado de octubre siga diciendo octubre
 * cuando el código apunte a la convocatoria siguiente.
 */
export type Certificate = {
  reference: string;
  name: string;
  email: string;
  profession: string;
  city: string;
  edition: string;
  courseTitle: string;
  datesLabel: string | null;
  /** Horas académicas. `null` = el certificado no las menciona. */
  hours: number | null;
  endorsement: string | null;
};

type CertificateRow = {
  reference: string;
  name: string;
  email: string;
  profession: string;
  city: string;
  edition: string;
  course_title: string;
  dates_label: string | null;
  hours: number | null;
  endorsement: string | null;
};

const COLUMNS =
  "reference, name, email, profession, city, edition, course_title, dates_label, hours, endorsement";

function toCertificate(row: CertificateRow): Certificate {
  return {
    reference: row.reference,
    name: row.name,
    email: row.email,
    profession: row.profession,
    city: row.city,
    edition: row.edition,
    courseTitle: row.course_title,
    datesLabel: row.dates_label,
    hours: row.hours,
    endorsement: row.endorsement,
  };
}

/** Distingue "no hay certificado" de "no se pudo consultar". */
export type CertificateLookup =
  | { kind: "found"; certificate: Certificate }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/**
 * Busca el certificado por su referencia (la misma STA-XXXXXXXX de la reserva).
 *
 * Devuelve `not_found` tanto si la referencia no existe como si existe pero aún
 * no da derecho a certificado. Es deliberado: distinguirlas por fuera revelaría
 * si una referencia es real, y quien tiene la suya ya sabe cuál es su caso.
 */
export async function getCertificate(reference: string): Promise<CertificateLookup> {
  const supabase = getSupabase();
  if (!supabase) return { kind: "unavailable" };

  const { data, error } = await supabase
    .from("taller_certificates")
    .select(COLUMNS)
    .eq("reference", reference.trim().toUpperCase())
    .maybeSingle<CertificateRow>();

  if (error) {
    console.error("[certificados] no se pudo leer el certificado", { reference, error });
    return { kind: "unavailable" };
  }

  return data ? { kind: "found", certificate: toCertificate(data) } : { kind: "not_found" };
}

/** Todos los certificados de una edición, para la vista de impresión en lote. */
export async function listCertificates(edition: string): Promise<Certificate[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("taller_certificates")
    .select(COLUMNS)
    .eq("edition", edition)
    .order("name");

  if (error) {
    console.error("[certificados] no se pudo listar", { edition, error });
    return null;
  }

  return (data as CertificateRow[]).map(toCertificate);
}
