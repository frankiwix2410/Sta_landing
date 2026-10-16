"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { isAdmin } from "@/lib/admin-auth";
import { revocarCertificado } from "@/lib/certificados/repo";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { esUuid } from "@/lib/inscripciones/formulario";

const SESION_VENCIDA: EstadoAccion = {
  status: "error",
  errores: {},
  message: "Tu sesión venció. Recarga la página y vuelve a entrar.",
};

export async function revocarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = String(fd.get("id") ?? "");
  if (!esUuid(id)) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION.no_encontrado };
  const revocar = fd.get("revocar") === "si";

  const r = await revocarCertificado(id, revocar);
  if (!r.ok) return { status: "error", errores: {}, message: MENSAJES_INSCRIPCION[r.motivo] };

  revalidatePath("/admin", "layout");
  return {
    status: "ok",
    message: revocar
      ? "Certificado revocado."
      : r.vigente
        ? "Certificado reactivado."
        : "Se quitó la revocación manual, pero sigue sin cumplir los requisitos (100% pagado, asistencia y taller finalizado).",
  };
}
