import type { OrderDraft } from "@/lib/payments";
import { getSupabase } from "./supabase";
import type { SaveResult, Seats } from "./types";

export type { SaveResult, Seats } from "./types";
export { supabaseConfigured } from "./supabase";

/** Fila que devuelve `public.create_reservation` (ver `supabase/schema.sql`). */
type CreateReservationRow = {
  ok: boolean;
  reason: string | null;
  reservation_id: string | null;
  seats_total: number;
  seats_taken: number;
  seats_remaining: number;
};

function toSeats(row: CreateReservationRow): Seats {
  return {
    total: row.seats_total,
    taken: row.seats_taken,
    remaining: row.seats_remaining,
    isOpen: row.reason !== "closed",
  };
}

/**
 * Registra la reserva y reclama el cupo en una sola operación atómica.
 *
 * El conteo y el insert los resuelve la función `create_reservation` en
 * Postgres, no este código: hacerlo aquí con un SELECT y luego un INSERT deja
 * una ventana en la que dos envíos simultáneos venden la misma plaza.
 */
export async function saveReservation(edition: string, order: OrderDraft): Promise<SaveResult> {
  const supabase = getSupabase();

  if (!supabase) {
    // Sin credenciales la landing sigue en pie: la reserva se cierra por
    // WhatsApp y queda al menos en los logs del servidor.
    console.info("[taller] reserva (sin Supabase)", JSON.stringify(order));
    return { kind: "unstored" };
  }

  const { data, error } = await supabase.rpc("create_reservation", {
    p_edition: edition,
    p_reference: order.reference,
    p_tier_id: order.tierId,
    p_tier_name: order.tierName,
    p_amount: order.price?.amount ?? null,
    p_currency: order.price?.currency ?? null,
    p_name: order.customer.name,
    p_email: order.customer.email,
    p_phone: order.customer.phone,
    p_city: order.customer.city,
    p_profession: order.customer.profession,
    p_notes: order.notes,
  });

  // El cliente no está tipado contra el esquema (no hay tipos generados), así
  // que `data` llega sin forma. La función devuelve `returns table`, o sea una
  // fila suelta dentro de un array.
  const row = (data as CreateReservationRow[] | null)?.[0];

  if (error || !row) {
    // Se registra la reserva completa en los logs para poder recuperarla a mano:
    // el usuario ya vio su referencia en pantalla.
    console.error("[taller] no se pudo guardar la reserva", {
      reference: order.reference,
      error,
      order,
    });
    return { kind: "error" };
  }

  const seats = toSeats(row);

  if (row.ok && row.reservation_id)
    return { kind: "saved", id: row.reservation_id, seats };
  if (row.reason === "sold_out") return { kind: "sold_out", seats };
  if (row.reason === "closed") return { kind: "closed", seats };

  console.error("[taller] create_reservation rechazó la reserva", {
    reference: order.reference,
    reason: row.reason,
  });
  return { kind: "error" };
}
