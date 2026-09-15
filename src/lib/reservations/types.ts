/**
 * Contrato de persistencia de reservas.
 *
 * Igual que con los pagos, la UI no sabe que detrás hay Supabase: solo maneja
 * estos tipos. Cambiar de base de datos es reescribir `supabase.ts` sin tocar
 * ni el formulario ni el server action.
 */

/** Estado del cupo de una edición del taller. */
export type Seats = {
  total: number;
  /** Reservas que ocupan cupo (todas menos las canceladas). */
  taken: number;
  remaining: number;
  /** `false` cierra el formulario aunque queden plazas. */
  isOpen: boolean;
};

/**
 * Cómo pagó quien registra un comprobante.
 *
 * - `deposit`: abono del 50%. El resto se paga después.
 * - `full`:    pago completo.
 */
export type PaymentKind = "deposit" | "full";

/**
 * Límite del comprobante. Vive aquí y no en el módulo de servidor porque el
 * formulario lo usa para avisar antes de enviar: un archivo que supera el
 * `bodySizeLimit` de `next.config.ts` ni siquiera llega al server action.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Formatos aceptados: capturas de pantalla, fotos del iPhone y PDF del banco. */
export const PROOF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";

/**
 * Resultado de intentar registrar una reserva.
 *
 * - `saved`:      quedó guardada y el cupo está tomado.
 * - `sold_out`:   no quedaban plazas. La reserva NO se guardó.
 * - `closed`:     las reservas están cerradas manualmente.
 * - `unstored`:   no hay Supabase configurado; la reserva solo quedó en los
 *                 logs. La landing sigue funcionando (el cierre es por
 *                 WhatsApp), pero nadie está contando cupos.
 * - `error`:      Supabase respondió con un fallo. Igual que `unstored`, la
 *                 reserva no está en la base.
 */
export type SaveResult =
  | { kind: "saved"; id: string; seats: Seats }
  | { kind: "sold_out"; seats: Seats }
  | { kind: "closed"; seats: Seats }
  | { kind: "unstored" }
  | { kind: "error" };
