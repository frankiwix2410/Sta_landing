import type { EstadoPago } from "./tipos";

export function estadoPago(i: { cancelada: boolean; porcentajePagado: number }): EstadoPago {
  if (i.cancelada) return "cancelada";
  if (i.porcentajePagado >= 100) return "pagado";
  if (i.porcentajePagado > 0) return "abonado";
  return "pendiente";
}

/**
 * Lo que falta por cubrir. Cuenta también lo que está en revisión: si no, dos
 * comprobantes del 100% subidos antes de que el admin revise sumarían 200%.
 * Es la misma cuenta que hace `registrar_comprobante` en la base.
 */
export function saldoPendiente(pagado: number, enRevision: number): number {
  // NaN, infinitos o negativos (datos corruptos o mal enviados) cuentan como 0:
  // así nunca se ofrece un "NaN%" ni un porcentaje mayor que el saldo.
  const seguro = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0);
  return Math.max(0, 100 - Math.min(100, seguro(pagado) + seguro(enRevision)));
}

export type OpcionPago = { porcentaje: number; etiqueta: string };

function etiqueta(p: number, saldo: number) {
  if (p === 100) return "Pago completo (100%)";
  if (p === saldo) return `Saldo restante (${p}%)`;
  return `Abono del ${p}%`;
}

/**
 * Lo que se puede pagar ahora: los porcentajes del taller que caben en el
 * saldo, más el saldo exacto (para quien abonó 25% en un taller de {50, 100}).
 */
export function porcentajesDisponibles(
  permitidos: readonly number[],
  pagado: number,
  enRevision: number,
): OpcionPago[] {
  const saldo = saldoPendiente(pagado, enRevision);
  if (saldo === 0) return [];
  const valores = [...new Set([...permitidos.filter((p) => p > 0 && p <= saldo), saldo])].sort(
    (a, b) => a - b,
  );
  return valores.map((p) => ({ porcentaje: p, etiqueta: etiqueta(p, saldo) }));
}

export function porcentajeValido(
  p: number,
  permitidos: readonly number[],
  pagado: number,
  enRevision: number,
): boolean {
  return porcentajesDisponibles(permitidos, pagado, enRevision).some((o) => o.porcentaje === p);
}

/** Importe que corresponde a un porcentaje de la tarifa (COP no usa decimales). */
export function montoDePorcentaje(monto: number, porcentaje: number): number {
  return Math.round((monto * porcentaje) / 100);
}
