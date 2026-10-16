/**
 * Versión de un error de PostgREST/Storage apta para logs: `details` puede traer
 * «Key (documento)=(...)», así que solo se conservan el código y el mensaje.
 */
export function errorSeguro(
  e: { code?: string; message: string } | null | undefined,
): { code?: string; message: string } | null {
  return e ? { code: e.code, message: e.message } : null;
}
