import { describe, expect, it } from "vitest";
import { MENSAJES_INSCRIPCION, motivoDesdeErrorPg, motivoDesdeReason } from "../errores";

describe("motivoDesdeReason", () => {
  it("reconoce los reason de las funciones SQL", () => {
    expect(motivoDesdeReason("sin_cupos")).toBe("sin_cupos");
    expect(motivoDesdeReason("porcentaje_no_permitido")).toBe("porcentaje_no_permitido");
    expect(motivoDesdeReason("tiene_certificado")).toBe("tiene_certificado");
    expect(motivoDesdeReason("estado_invalido")).toBe("estado_invalido");
  });

  it("reconoce todos los reason que pueden devolver las funciones SQL", () => {
    // Lista de los `reason` de supabase/migrations/20261015_01_inscripciones.sql.
    const delSql = [
      "taller_desconocido", "documento_invalido", "cerrado", "ya_inscrito", "sin_cupos",
      "sin_inscripcion", "sin_saldo", "porcentaje_no_permitido", "estado_invalido",
      "no_encontrado", "tiene_pagos_verificados", "tiene_certificado", "misma_persona",
    ];
    for (const reason of delSql) {
      expect(motivoDesdeReason(reason)).toBe(reason);
      expect(MENSAJES_INSCRIPCION[reason as keyof typeof MENSAJES_INSCRIPCION]).toBeTruthy();
    }
  });

  it("lo desconocido es un error genérico", () => {
    expect(motivoDesdeReason("algo_raro")).toBe("error");
    expect(motivoDesdeReason(null)).toBe("error");
  });
});

describe("motivoDesdeErrorPg", () => {
  it("documento repetido y id mal formado", () => {
    expect(motivoDesdeErrorPg({ code: "23505" })).toBe("documento_duplicado");
    expect(motivoDesdeErrorPg({ code: "22P02" })).toBe("no_encontrado");
    expect(motivoDesdeErrorPg(null)).toBe("error");
  });
});

describe("MENSAJES_INSCRIPCION", () => {
  it("todo motivo tiene mensaje", () => {
    for (const m of Object.values(MENSAJES_INSCRIPCION)) expect(m.length).toBeGreaterThan(10);
  });
});
