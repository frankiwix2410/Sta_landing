import { PROOF_BUCKET, type ProofFile } from "@/lib/reservations/payment-proofs";
import { getSupabase } from "@/lib/reservations/supabase";
import { motivoDesdeReason } from "./errores";
import type { Correcciones } from "./formulario";
import type { Resultado } from "./repo";

export type NuevoComprobante = {
  tallerId: string;
  /** Carpeta del bucket: `<slug>/<id>.<ext>`, como los comprobantes migrados. */
  tallerSlug: string;
  documento: string;
  porcentaje: number;
  correcciones: Correcciones;
  notas: string;
  archivo: ProofFile;
};

type FilaRegistrar = {
  ok: boolean;
  reason: string | null;
  inscripcion_referencia: string | null;
  nuevo_en_revision: number;
};

/**
 * Sube el archivo y registra el comprobante.
 *
 * Primero el archivo y después la base: un comprobante que apunta a un
 * archivo inexistente sería un pago que nadie puede verificar. Si la función
 * SQL lo rechaza (cerrado, sin reserva, porcentaje), se borra el archivo para
 * no dejar huérfanos.
 */
export async function guardarComprobante(
  c: NuevoComprobante,
): Promise<Resultado<{ referencia: string; enRevision: number; nombreBloqueado: boolean }>> {
  const supabase = getSupabase();
  if (!supabase) {
    console.info("[taller] comprobante (sin Supabase)", {
      tallerId: c.tallerId,
      porcentaje: c.porcentaje,
      bytes: c.archivo.bytes.length,
    });
    return { ok: false, motivo: "sin_conexion" };
  }

  const id = crypto.randomUUID();
  const ruta = `${c.tallerSlug}/${id}.${c.archivo.ext}`;
  const bucket = supabase.storage.from(PROOF_BUCKET);

  const subida = await bucket.upload(ruta, c.archivo.bytes, {
    contentType: c.archivo.type,
    upsert: false,
  });
  if (subida.error) {
    console.error("[taller] no se pudo subir el comprobante", { ruta, error: subida.error });
    return { ok: false, motivo: "error" };
  }

  const { data, error } = await supabase.rpc("registrar_comprobante", {
    p_taller_id: c.tallerId,
    p_documento: c.documento,
    p_comprobante_id: id,
    p_porcentaje: c.porcentaje,
    p_nombre: c.correcciones.nombre,
    p_email: c.correcciones.email,
    p_telefono: c.correcciones.telefono,
    p_notas: c.notas,
    p_file_path: ruta,
    p_file_type: c.archivo.type,
    p_file_size: c.archivo.bytes.length,
  });

  const fila = (data as FilaRegistrar[] | null)?.[0] ?? null;
  if (fila?.ok && fila.inscripcion_referencia) {
    return {
      ok: true,
      valor: {
        referencia: fila.inscripcion_referencia,
        enRevision: fila.nuevo_en_revision,
        // ok = true con este reason: se registró, pero sin cambiar el nombre.
        nombreBloqueado: fila.reason === "nombre_bloqueado",
      },
    };
  }

  await bucket.remove([ruta]);
  if (error || !fila) {
    console.error("[taller] no se pudo registrar el comprobante", { ruta, error });
    return { ok: false, motivo: "error" };
  }
  return { ok: false, motivo: motivoDesdeReason(fila.reason) };
}
