/**
 * Traducción de los errores de Postgres que el admin puede provocar. Las
 * reglas viven en la base (restricciones), así que el código solo tiene que
 * ponerles nombre y mensaje.
 */

export type MotivoError =
  | "sin_conexion"
  | "solapamiento"
  | "slug_duplicado"
  | "tiene_inscripciones"
  | "no_encontrado"
  | "error";

export function motivoDesdeError(error: { code?: string } | null | undefined): MotivoError {
  switch (error?.code) {
    case "23P01": // exclusion_violation: `talleres_sin_solape`
      return "solapamiento";
    case "23505": // unique_violation: slug repetido
      return "slug_duplicado";
    case "23503": // foreign_key_violation: hay reservas colgando del taller
      return "tiene_inscripciones";
    default:
      return "error";
  }
}

export const MENSAJES_ERROR: Record<MotivoError, string> = {
  sin_conexion: "No hay conexión con la base de datos. Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
  solapamiento:
    "Ya hay otro taller publicado o cerrado en esas fechas. Cambia las fechas o finaliza el otro taller primero.",
  slug_duplicado: "Ya existe un taller con ese identificador (slug). Escribe otro.",
  tiene_inscripciones:
    "Este taller tiene reservas y no se puede eliminar. Archívalo para ocultarlo sin perder el historial.",
  no_encontrado: "No encontramos ese taller. Puede que se haya eliminado.",
  error: "No se pudo guardar. Inténtalo otra vez en unos segundos.",
};
