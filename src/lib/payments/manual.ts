import { tallerWaLink } from "@/lib/taller";
import type { CheckoutResult, OrderDraft, PaymentProvider } from "./types";

/**
 * Proveedor por defecto: registra la reserva y entrega el cierre a WhatsApp.
 *
 * Es el único que funciona sin credenciales, así que la página es publicable
 * hoy. Cuando la pasarela definitiva esté elegida, `PAYMENT_PROVIDER` apunta al
 * adaptador nuevo y este queda como fallback.
 */
export const manualProvider: PaymentProvider = {
  id: "manual",

  async createCheckout(order: OrderDraft): Promise<CheckoutResult> {
    const lines = [
      `Hola, quiero reservar mi cupo en el ${order.courseName}.`,
      "",
      `Referencia: ${order.reference}`,
      `Modalidad: ${order.tierName}`,
      `Nombre: ${order.customer.name}`,
      `Documento: ${order.customer.document}`,
      `Email: ${order.customer.email}`,
      `Teléfono: ${order.customer.phone}`,
      `Ciudad: ${order.customer.city}`,
      `Profesión: ${order.customer.profession}`,
    ];

    if (order.notes.trim()) lines.push(`Notas: ${order.notes.trim()}`);

    return {
      kind: "pending",
      reference: order.reference,
      message:
        "Tu reserva quedó registrada. Confirmamos el cupo y el medio de pago por WhatsApp.",
      handoffUrl: tallerWaLink(lines.join("\n")),
    };
  },
};
