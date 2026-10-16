"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { documentoValido, normalizarDocumento } from "@/lib/inscripciones/documento";
import { MENSAJES_INSCRIPCION, type MotivoInscripcion } from "@/lib/inscripciones/errores";
import { esUuid, leerPersonaForm } from "@/lib/inscripciones/formulario";
import {
  actualizarPersona,
  ajustarPorcentaje,
  buscarPersona,
  cambiarCancelada,
  crearInscripcion,
  eliminarInscripcion,
  fusionarPersonas,
  marcarAsistencia,
} from "@/lib/inscripciones/repo";
import { TIPOS_DOCUMENTO, type Persona, type TipoDocumento } from "@/lib/inscripciones/tipos";
import { obtenerTaller } from "@/lib/talleres/repo";

export type EstadoAccion =
  | { status: "idle" }
  | { status: "error"; errores: Record<string, string>; message?: string }
  | { status: "ok"; message: string };

const TEXTO_SESION = "Tu sesión venció. Recarga la página y vuelve a entrar.";
const SESION_VENCIDA: EstadoAccion = { status: "error", errores: {}, message: TEXTO_SESION };

function fallo(motivo: MotivoInscripcion, errores: Record<string, string> = {}): EstadoAccion {
  return { status: "error", errores, message: MENSAJES_INSCRIPCION[motivo] };
}

/** Inscritos, pagos, inicio y los cupos de la página pública dependen de esto. */
function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/taller");
}

function idDe(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "");
  return esUuid(v) ? v : null;
}

function referenciaNueva() {
  return `STA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export type BusquedaPersona =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "listo"; documento: string; tipoDocumento: TipoDocumento; persona: Persona | null };

/** Inscribir a mano, paso 1: el documento. Si la persona existe se autocompleta su ficha. */
export async function buscarPersonaAdmin(
  _prev: BusquedaPersona,
  fd: FormData,
): Promise<BusquedaPersona> {
  if (!(await isAdmin())) return { status: "error", message: TEXTO_SESION };

  const documento = normalizarDocumento(String(fd.get("documento") ?? ""));
  if (!documentoValido(documento)) return { status: "error", message: MENSAJES_INSCRIPCION.documento_invalido };

  const tipo = String(fd.get("tipo_documento") ?? "");
  const tipoElegido: TipoDocumento = (TIPOS_DOCUMENTO as readonly string[]).includes(tipo)
    ? (tipo as TipoDocumento)
    : "CC";

  const r = await buscarPersona(documento);
  if (!r.ok) return { status: "error", message: MENSAJES_INSCRIPCION[r.motivo] };
  return {
    status: "listo",
    documento,
    tipoDocumento: r.valor?.tipoDocumento ?? tipoElegido,
    persona: r.valor,
  };
}

/** Inscribir a mano, paso 2. Puede pasar del cupo si se marca «forzar». */
export async function inscribirManual(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const tallerId = idDe(fd, "taller_id");
  if (!tallerId) return fallo("taller_desconocido");

  const lectura = leerPersonaForm(fd, "admin");
  if (!lectura.ok) return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };

  const taller = await obtenerTaller(tallerId);
  if (!taller.ok) return fallo(taller.motivo === "sin_conexion" ? "sin_conexion" : "taller_desconocido");

  const tarifas = taller.valor.tarifas;
  const tarifa =
    tarifas.find((t) => t.id === String(fd.get("tarifa_id") ?? "")) ??
    tarifas.find((t) => t.destacada) ??
    tarifas[0];

  const r = await crearInscripcion({
    tallerId,
    referencia: referenciaNueva(),
    persona: lectura.datos,
    tarifa: tarifa ? { id: tarifa.id, nombre: tarifa.nombre } : { id: "general", nombre: "Cupo General" },
    // Se guarda el precio de la tarifa si lo tiene, aunque la página no lo muestre.
    monto: tarifa && tarifa.precio > 0 ? tarifa.precio : null,
    moneda: tarifa && tarifa.precio > 0 ? taller.valor.moneda : null,
    notas: lectura.notas,
    origen: "admin",
    forzarCupo: fd.get("forzar") === "on",
  });

  if (!r.ok) {
    if (r.motivo === "sin_cupos") {
      return fallo("sin_cupos", {
        forzar: "El taller está lleno. Marca «Inscribir aunque supere el cupo» para continuar.",
      });
    }
    if (r.motivo === "ya_inscrito") {
      return { status: "error", errores: {}, message: "Esa persona ya está inscrita en este taller." };
    }
    return fallo(r.motivo, r.motivo === "documento_invalido" ? { documento: MENSAJES_INSCRIPCION.documento_invalido } : {});
  }

  refrescar();
  return {
    status: "ok",
    message: r.valor.reactivada
      ? `Se reactivó su inscripción ${r.valor.referencia}.`
      : `Inscrita con la referencia ${r.valor.referencia}.`,
  };
}

export async function guardarPersona(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const personaId = idDe(fd, "persona_id");
  if (!personaId) return fallo("no_encontrado");

  const lectura = leerPersonaForm(fd, "admin");
  if (!lectura.ok) return { status: "error", errores: lectura.errores, message: "Revisa los campos marcados." };

  const r = await actualizarPersona(personaId, lectura.datos);
  if (!r.ok) {
    return fallo(r.motivo, r.motivo === "documento_duplicado" ? { documento: MENSAJES_INSCRIPCION.documento_duplicado } : {});
  }
  refrescar();
  return { status: "ok", message: "Ficha guardada." };
}

/** Individual (un `ids`) o en lote (varios, desde el formulario `asistencia-lote`). */
export async function asistencia(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const ids = fd.getAll("ids").map(String).filter(esUuid);
  if (ids.length === 0) return { status: "error", errores: {}, message: "Marca al menos una persona." };
  const asistio = fd.get("accion") !== "quitar";

  const r = await marcarAsistencia(ids, asistio);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return {
    status: "ok",
    message: asistio ? `Asistencia marcada (${r.valor}).` : `Asistencia quitada (${r.valor}).`,
  };
}

export async function ajustarPorcentajeAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");
  const valor = String(fd.get("porcentaje") ?? "auto");
  const porcentaje = valor === "auto" ? null : Number(valor);
  if (porcentaje !== null && (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    return { status: "error", errores: {}, message: "Porcentaje no válido." };
  }

  const r = await ajustarPorcentaje(id, porcentaje);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return {
    status: "ok",
    message: `Pagado: ${r.valor}% ${porcentaje === null ? "(según comprobantes verificados)" : "(fijado a mano)"}.`,
  };
}

export async function cancelarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");
  const cancelada = fd.get("cancelada") === "si";

  const r = await cambiarCancelada(id, cancelada);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: cancelada ? "Inscripción cancelada: libera su cupo." : "Inscripción reactivada." };
}

export async function eliminarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const id = idDe(fd, "id");
  if (!id) return fallo("no_encontrado");

  const r = await eliminarInscripcion(id);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: "Inscripción eliminada." };
}

/**
 * Fusiona la ficha `origen_id` en otra. El destino se elige de la lista del
 * taller (`destino_id`) o escribiendo su documento (`destino_documento`), para
 * duplicados que están en talleres distintos.
 */
export async function fusionarAccion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  if (!(await isAdmin())) return SESION_VENCIDA;

  const origen = idDe(fd, "origen_id");
  let destino = idDe(fd, "destino_id");
  const textoDocumento = String(fd.get("destino_documento") ?? "").trim();

  if (!destino && textoDocumento) {
    const documento = normalizarDocumento(textoDocumento);
    if (!documentoValido(documento)) {
      return { status: "error", errores: { destino_documento: "Documento no válido." } };
    }
    const p = await buscarPersona(documento);
    if (!p.ok) return fallo(p.motivo);
    if (!p.valor) {
      return { status: "error", errores: { destino_documento: "No hay ninguna persona con ese documento." } };
    }
    destino = p.valor.id;
  }

  if (!origen || !destino) return { status: "error", errores: {}, message: "Elige con quién fusionar." };

  const r = await fusionarPersonas(origen, destino);
  if (!r.ok) return fallo(r.motivo);
  refrescar();
  return { status: "ok", message: "Fichas fusionadas." };
}
