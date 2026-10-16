/**
 * Límite del comprobante de pago. Vive aquí y no en el módulo de servidor
 * porque el formulario lo usa para avisar antes de enviar: un archivo que
 * supera el `bodySizeLimit` de `next.config.ts` ni siquiera llega al server
 * action.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Formatos aceptados: capturas de pantalla, fotos del iPhone y PDF del banco. */
export const PROOF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";
