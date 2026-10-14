"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { MENSAJES_ERROR, type MotivoError } from "@/lib/talleres/errores";
import { leerTallerForm } from "@/lib/talleres/formulario";
import {
  actualizarTaller,
  cambiarEstadoTaller,
  crearTaller,
  duplicarTaller,
  eliminarTaller,
} from "@/lib/talleres/repo";
import { ESTADOS_TALLER, type TallerEstado } from "@/lib/talleres/tipos";

export type AccionState =
  | { status: "idle" }
  | { status: "error"; errores: Record<string, string>; message?: string }
  | { status: "ok"; message: string };

const SESION_VENCIDA: AccionState = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

function error(motivo: MotivoError): AccionState {
  return {
    status: "error",
    errores: motivo === "slug_duplicado" ? { slug: MENSAJES_ERROR.slug_duplicado } : {},
    message: MENSAJES_ERROR[motivo],
  };
}

/** La página pública y todo el admin dependen de la tabla de talleres. */
function refrescar() {
  revalidatePath("/taller");
  revalidatePath("/admin", "layout");
}

export async function guardarTaller(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const lectura = leerTallerForm(fd);
  if (!lectura.ok) {
    return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };
  }

  const id = String(fd.get("id") ?? "");

  if (!id) {
    const creado = await crearTaller(lectura.datos);
    if (!creado.ok) return error(creado.motivo);
    refrescar();
    redirect(`/admin/talleres/${creado.valor}`);
  }

  const actualizado = await actualizarTaller(id, lectura.datos);
  if (!actualizado.ok) return error(actualizado.motivo);
  refrescar();
  return { status: "ok", message: "Cambios guardados." };
}

export async function cambiarEstado(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  const estado = String(fd.get("estado") ?? "");
  if (!ESTADOS_TALLER.includes(estado as TallerEstado)) {
    return { status: "error", errores: {}, message: "Estado no válido." };
  }

  const r = await cambiarEstadoTaller(id, estado as TallerEstado);
  if (!r.ok) return error(r.motivo);
  refrescar();
  return { status: "ok", message: "Estado actualizado." };
}

export async function duplicar(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const r = await duplicarTaller(String(fd.get("id") ?? ""));
  if (!r.ok) return error(r.motivo);
  refrescar();
  redirect(`/admin/talleres/${r.valor}`);
}

export async function eliminar(_prev: AccionState, fd: FormData): Promise<AccionState> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const r = await eliminarTaller(String(fd.get("id") ?? ""));
  if (!r.ok) return error(r.motivo);
  refrescar();
  redirect("/admin/talleres");
}
