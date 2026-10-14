import { cache } from "react";
import { elegirTallerActivo, hoyISO } from "./reglas";
import { listarTalleresVisibles, obtenerDisponibilidad } from "./repo";
import { construirTallerVista, type TallerVista } from "./vista";

export type TallerPublico =
  | { kind: "ok"; vista: TallerVista }
  | { kind: "ninguno" }
  | { kind: "sin_conexion" };

/**
 * Taller que muestra `/taller`, ya armado para la página.
 *
 * `cache` de React lo deduplica dentro de una misma petición: la página y
 * `generateMetadata` lo piden los dos y solo se consulta la base una vez.
 */
export const cargarTallerPublico = cache(async (): Promise<TallerPublico> => {
  const talleres = await listarTalleresVisibles();
  if (talleres === null) return { kind: "sin_conexion" };

  const activo = elegirTallerActivo(talleres, hoyISO());
  if (!activo) return { kind: "ninguno" };

  const disp = await obtenerDisponibilidad(activo.taller.slug);
  return { kind: "ok", vista: construirTallerVista(activo.taller, activo.estadoEfectivo, disp) };
});

/** Taller con el que abre una pantalla del admin: el de la URL o el activo. */
export async function slugParaAdmin(param: string | undefined): Promise<string | null> {
  if (param) return param;
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista.slug : null;
}
