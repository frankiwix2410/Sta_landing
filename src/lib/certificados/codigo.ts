/**
 * Alfabeto de los códigos de certificado: sin 0/O ni 1/I/L, que se confunden
 * al leerlos en papel. Es el mismo que usa `public.generar_codigo_certificado`,
 * que es quien los genera (la emisión ocurre en un trigger de la base).
 */
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const PATRON = new RegExp(`^C-[${ALFABETO_CODIGO}]{4}-[${ALFABETO_CODIGO}]{4}$`);

/**
 * Forma canónica `C-XXXX-XXXX` de lo que alguien teclea o escanea: acepta
 * minúsculas, espacios, sin guiones o sin la C. `null` si no puede ser un código.
 *
 * Ojo con la C inicial: "CABCDEFGH" (9 caracteres) es el código sin guiones,
 * pero "C-ABCD-EFG" (8 caracteres tras quitar guiones) es un código cortado.
 * Si la entrada trae el prefijo "C" seguido de separador, el resto debe ser
 * exactamente de 8 caracteres; sin prefijo, 8 caracteres bastan.
 */
export function normalizarCodigo(texto: string): string | null {
  const mayusculas = texto.trim().toUpperCase();
  const limpio = mayusculas.replace(/[^A-Z0-9]/g, "");
  const prefijado = /^C[\s-]/.test(mayusculas);

  let cuerpo: string;
  if (prefijado) {
    if (limpio.length !== 9 || !limpio.startsWith("C")) return null;
    cuerpo = limpio.slice(1);
  } else if (limpio.length === 9 && limpio.startsWith("C")) {
    cuerpo = limpio.slice(1);
  } else {
    cuerpo = limpio;
  }

  if (cuerpo.length !== 8) return null;
  const codigo = `C-${cuerpo.slice(0, 4)}-${cuerpo.slice(4)}`;
  return PATRON.test(codigo) ? codigo : null;
}

/** Las URLs antiguas usaban la referencia de la reserva (`STA-XXXXXXXX`). */
export function esReferencia(texto: string): boolean {
  return /^STA-[A-Z0-9]{8}$/.test(texto.trim().toUpperCase());
}
