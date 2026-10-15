import { describe, expect, it } from "vitest";
import { MENSAJES_INSCRIPCION, motivoDesdeErrorPg, motivoDesdeReason } from "../errores";

describe("motivoDesdeReason", () => {
  it("reconoce los reason de las funciones SQL", () => {
    expect(motivoDesdeReason("sin_cupos")).toBe("sin_cupos");
    expect(motivoDesdeReason("porcentaje_no_permitido")).toBe("porcentaje_no_permitido");
    expect(motivoDesdeReason("tiene_certificado")).toBe("tiene_certificado");
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
