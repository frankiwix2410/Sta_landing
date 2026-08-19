import { manualProvider } from "./manual";
import type { PaymentProvider } from "./types";

export type { CheckoutResult, Money, OrderDraft, PaymentProvider } from "./types";

/**
 * Registro de pasarelas.
 *
 * Para enchufar la definitiva (Mercado Pago, Stripe, Wompi…):
 *   1. Crea `src/lib/payments/<pasarela>.ts` que exporte un `PaymentProvider`.
 *      Su `createCheckout` recibe el `OrderDraft` y devuelve
 *      `{ kind: "redirect", url, reference }` con la URL de la pasarela.
 *   2. Regístralo aquí abajo.
 *   3. Pon `PAYMENT_PROVIDER=<id>` y sus claves en el entorno del servidor.
 *      Sin prefijo `NEXT_PUBLIC_`: son secretos y además ese prefijo congela
 *      el valor en tiempo de build.
 *   4. La pasarela necesitará un webhook para confirmar el pago; el sitio para
 *      de saber el estado en cuanto el usuario sale hacia el checkout.
 *
 * Nada de la UI cambia: `reserva-form.tsx` solo distingue `redirect` de `pending`.
 */
const providers: Record<string, PaymentProvider> = {
  [manualProvider.id]: manualProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER?.trim() || manualProvider.id;
  const provider = providers[id];

  if (!provider) {
    // Un id mal escrito no debe cobrar por un camino inesperado: se avisa y se
    // cae al flujo manual, que es el seguro.
    console.warn(
      `[payments] PAYMENT_PROVIDER="${id}" no está registrado. Usando "${manualProvider.id}".`,
    );
    return manualProvider;
  }

  return provider;
}
