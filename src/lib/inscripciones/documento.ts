import type { TipoDocumento } from "./tipos";

/** Marcas que NFD separa de su letra (tildes, virgulilla de la ñ, diéresis…). */
const DIACRITICOS = /[̀-ͯ]/g;

/**
 * Forma única del documento: sin tildes, en mayúsculas y solo letras y
 * números. "1.136.882.468", "1136 882 468" y "1136-882-468" son la misma
 * persona. Tiene que dar lo mismo que `public.normalizar_documento` en SQL:
 * la base busca y compara con esa función.
 */
export function normalizarDocumento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Validación laxa a propósito: conviven cédulas colombianas y venezolanas,
 * pasaportes y documentos de otros países. Igual que la restricción de
 * `personas.documento`.
 */
export function documentoValido(normalizado: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(normalizado);
}

const estrellas = (n: number) => "*".repeat(Math.max(0, n));

/**
 * "Luis Fernando" → "Lu** Fer*****". Lo justo para que la persona se reconozca,
 * no para que un extraño copie el dato.
 */
export function enmascararNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => {
      const letras = [...palabra];
      const visibles = letras.length <= 2 ? 1 : Math.min(3, Math.floor(letras.length / 2));
      return letras.slice(0, visibles).join("") + estrellas(letras.length - visibles);
    })
    .join(" ");
}

/** "luis.fer@gmail.com" → "lu***@gmail.com". El dominio ayuda a reconocerlo y no identifica a nadie. */
export function enmascararEmail(email: string | null): string {
  if (!email) return "";
  const [local, dominio] = email.trim().split("@");
  if (!dominio) return "***";
  const visibles = [...local].slice(0, local.length > 2 ? 2 : 1).join("");
  return `${visibles}***@${dominio}`;
}

/** "+57 300 123 4512" → "*** *** **12". */
export function enmascararTelefono(telefono: string | null): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length < 4) return "***";
  return `*** *** **${digitos.slice(-2)}`;
}

/** "CC ****468", para la página de verificación del certificado. */
export function enmascararDocumento(tipo: TipoDocumento, documento: string | null): string {
  if (!documento) return "Por identificar";
  return `${tipo} ****${documento.slice(-3)}`;
}
