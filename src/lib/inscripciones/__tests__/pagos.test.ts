import { describe, expect, it } from "vitest";
import {
  estadoPago,
  montoDePorcentaje,
  porcentajesDisponibles,
  porcentajeValido,
  saldoPendiente,
} from "../pagos";

describe("estadoPago", () => {
  it("cancelada manda sobre lo pagado", () => {
    expect(estadoPago({ cancelada: true, porcentajePagado: 100 })).toBe("cancelada");
  });
  it("100 pagado, 1–99 abonado, 0 pendiente", () => {
    expect(estadoPago({ cancelada: false, porcentajePagado: 100 })).toBe("pagado");
    expect(estadoPago({ cancelada: false, porcentajePagado: 50 })).toBe("abonado");
    expect(estadoPago({ cancelada: false, porcentajePagado: 0 })).toBe("pendiente");
  });
});

describe("saldoPendiente", () => {
  it("cuenta lo que está en revisión y nunca baja de 0", () => {
    expect(saldoPendiente(0, 0)).toBe(100);
    expect(saldoPendiente(50, 25)).toBe(25);
    expect(saldoPendiente(80, 50)).toBe(0);
  });

  it("NaN, infinitos y negativos cuentan como 0: nunca NaN ni más de 100", () => {
    expect(saldoPendiente(NaN, 0)).toBe(100);
    expect(saldoPendiente(-20, 0)).toBe(100);
    expect(saldoPendiente(50, Infinity)).toBe(50);
    expect(porcentajesDisponibles([50, 100], NaN, -5)).toEqual([
      { porcentaje: 50, etiqueta: "Abono del 50%" },
      { porcentaje: 100, etiqueta: "Pago completo (100%)" },
    ]);
  });
});

describe("porcentajesDisponibles", () => {
  it("sin pagos: los permitidos", () => {
    expect(porcentajesDisponibles([50, 100], 0, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Abono del 50%" },
      { porcentaje: 100, etiqueta: "Pago completo (100%)" },
    ]);
  });

  it("con la mitad pagada: solo el saldo", () => {
    expect(porcentajesDisponibles([50, 100], 50, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Saldo restante (50%)" },
    ]);
  });

  it("taller que solo acepta el 100%", () => {
    expect(porcentajesDisponibles([100], 0, 0)).toEqual([
      { porcentaje: 100, etiqueta: "Pago completo (100%)" },
    ]);
  });

  it("saldo que no está entre los permitidos se ofrece igual", () => {
    expect(porcentajesDisponibles([50, 100], 25, 0)).toEqual([
      { porcentaje: 50, etiqueta: "Abono del 50%" },
      { porcentaje: 75, etiqueta: "Saldo restante (75%)" },
    ]);
  });

  it("lo que está en revisión reduce el saldo", () => {
    expect(porcentajesDisponibles([25, 50, 75, 100], 0, 50)).toEqual([
      { porcentaje: 25, etiqueta: "Abono del 25%" },
      { porcentaje: 50, etiqueta: "Saldo restante (50%)" },
    ]);
  });

  it("sin saldo no hay opciones", () => {
    expect(porcentajesDisponibles([50, 100], 100, 0)).toEqual([]);
    expect(porcentajesDisponibles([50, 100], 60, 50)).toEqual([]);
  });
});

describe("porcentajeValido", () => {
  it("solo lo que se ofrece", () => {
    expect(porcentajeValido(50, [50, 100], 50, 0)).toBe(true);
    expect(porcentajeValido(100, [50, 100], 50, 0)).toBe(false);
    expect(porcentajeValido(25, [50, 100], 0, 0)).toBe(false);
  });
});

describe("montoDePorcentaje", () => {
  it("redondea a la unidad", () => {
    expect(montoDePorcentaje(350000, 50)).toBe(175000);
    expect(montoDePorcentaje(100001, 25)).toBe(25000);
  });
});
