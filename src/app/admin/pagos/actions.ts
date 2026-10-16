"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { isAdmin } from "@/lib/admin-auth";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { esUuid } from "@/lib/inscripciones/formulario";
import { revisarComprobante } from "@/lib/inscripciones/repo";
import {
  ESTADO_COMPROBANTE_ETIQUETA,
  ESTADOS_COMPROBANTE,
  type EstadoComprobante,
} from "@/lib/inscripciones/tipos";

const SESION_VENCIDA: EstadoAccion = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

/** Verificar, rechazar o devolver a «por revisar». La base recalcula lo pagado. */
export async function revisarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  const estado = String(fd.get("estado") ?? "") as EstadoComprobante;
  if (!esUuid(id) || !ESTADOS_COMPROBANTE.includes(estado)) {
    return { status: "error", errores: {}, message: "Datos no válidos. Recarga la página." };
  }
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 500);

  const r = await revisarComprobante(id, estado, nota);
  if (!r.ok) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION[r.motivo] };

  revalidatePath("/admin", "layout");
  // El cupo y el estado de pago que ve el público dependen de lo verificado.
  revalidatePath("/taller");
  return {
    status: "ok",
    message: `${ESTADO_COMPROBANTE_ETIQUETA[estado]}. La inscripción lleva ${r.valor}% pagado.`,
  };
}
