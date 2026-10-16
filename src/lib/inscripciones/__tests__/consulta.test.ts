import { describe, expect, it } from "vitest";
import { respuestaConsulta, type FilaConsulta } from "../consulta";

const fila: FilaConsulta = {
  inscripcion_id: "8f1c0000-0000-0000-0000-000000000001",
  referencia: "STA-ABCD1234",
  tipo_documento: "CC",
  nombre: "Luis Fernández",
  email: "luis.fer@gmail.com",
  telefono: "+57 300 123 4512",
  monto: 350000,
  moneda: "COP",
  porcentaje_pagado: 50,
  porcentaje_en_revision: 0,
};

describe("respuestaConsulta", () => {
  it("enmascara los datos y calcula las opciones", () => {
    expect(respuestaConsulta(fila, [50, 100], true)).toEqual({
      nombre: "Lu** Fer******",
      email: "lu***@gmail.com",
      telefono: "*** *** **12",
      pagado: 50,
      enRevision: 0,
      opciones: [{ porcentaje: 50, etiqueta: "Saldo restante (50%)" }],
      monto: 350000,
      moneda: "COP",
    });
  });

  it("no deja nada en claro", () => {
    const json = JSON.stringify(respuestaConsulta(fila, [50, 100], true));
    for (const secreto of ["Fernández", "Luis", "luis.fer", "3001234", "4512", "STA-ABCD1234", fila.inscripcion_id])
      expect(json).not.toContain(secreto);
  });

  it("sin precios publicados no manda el monto", () => {
    const r = respuestaConsulta(fila, [50, 100], false);
    expect(r.monto).toBeNull();
    expect(r.moneda).toBeNull();
  });
});
