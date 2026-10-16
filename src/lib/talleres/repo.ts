import { getSupabase } from "@/lib/reservations/supabase";
import { motivoDesdeError, type MotivoError } from "./errores";
import { COLUMNAS_TALLER, filaATaller, tallerAFila, type FilaTaller } from "./mapeo";
import type { Disponibilidad, Taller, TallerEstado, TallerInput } from "./tipos";

/**
 * Único módulo que lee y escribe `public.talleres`. Solo servidor: usa la
 * clave `service_role`. Las reglas (solapamiento, porcentajes, fechas) las
 * hace cumplir la base; aquí solo se traducen sus errores.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoError };

const fallo = (motivo: MotivoError) => ({ ok: false, motivo }) as const;

type FilaDisponibilidad = { slug: string; total: number; ocupados: number; libres: number };

function aDisponibilidad(f: FilaDisponibilidad): Disponibilidad {
  return { total: f.total, ocupados: f.ocupados, libres: f.libres };
}

export async function listarTalleres(): Promise<Taller[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .order("fecha_inicio", { ascending: false });
  if (error) {
    console.error("[talleres] no se pudo listar", error);
    return null;
  }
  return (data as FilaTaller[]).map(filaATaller);
}

export async function listarTalleresVisibles(): Promise<Taller[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .in("estado", ["publicado", "cerrado", "finalizado"]);
  if (error) {
    console.error("[talleres] no se pudieron leer los talleres visibles", error);
    return null;
  }
  return (data as FilaTaller[]).map(filaATaller);
}

export async function obtenerTaller(id: string): Promise<Resultado<Taller>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("talleres")
    .select(COLUMNAS_TALLER)
    .eq("id", id)
    .maybeSingle<FilaTaller>();
  if (error) {
    // Un id que no es uuid llega como error 22P02: para el admin es "no existe".
    if (error.code === "22P02") return fallo("no_encontrado");
    console.error("[talleres] no se pudo leer", { id, error });
    return fallo("error");
  }
  return data ? { ok: true, valor: filaATaller(data) } : fallo("no_encontrado");
}

export async function obtenerDisponibilidad(slug: string): Promise<Disponibilidad | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("talleres_disponibilidad")
    .select("slug, total, ocupados, libres")
    .eq("slug", slug)
    .maybeSingle<FilaDisponibilidad>();
  if (error || !data) {
    if (error) console.error("[talleres] no se pudo leer la disponibilidad", error);
    return null;
  }
  return aDisponibilidad(data);
}

export async function listarDisponibilidades(): Promise<Map<string, Disponibilidad>> {
  const mapa = new Map<string, Disponibilidad>();
  const supabase = getSupabase();
  if (!supabase) return mapa;
  const { data, error } = await supabase
    .from("talleres_disponibilidad")
    .select("slug, total, ocupados, libres");
  if (error) {
    console.error("[talleres] no se pudo listar la disponibilidad", error);
    return mapa;
  }
  for (const f of data as FilaDisponibilidad[]) mapa.set(f.slug, aDisponibilidad(f));
  return mapa;
}

/** Inscripciones del taller, incluidas las canceladas: cualquiera impide borrarlo. */
export async function contarInscripciones(tallerId: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("inscripciones")
    .select("id", { count: "exact", head: true })
    .eq("taller_id", tallerId);
  if (error) {
    console.error("[talleres] no se pudieron contar las inscripciones", { tallerId, error });
    return null;
  }
  return count ?? 0;
}

export async function crearTaller(input: TallerInput): Promise<Resultado<string>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase
    .from("talleres")
    .insert({ ...tallerAFila(input), estado: "borrador" })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error) console.error("[talleres] no se pudo crear", error);
    return fallo(motivoDesdeError(error));
  }
  return { ok: true, valor: data.id };
}

export async function actualizarTaller(id: string, input: TallerInput): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  // El slug nombra la carpeta de los comprobantes y las tablas `_legacy_*`
  // apuntan a él: solo se cambia mientras el taller no tenga inscripciones.
  const actual = await obtenerTaller(id);
  if (!actual.ok) return actual;
  const reservas = await contarInscripciones(id);
  if (reservas === null) return fallo("error");
  const { slug, ...sinSlug } = tallerAFila(input);
  const fila = reservas === 0 ? { slug, ...sinSlug } : sinSlug;
  const { data, error } = await supabase.from("talleres").update(fila).eq("id", id).select("id");
  if (error) {
    if (error.code === "22P02") return fallo("no_encontrado");
    console.error("[talleres] no se pudo actualizar", { id, error });
    return fallo(motivoDesdeError(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

export async function cambiarEstadoTaller(id: string, estado: TallerEstado): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const { data, error } = await supabase.from("talleres").update({ estado }).eq("id", id).select("id");
  if (error) {
    if (error.code === "22P02") return fallo("no_encontrado");
    console.error("[talleres] no se pudo cambiar el estado", { id, estado, error });
    return fallo(motivoDesdeError(error));
  }
  return data.length > 0 ? { ok: true, valor: null } : fallo("no_encontrado");
}

/** Copia todo menos estado (queda en borrador) y slug; las fechas se ajustan al editar. */
export async function duplicarTaller(id: string): Promise<Resultado<string>> {
  const original = await obtenerTaller(id);
  if (!original.ok) return original;
  const { id: _id, nombre, estado, contenido, creadoEn, ...input } = original.valor;
  void _id; void nombre; void estado; void creadoEn;
  const sufijo = crypto.randomUUID().slice(0, 4);
  const creado = await crearTaller({ ...input, slug: `${input.slug}-copia-${sufijo}` });
  if (!creado.ok || contenido == null) return creado;

  const supabase = getSupabase();
  await supabase?.from("talleres").update({ contenido }).eq("id", creado.valor);
  return creado;
}

export async function eliminarTaller(id: string): Promise<Resultado<null>> {
  const supabase = getSupabase();
  if (!supabase) return fallo("sin_conexion");
  const taller = await obtenerTaller(id);
  if (!taller.ok) return taller;

  const reservas = await contarInscripciones(id);
  if (reservas === null) return fallo("error");
  if (reservas > 0) return fallo("tiene_inscripciones");

  const { error } = await supabase.from("talleres").delete().eq("id", id);
  if (error) {
    console.error("[talleres] no se pudo eliminar", { id, error });
    return fallo(motivoDesdeError(error));
  }
  return { ok: true, valor: null };
}
