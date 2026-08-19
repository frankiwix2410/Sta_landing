import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Puerta de la zona de administración de certificados.
 *
 * Una contraseña compartida en variable de entorno, no un sistema de usuarios:
 * detrás solo hay una persona y lo que protege es una lista de asistentes, no
 * datos clínicos. Si algún día entra más gente, esto se cambia por Supabase Auth
 * sin tocar las páginas.
 *
 * La cookie no guarda la contraseña sino un hash con sal fija, y la comparación
 * es en tiempo constante para no filtrar el valor a base de medir respuestas.
 */

const COOKIE = "sta_certificados";
/** 12 horas: suficiente para una jornada de taller, corto para un portátil perdido. */
const MAX_AGE = 60 * 60 * 12;

function tokenFor(password: string) {
  return createHash("sha256").update(`sta-certificados:${password}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * `false` si no hay contraseña configurada. Las páginas responden 404 en ese
 * caso: es preferible que la ruta no exista a que exista sin protección.
 */
export function adminConfigured() {
  return Boolean(process.env.CERTIFICADOS_PASSWORD);
}

export async function isAdmin() {
  const password = process.env.CERTIFICADOS_PASSWORD;
  if (!password) return false;

  const value = (await cookies()).get(COOKIE)?.value;
  return Boolean(value && safeEqual(value, tokenFor(password)));
}

/** Valida la contraseña y abre la sesión. Devuelve `false` si no coincide. */
export async function signIn(submitted: string) {
  const password = process.env.CERTIFICADOS_PASSWORD;
  // Se comparan los hashes y no las contraseñas: así los dos lados miden
  // siempre 64 caracteres y el fallo rápido por longitud no delata nada.
  if (!password || !safeEqual(tokenFor(submitted), tokenFor(password))) return false;

  (await cookies()).set(COOKIE, tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MAX_AGE,
  });

  return true;
}

export async function signOut() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}
