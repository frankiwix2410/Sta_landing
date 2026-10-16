import { PROOF_BUCKET } from "@/lib/reservations/payment-proofs";
import { getSupabase } from "@/lib/reservations/supabase";
import type { FilaConsulta } from "./consulta";
import { motivoDesdeErrorPg, motivoDesdeReason, type MotivoInscripcion } from "./errores";
import {
  COLUMNAS_COMPROBANTE,
  COLUMNAS_INSCRITO,
  COLUMNAS_PERSONA,
  filaAComprobante,
  filaAInscrito,
  filaAPersona,
  type FilaComprobante,
  type FilaInscrito,
  type FilaPersona,
} from "./mapeo";
import type { ComprobanteAdmin, DatosPersona, EstadoComprobante, Inscrito, Persona } from "./tipos";
import { errorSeguro } from "@/lib/log-error";

/**
 * Único módulo que lee y escribe personas, inscripciones y comprobantes. Solo
 * servidor: usa la clave `service_role`. Las reglas viven en las funciones SQL
 * de `supabase/migrations/20261015_01_inscripciones.sql`; aquí solo se
 * traducen sus respuestas.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoInscripcion };

const fallo = (motivo: MotivoInscripcion) => ({ ok: false, motivo }) as const;

/** Las funciones SQL son `returns table`: la respuesta es una fila dentro de un array. */
function primera<T>(data: unknown): T | null {
  return (data as T[] | null)?.[0] ?? null;
}

export type NuevaInscripcion = {
  tallerId: string;
  referencia: string;
  persona: DatosPersona;
  tarifa: { id: string; nombre: string };
  monto: number | null;
  moneda: string | null;
  notas: string;
  origen: "web" | "admin";
  /** Solo el admin puede inscribir por encima del cupo. */
  forzarCupo: boolean;
};

export type InscripcionCreada = {
  inscripcionId: string;
  referencia: string;
  reactivada: boolean;
  /** La web no puede cambiar nombre ni documento de quien ya tiene un certificado vigente. */
  nombreBloqueado: boolean;
};

type FilaCrear = {
  ok: boolean;
  reason: string | null;
  inscripcion_id: string | null;
  inscripcion_referencia: string | null;
  reactivada: boolean;
};

export async function crearInscripcion(n: NuevaInscripcion): Promise<Resultado<InscripcionCreada>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");

  const { data, error } = await supabase.rpc("crear_inscripcion", {
    p_taller_id: n.tallerId,
    p_referencia: n.referencia,
    p_documento: n.persona.documento,
    p_tipo_documento: n.persona.tipoDocumento,
    p_nombre: n.persona.nombre,
    p_email: n.persona.email ?? "",
    p_telefono: n.persona.telefono ?? "",
    p_ciudad: n.persona.ciudad ?? "",
    p_profesion: n.persona.profesion ?? "",
    p_tarifa_id: n.tarifa.id,
    p_tarifa_nombre: n.tarifa.nombre,
    p_monto: n.monto,
    p_moneda: n.moneda,
    p_notas: n.notas,
    p_origen: n.origen,
    p_forzar_cupo: n.forzarCupo,
  });

  const fila = primera<FilaCrear>(data);
  if (error || !fila) {
    // Sin datos personales en los logs: la referencia basta para localizarla.
    console.error("[inscripciones] no se pudo crear", {
      referencia: n.referencia,
      tallerId: n.tallerId,
      error: errorSeguro(error),
    });
    return fallo("error");
  }
  if (fila.ok && fila.inscripcion_id && fila.inscripcion_referencia) {
    return {
      ok: true,
      valor: {
        inscripcionId: fila.inscripcion_id,
        referencia: fila.inscripcion_referencia,
        reactivada: fila.reactivada,
        nombreBloqueado: fila.reason === "nombre_bloqueado",
      },
    };
  }
  return fallo(motivoDesdeReason(fila.reason));
}

export async function consultarInscripcion(
  tallerId: string,
  documento: string,
): Promise<Resultado<FilaConsulta | null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("consultar_inscripcion", {
    p_taller_id: tallerId,
    p_documento: documento,
  });
  if (error) {
    console.error("[inscripciones] no se pudo consultar", { tallerId, error: errorSeguro(error) });
    return fallo("error");
  }
  return { ok: true, valor: primera<FilaConsulta>(data) };
}

export async function listarInscritos(tallerId: string): Promise<Inscrito[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inscritos_admin")
    .select(COLUMNAS_INSCRITO)
    .eq("taller_id", tallerId)
    .order("creado_en");
  if (error) {
    console.error("[inscripciones] no se pudo listar", { tallerId, error: errorSeguro(error) });
    return null;
  }
  return (data as unknown as FilaInscrito[]).map(filaAInscrito);
}

export async function buscarPersona(documento: string): Promise<Resultado<Persona | null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("personas")
    .select(COLUMNAS_PERSONA)
    .eq("documento", documento)
    .maybeSingle<FilaPersona>();
  if (error) {
    console.error("[inscripciones] no se pudo buscar la persona", { error: errorSeguro(error) });
    return fallo("error");
  }
  return { ok: true, valor: data ? filaAPersona(data) : null };
}

export async function actualizarPersona(id: string, d: DatosPersona): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("personas")
    .update({
      documento: d.documento,
      tipo_documento: d.tipoDocumento,
      nombre: d.nombre,
      email: d.email,
      telefono: d.telefono,
      ciudad: d.ciudad,
      profesion: d.profesion,
    })
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code !== "23505") console.error("[inscripciones] no se pudo editar la persona", { id, error: errorSeguro(error) });
    return fallo(motivoDesdeErrorPg(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

export async function marcarAsistencia(tallerId: string, ids: string[], asistio: boolean): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("inscripciones").update({ asistio }).eq("taller_id", tallerId).in("id", ids).select("id");
  if (error) {
    console.error("[inscripciones] no se pudo marcar asistencia", { tallerId, cantidad: ids.length, error: errorSeguro(error) });
    return fallo(motivoDesdeErrorPg(error));
  }
  return { ok: true, valor: data.length };
}

export async function cambiarCancelada(id: string, cancelada: boolean): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("inscripciones").update({ cancelada }).eq("id", id).select("id");
  if (error) {
    console.error("[inscripciones] no se pudo cancelar/reactivar", { id, error: errorSeguro(error) });
    return fallo(motivoDesdeErrorPg(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

type FilaPorcentaje = { ok: boolean; reason: string | null; nuevo_porcentaje: number | null };

export async function ajustarPorcentaje(id: string, porcentaje: number | null): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("ajustar_porcentaje", {
    p_inscripcion_id: id,
    p_porcentaje: porcentaje,
  });
  const fila = primera<FilaPorcentaje>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo ajustar el porcentaje", { id, error: errorSeguro(error) });
    return fallo("error");
  }
  return fila.ok && fila.nuevo_porcentaje !== null
    ? { ok: true, valor: fila.nuevo_porcentaje }
    : fallo(motivoDesdeReason(fila.reason));
}

type FilaEliminar = { ok: boolean; reason: string | null; archivos: string[] | null };

export async function eliminarInscripcion(id: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("eliminar_inscripcion", { p_inscripcion_id: id });
  const fila = primera<FilaEliminar>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo eliminar", { id, error: errorSeguro(error) });
    return fallo("error");
  }
  if (!fila.ok) return fallo(motivoDesdeReason(fila.reason));

  // La fila ya no existe: si el bucket falla, el archivo queda huérfano pero
  // nada lo enlaza. Se registra para limpiarlo a mano.
  if (fila.archivos?.length) {
    const borrado = await supabase.storage.from(PROOF_BUCKET).remove(fila.archivos);
    if (borrado.error) console.error("[inscripciones] archivos sin borrar", { archivos: fila.archivos, error: errorSeguro(borrado.error) });
  }
  return { ok: true, valor: null };
}

type FilaOk = { ok: boolean; reason: string | null };

export async function fusionarPersonas(origen: string, destino: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("fusionar_personas", { p_origen: origen, p_destino: destino });
  const fila = primera<FilaOk>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo fusionar", { origen, destino, error: errorSeguro(error) });
    return fallo("error");
  }
  return fila.ok ? { ok: true, valor: null } : fallo(motivoDesdeReason(fila.reason));
}

export async function listarComprobantes(f: {
  estado: EstadoComprobante | "todos";
  tallerId: string | null;
}): Promise<ComprobanteAdmin[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  let consulta = supabase.from("comprobantes_admin").select(COLUMNAS_COMPROBANTE);
  if (f.estado !== "todos") consulta = consulta.eq("estado", f.estado);
  if (f.tallerId) consulta = consulta.eq("taller_id", f.tallerId);
  const { data, error } = await consulta.order("creado_en", { ascending: false }).limit(200);
  if (error) {
    console.error("[inscripciones] no se pudieron listar los comprobantes", { f, error: errorSeguro(error) });
    return null;
  }
  return (data as unknown as FilaComprobante[]).map(filaAComprobante);
}

export async function revisarComprobante(
  id: string,
  estado: EstadoComprobante,
  nota: string,
): Promise<Resultado<number>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.rpc("revisar_comprobante", {
    p_comprobante_id: id,
    p_estado: estado,
    p_nota: nota,
  });
  const fila = primera<FilaPorcentaje>(data);
  if (error || !fila) {
    console.error("[inscripciones] no se pudo revisar el comprobante", { id, error: errorSeguro(error) });
    return fallo("error");
  }
  return fila.ok && fila.nuevo_porcentaje !== null
    ? { ok: true, valor: fila.nuevo_porcentaje }
    : fallo(motivoDesdeReason(fila.reason));
}

/**
 * URL firmada de dos minutos: el bucket es privado y el enlace no debe servir
 * si alguien lo copia de la pantalla del admin.
 */
export async function urlFirmadaComprobante(id: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("comprobantes")
    .select("file_path")
    .eq("id", id)
    .maybeSingle<{ file_path: string }>();
  if (error || !data) {
    if (error) console.error("[inscripciones] no se pudo leer el comprobante", { id, error: errorSeguro(error) });
    return null;
  }
  const firmada = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(data.file_path, 120);
  if (firmada.error) {
    console.error("[inscripciones] no se pudo firmar la URL", { id, error: errorSeguro(firmada.error) });
    return null;
  }
  return firmada.data.signedUrl;
}

export type ResumenInicio = {
  comprobantesPorRevisar: number;
  porIdentificar: number;
  /** De las inscripciones activas del taller de la página; `null` si no hay taller. */
  pagoIncompleto: number | null;
};

export async function resumenInicio(tallerId: string | null): Promise<ResumenInicio | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const [comprobantes, personas, incompletos] = await Promise.all([
    supabase.from("comprobantes").select("id", { count: "exact", head: true }).eq("estado", "pending"),
    supabase.from("personas").select("id", { count: "exact", head: true }).is("documento", null),
    tallerId
      ? supabase
          .from("inscripciones")
          .select("id", { count: "exact", head: true })
          .eq("taller_id", tallerId)
          .eq("cancelada", false)
          .lt("porcentaje_pagado", 100)
      : Promise.resolve(null),
  ]);
  if (comprobantes.error || personas.error || incompletos?.error) {
    console.error("[inscripciones] no se pudo armar el resumen", {
      comprobantes: errorSeguro(comprobantes.error),
      personas: errorSeguro(personas.error),
      incompletos: errorSeguro(incompletos?.error),
    });
    return null;
  }
  return {
    comprobantesPorRevisar: comprobantes.count ?? 0,
    porIdentificar: personas.count ?? 0,
    pagoIncompleto: incompletos ? (incompletos.count ?? 0) : null,
  };
}
