/**
 * Contrato de pago del taller.
 *
 * La landing nunca habla con una pasarela concreta: solo conoce estos tipos.
 * Cambiar de Mercado Pago a Stripe o Wompi debe ser escribir un adaptador
 * nuevo y cambiar la variable de entorno `PAYMENT_PROVIDER` — sin tocar la UI.
 */

export type Money = {
  /** Importe en la unidad menor de la moneda (COP no usa decimales). */
  amount: number;
  currency: string;
};

/** Lo que la landing sabe de una reserva antes de cobrarla. */
export type OrderDraft = {
  reference: string;
  /** "Taller de …", para los mensajes de WhatsApp. */
  courseName: string;
  tierId: string;
  tierName: string;
  price: Money | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
    profession: string;
  };
  notes: string;
};

/**
 * Resultado de iniciar un cobro.
 *
 * - `redirect`: la pasarela dio una URL de checkout; la UI lleva al usuario ahí.
 * - `pending`:  no hay cobro automático todavía; la reserva queda registrada y
 *               el pago se coordina por el canal indicado en `handoffUrl`.
 */
export type CheckoutResult =
  | { kind: "redirect"; url: string; reference: string }
  | { kind: "pending"; reference: string; message: string; handoffUrl: string };

export interface PaymentProvider {
  readonly id: string;
  createCheckout(order: OrderDraft): Promise<CheckoutResult>;
}
