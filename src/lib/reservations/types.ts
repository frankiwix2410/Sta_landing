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
