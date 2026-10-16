import { motivoDesdeReason, type MotivoInscripcion } from "@/lib/inscripciones/errores";
import { getSupabase } from "@/lib/reservations/supabase";
import { COLUMNAS_CERTIFICADO, filaACertificado, type FilaCertificado } from "./mapeo";
import type { Certificado, CertificadoPublico } from "./tipos";
import { errorSeguro } from "@/lib/log-error";

/**
 * Único módulo que lee los certificados. Solo servidor. La emisión y la
 * revocación automáticas las hace la base (triggers de 20261015_02); aquí solo
 * se consulta y se revoca a mano.
 */

/** Distingue «no hay certificado» de «no se pudo consultar». */
export type BusquedaCertificado =
  | { kind: "found"; certificado: Certificado }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function obtenerCertificado(codigo: string): Promise<BusquedaCertificado> {
  const supabase = getSupabase();
  if (!supabase) return { kind: "unavailable" };
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select(COLUMNAS_CERTIFICADO)
    .eq("codigo", codigo)
    .maybeSingle<FilaCertificado>();
  if (error) {
    console.error("[certificados] no se pudo leer", { error: errorSeguro(error) });
    return { kind: "unavailable" };
  }
  return data ? { kind: "found", certificado: filaACertificado(data) } : { kind: "not_found" };
}

/** Para las URLs antiguas `/certificado/STA-XXXXXXXX`. */
export async function codigoPorReferencia(referencia: string): Promise<string | null | "unavailable"> {
  const supabase = getSupabase();
  if (!supabase) return "unavailable";
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select("codigo")
    .eq("referencia", referencia)
    .maybeSingle<{ codigo: string }>();
  if (error) {
    console.error("[certificados] no se pudo buscar por referencia", { error: errorSeguro(error) });
    return "unavailable";
  }
  return data?.codigo ?? null;
}

/** Todos los del taller, vigentes y revocados (el admin decide qué imprimir). */
export async function listarCertificadosTaller(tallerId: string): Promise<Certificado[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("certificados_detalle")
    .select(COLUMNAS_CERTIFICADO)
    .eq("taller_id", tallerId)
    .order("nombre");
  if (error) {
    console.error("[certificados] no se pudieron listar", { error: errorSeguro(error) });
    return null;
  }
  return (data as unknown as FilaCertificado[]).map(filaACertificado);
}

/** Los vigentes de una persona en todos los talleres, para la búsqueda pública. */
export async function certificadosPorDocumento(documento: string): Promise<CertificadoPublico[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("certificados_vigentes")
    .select("codigo, curso, fechas_texto")
    .eq("documento", documento)
    .order("emitido_en", { ascending: false });
  if (error) {
    console.error("[certificados] no se pudo buscar por documento", { error: errorSeguro(error) });
    return null;
  }
  return (data as { codigo: string; curso: string; fechas_texto: string }[]).map((f) => ({
    codigo: f.codigo,
    curso: f.curso,
    fechasTexto: f.fechas_texto,
  }));
}

type FilaRevocar = { ok: boolean; reason: string | null; vigente: boolean };

export async function revocarCertificado(
  id: string,
  revocar: boolean,
): Promise<{ ok: true; vigente: boolean } | { ok: false; motivo: MotivoInscripcion }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, motivo: "sin_conexion" };
  const { data, error } = await supabase.rpc("revocar_certificado", {
    p_certificado_id: id,
    p_revocar: revocar,
  });
  const fila = (data as FilaRevocar[] | null)?.[0] ?? null;
  if (error || !fila) {
    console.error("[certificados] no se pudo revocar/reactivar", { error: errorSeguro(error) });
    return { ok: false, motivo: "error" };
  }
  return fila.ok ? { ok: true, vigente: fila.vigente } : { ok: false, motivo: motivoDesdeReason(fila.reason) };
}
