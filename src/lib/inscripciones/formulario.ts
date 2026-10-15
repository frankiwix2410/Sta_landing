import { documentoValido, normalizarDocumento } from "./documento";
import { TIPOS_DOCUMENTO, type DatosPersona, type TipoDocumento } from "./tipos";

/** Límites de longitud: los mismos `maxLength` que llevan los formularios. */
export const MAX = {
  nombre: 120,
  documento: 30,
  email: 160,
  telefono: 40,
  ciudad: 80,
  profesion: 120,
  notas: 800,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los ids llegan de formularios y URLs: uno mal formado haría fallar a Postgres con 22P02. */
export function esUuid(v: string): boolean {
  return UUID.test(v);
}

function texto(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function validarNombre(nombre: string, errores: Record<string, string>) {
  if (nombre.length < 3) errores.nombre = "Escribe el nombre completo.";
  else if (nombre.length > MAX.nombre) errores.nombre = "Nombre demasiado largo.";
}

// Validación deliberadamente laxa: rechazar direcciones raras pero válidas es
// peor que dejar pasar una errata, porque cada pago se confirma a mano.
function validarEmail(email: string, errores: Record<string, string>) {
  if (!EMAIL.test(email) || email.length > MAX.email) errores.email = "Escribe un email válido.";
}

function validarTelefono(telefono: string, errores: Record<string, string>) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7 || digitos.length > 15 || telefono.length > MAX.telefono)
    errores.telefono = "Escribe un teléfono válido con indicativo.";
}

export type LecturaPersona =
  | { ok: true; datos: DatosPersona; notas: string }
  | { ok: false; errores: Record<string, string> };

/**
 * Lee la ficha de una persona.
 *
 * - `publico`: el formulario de reserva; todo es obligatorio salvo las notas.
 * - `admin`: inscribir a mano o editar la ficha; basta documento y nombre,
 *   porque de quien apartó cupo por WhatsApp a veces solo se sabe eso.
 */
export function leerPersonaForm(fd: FormData, modo: "publico" | "admin"): LecturaPersona {
  const errores: Record<string, string> = {};

  const crudo = texto(fd, "documento");
  const documento = normalizarDocumento(crudo);
  if (crudo.length > MAX.documento || !documentoValido(documento))
    errores.documento = "Escribe el número de documento (cédula o pasaporte).";

  const tipo = texto(fd, "tipo_documento").toUpperCase();
  const tipoDocumento: TipoDocumento = (TIPOS_DOCUMENTO as readonly string[]).includes(tipo)
    ? (tipo as TipoDocumento)
    : "CC";

  const nombre = texto(fd, "nombre").replace(/\s+/g, " ");
  const email = texto(fd, "email");
  const telefono = texto(fd, "telefono");
  const ciudad = texto(fd, "ciudad");
  const profesion = texto(fd, "profesion");
  const notas = texto(fd, "notas");

  validarNombre(nombre, errores);
  if (modo === "publico" || email) validarEmail(email, errores);
  if (modo === "publico" || telefono) validarTelefono(telefono, errores);

  if (modo === "publico" && ciudad.length < 2) errores.ciudad = "Indica tu ciudad.";
  else if (ciudad.length > MAX.ciudad) errores.ciudad = "Ciudad demasiado larga.";

  if (modo === "publico" && profesion.length < 2) errores.profesion = "Indica tu profesión o especialidad.";
  else if (profesion.length > MAX.profesion) errores.profesion = "Texto demasiado largo.";

  if (notas.length > MAX.notas) errores.notas = "El mensaje supera los 800 caracteres.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    notas,
    datos: {
      documento,
      tipoDocumento,
      nombre,
      email: email || null,
      telefono: telefono || null,
      ciudad: ciudad || null,
      profesion: profesion || null,
    },
  };
}

export type Correcciones = { nombre: string | null; email: string | null; telefono: string | null };

/**
 * Paso 2 del pago: la persona ve sus datos enmascarados y solo corrige el que
 * reescribe completo. Un campo vacío significa «está bien así».
 */
export function leerCorrecciones(fd: FormData, errores: Record<string, string>): Correcciones {
  const nombre = texto(fd, "nombre").replace(/\s+/g, " ");
  const email = texto(fd, "email");
  const telefono = texto(fd, "telefono");
  if (nombre) validarNombre(nombre, errores);
  if (email) validarEmail(email, errores);
  if (telefono) validarTelefono(telefono, errores);
  return { nombre: nombre || null, email: email || null, telefono: telefono || null };
}
